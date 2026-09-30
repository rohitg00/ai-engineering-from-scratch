package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Input struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}
type Receipt struct {
	ID          string `json:"id"`
	InputSHA256 string `json:"input_sha256"`
	Bytes       int    `json:"bytes"`
	Words       int    `json:"words"`
}
type WorkOptions struct {
	Now         func() int64
	LeaseMS     int64
	MaxAttempts int
	MaxJobs     int
	Delay       time.Duration
	CrashAfter  string
}
type WorkEvent struct {
	ID      string `json:"id"`
	Version int    `json:"version"`
	Reused  bool   `json:"reused_effect"`
	State   string `json:"state"`
}

func readJSON(file string, target any) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 4*1024*1024+1))
	if err != nil {
		return err
	}
	if len(data) > 4*1024*1024 {
		return ErrLimit
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(target); err != nil {
		return err
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return ErrInvalid
	}
	return nil
}
func writeAtomic(file string, value any) error {
	data, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	if len(data) > 4*1024*1024 {
		return ErrLimit
	}
	f, err := os.CreateTemp(filepath.Dir(file), ".pending-*")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	if _, err = f.Write(append(data, '\n')); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(name, file)
}
func prepareStore(directory string) error {
	for _, part := range []string{"", "inputs", "effects"} {
		if err := os.MkdirAll(filepath.Join(directory, part), 0700); err != nil {
			return err
		}
	}
	return nil
}
func loadJobs(directory string) ([]Job, error) {
	jobs, err := Load(filepath.Join(directory, "jobs.json"))
	if errors.Is(err, os.ErrNotExist) {
		return []Job{}, nil
	}
	return jobs, err
}
func Enqueue(directory string, inputs []Input) error {
	if len(inputs) == 0 || len(inputs) > 10000 {
		return ErrInvalid
	}
	seen := map[string]bool{}
	for _, input := range inputs {
		if _, err := NewJob(input.ID); err != nil {
			return err
		}
		if seen[input.ID] || len(input.Text) > 1000000 {
			return ErrInvalid
		}
		seen[input.ID] = true
	}
	if err := prepareStore(directory); err != nil {
		return err
	}
	return withLedgerLock(directory, func() error {
		jobs, err := loadJobs(directory)
		if err != nil {
			return err
		}
		existing := map[string]bool{}
		for _, job := range jobs {
			existing[job.ID] = true
		}
		for _, input := range inputs {
			file := filepath.Join(directory, "inputs", input.ID+".json")
			var previous Input
			err := readJSON(file, &previous)
			if err == nil && previous != input {
				return fmt.Errorf("%w: input identity %s changed", ErrConflict, input.ID)
			}
			if err != nil && !errors.Is(err, os.ErrNotExist) {
				return err
			}
			if existing[input.ID] {
				if err != nil {
					return fmt.Errorf("missing persisted input for %s", input.ID)
				}
				continue
			}
			if errors.Is(err, os.ErrNotExist) {
				if err = writeAtomic(file, input); err != nil {
					return err
				}
			}
			job, err := NewJob(input.ID)
			if err != nil {
				return err
			}
			jobs = append(jobs, job)
		}
		return Save(filepath.Join(directory, "jobs.json"), jobs)
	})
}
func ClaimNext(directory string, now, ttl int64, maxAttempts int) (*Job, error) {
	var claimed *Job
	err := withLedgerLock(directory, func() error {
		jobs, err := loadJobs(directory)
		if err != nil {
			return err
		}
		for index := range jobs {
			Reclaim(&jobs[index], now)
		}
		for index := range jobs {
			job := &jobs[index]
			if job.State != "queued" || job.Attempts >= maxAttempts {
				continue
			}
			if err = ClaimJob(job, job.Version, now, ttl, maxAttempts); err != nil {
				return err
			}
			copy := *job
			claimed = &copy
			break
		}
		return Save(filepath.Join(directory, "jobs.json"), jobs)
	})
	return claimed, err
}
func CompleteClaim(directory, id string, version int, now int64) error {
	return withLedgerLock(directory, func() error {
		jobs, err := loadJobs(directory)
		if err != nil {
			return err
		}
		for i := range jobs {
			if jobs[i].ID == id {
				if err = Finish(&jobs[i], version, now); err != nil {
					return err
				}
				return Save(filepath.Join(directory, "jobs.json"), jobs)
			}
		}
		return ErrInvalid
	})
}
func localEffect(directory string, job Job) (Receipt, bool, error) {
	var input Input
	if err := readJSON(filepath.Join(directory, "inputs", job.ID+".json"), &input); err != nil {
		return Receipt{}, false, err
	}
	if input.ID != job.ID {
		return Receipt{}, false, ErrConflict
	}
	digest := sha256.Sum256([]byte(input.Text))
	expected := Receipt{ID: job.ID, InputSHA256: hex.EncodeToString(digest[:]), Bytes: len(input.Text), Words: len(strings.Fields(input.Text))}
	file := filepath.Join(directory, "effects", job.ID+".json")
	var existing Receipt
	if err := readJSON(file, &existing); err == nil {
		if existing != expected {
			return Receipt{}, false, ErrConflict
		}
		return existing, true, nil
	} else if !errors.Is(err, os.ErrNotExist) {
		return Receipt{}, false, err
	}
	data, _ := json.Marshal(expected)
	temp, err := os.CreateTemp(filepath.Join(directory, "effects"), ".effect-*")
	if err != nil {
		return Receipt{}, false, err
	}
	name := temp.Name()
	defer os.Remove(name)
	if _, err = temp.Write(append(data, '\n')); err == nil {
		err = temp.Sync()
	}
	closeErr := temp.Close()
	if err != nil {
		return Receipt{}, false, err
	}
	if closeErr != nil {
		return Receipt{}, false, closeErr
	}
	if err = os.Link(name, file); errors.Is(err, os.ErrExist) {
		if err = readJSON(file, &existing); err != nil {
			return Receipt{}, false, err
		}
		if existing != expected {
			return Receipt{}, false, ErrConflict
		}
		return existing, true, nil
	} else if err != nil {
		return Receipt{}, false, err
	}
	return expected, false, nil
}
func Work(directory string, options WorkOptions) ([]WorkEvent, error) {
	if options.Now == nil || options.LeaseMS <= 0 || options.MaxAttempts < 1 || options.MaxJobs < 1 || options.MaxJobs > 10000 || options.Delay < 0 || options.Delay > time.Minute {
		return nil, ErrInvalid
	}
	if options.CrashAfter != "" && options.CrashAfter != "claim" && options.CrashAfter != "effect" {
		return nil, ErrInvalid
	}
	if err := prepareStore(directory); err != nil {
		return nil, err
	}
	events := []WorkEvent{}
	for len(events) < options.MaxJobs {
		job, err := ClaimNext(directory, options.Now(), options.LeaseMS, options.MaxAttempts)
		if err != nil {
			return events, err
		}
		if job == nil {
			break
		}
		if options.CrashAfter == "claim" {
			fmt.Printf("{\"crash_after\":\"claim\",\"id\":%q,\"version\":%d}\n", job.ID, job.Version)
			os.Exit(86)
		}
		time.Sleep(options.Delay)
		_, reused, err := localEffect(directory, *job)
		if err != nil {
			return events, err
		}
		if options.CrashAfter == "effect" {
			fmt.Printf("{\"crash_after\":\"effect\",\"id\":%q,\"version\":%d}\n", job.ID, job.Version)
			os.Exit(86)
		}
		if err = CompleteClaim(directory, job.ID, job.Version, options.Now()); err != nil {
			return events, fmt.Errorf("completion for %s v%d rejected: %w", job.ID, job.Version, err)
		}
		events = append(events, WorkEvent{job.ID, job.Version, reused, "completed"})
	}
	return events, nil
}
func Status(directory string) (map[string]any, error) {
	if err := prepareStore(directory); err != nil {
		return nil, err
	}
	var jobs []Job
	err := withLedgerLock(directory, func() error {
		var err error
		jobs, err = loadJobs(directory)
		return err
	})
	if err != nil {
		return nil, err
	}
	receipts := []Receipt{}
	for _, job := range jobs {
		var receipt Receipt
		err := readJSON(filepath.Join(directory, "effects", job.ID+".json"), &receipt)
		if err == nil {
			receipts = append(receipts, receipt)
		} else if !errors.Is(err, os.ErrNotExist) {
			return nil, err
		}
	}
	return map[string]any{"schema_version": 1, "jobs": jobs, "effects": receipts, "scope": "same-host local POSIX filesystem; immutable local text receipts"}, nil
}
