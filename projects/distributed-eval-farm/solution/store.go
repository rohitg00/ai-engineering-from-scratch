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
)

type EvalCase struct {
	ID       string `json:"id"`
	Prompt   string `json:"prompt"`
	Expected string `json:"expected"`
	Response string `json:"response"`
}
type FarmShard struct {
	Lease   Lease    `json:"lease"`
	CaseIDs []string `json:"case_ids"`
}
type Farm struct {
	SchemaVersion int         `json:"schema_version"`
	DatasetSHA256 string      `json:"dataset_sha256"`
	ShardCount    int         `json:"shard_count"`
	Cases         []EvalCase  `json:"cases"`
	Shards        []FarmShard `json:"shards"`
}
type CaseResult struct {
	ID      string `json:"id"`
	Correct bool   `json:"correct"`
}
type ShardResult struct {
	WorkerPID int          `json:"worker_pid"`
	Cases     []CaseResult `json:"cases"`
	Correct   int          `json:"correct"`
	Total     int          `json:"total"`
}

func readJSON(file string, value any) error {
	f, err := os.Open(file)
	if err != nil {
		return err
	}
	defer f.Close()
	raw, err := io.ReadAll(io.LimitReader(f, 4*1024*1024+1))
	if err != nil {
		return err
	}
	if len(raw) > 4*1024*1024 {
		return ErrLimit
	}
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.DisallowUnknownFields()
	if err = decoder.Decode(value); err != nil {
		return err
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return ErrInvalid
	}
	return nil
}
func writeFarm(directory string, farm Farm) error {
	raw, err := json.MarshalIndent(farm, "", "  ")
	if err != nil {
		return err
	}
	if len(raw) > 4*1024*1024 {
		return ErrLimit
	}
	file, err := os.CreateTemp(directory, ".farm-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(append(raw, '\n')); err == nil {
		err = file.Sync()
	}
	closeErr := file.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(name, filepath.Join(directory, "farm.json"))
}
func caseDigest(cases []EvalCase) string {
	raw, _ := json.Marshal(cases)
	digest := sha256.Sum256(raw)
	return hex.EncodeToString(digest[:])
}
func validateCases(cases []EvalCase, shards int) ([][]string, error) {
	if len(cases) == 0 || len(cases) > 10000 {
		return nil, ErrInvalid
	}
	ids := make([]string, len(cases))
	for i, c := range cases {
		if len(c.ID) > 256 || len(c.Prompt) > 100000 || c.Expected == "" || len(c.Expected) > 100000 || len(c.Response) > 100000 {
			return nil, ErrInvalid
		}
		ids[i] = c.ID
	}
	return Partition(ids, shards)
}
func validateFarm(farm Farm) error {
	parts, err := validateCases(farm.Cases, farm.ShardCount)
	if err != nil {
		return err
	}
	if farm.SchemaVersion != 1 || farm.DatasetSHA256 != caseDigest(farm.Cases) {
		return ErrConflict
	}
	active := 0
	for index, ids := range parts {
		if len(ids) == 0 {
			continue
		}
		if active >= len(farm.Shards) {
			return ErrInvalid
		}
		s := farm.Shards[active]
		active++
		if s.Lease.Shard != fmt.Sprintf("shard-%d", index) || len(ids) != len(s.CaseIDs) {
			return ErrInvalid
		}
		for i, id := range ids {
			if s.CaseIDs[i] != id {
				return ErrConflict
			}
		}
		l := s.Lease
		if l.Version < 0 || l.Until < 0 || (l.Worker == "" && (l.Version != 0 || l.Until != 0 || l.Done || l.Result != "")) || (l.Worker != "" && (l.Version < 1 || l.Until <= 0)) {
			return ErrInvalid
		}
		if l.Done {
			var receipt ShardResult
			if err = json.Unmarshal([]byte(l.Result), &receipt); err != nil {
				return err
			}
			if receipt.Total != len(ids) || receipt.WorkerPID <= 0 || len(receipt.Cases) != len(ids) {
				return ErrInvalid
			}
			correct := 0
			for i, result := range receipt.Cases {
				if result.ID != ids[i] {
					return ErrConflict
				}
				if result.Correct {
					correct++
				}
			}
			if receipt.Correct != correct {
				return ErrConflict
			}
		} else if l.Result != "" {
			return ErrInvalid
		}
	}
	if active != len(farm.Shards) {
		return ErrInvalid
	}
	return nil
}
func loadFarm(directory string) (Farm, error) {
	var farm Farm
	if err := readJSON(filepath.Join(directory, "farm.json"), &farm); err != nil {
		return farm, err
	}
	return farm, validateFarm(farm)
}
func InitFarm(directory string, cases []EvalCase, shards int) error {
	parts, err := validateCases(cases, shards)
	if err != nil {
		return err
	}
	if err = os.MkdirAll(directory, 0700); err != nil {
		return err
	}
	return withLedgerLock(directory, func() error {
		current, err := loadFarm(directory)
		if err == nil {
			if current.DatasetSHA256 == caseDigest(cases) && current.ShardCount == shards {
				return nil
			}
			return fmt.Errorf("%w: dataset or shard count changed; choose a new store", ErrConflict)
		}
		if !errors.Is(err, os.ErrNotExist) {
			return err
		}
		farm := Farm{SchemaVersion: 1, DatasetSHA256: caseDigest(cases), ShardCount: shards, Cases: cases, Shards: []FarmShard{}}
		for i, ids := range parts {
			if len(ids) > 0 {
				farm.Shards = append(farm.Shards, FarmShard{Lease: Lease{Shard: fmt.Sprintf("shard-%d", i)}, CaseIDs: ids})
			}
		}
		return writeFarm(directory, farm)
	})
}
func ClaimShard(directory, worker string, now, ttl int64) (*FarmShard, []EvalCase, error) {
	var claimed *FarmShard
	var cases []EvalCase
	err := withLedgerLock(directory, func() error {
		farm, err := loadFarm(directory)
		if err != nil {
			return err
		}
		for i := range farm.Shards {
			s := &farm.Shards[i]
			if s.Lease.Done || (s.Lease.Worker != "" && now < s.Lease.Until) {
				continue
			}
			if err = Acquire(&s.Lease, worker, now, ttl); err != nil {
				return err
			}
			copy := *s
			claimed = &copy
			byID := map[string]EvalCase{}
			for _, c := range farm.Cases {
				byID[c.ID] = c
			}
			for _, id := range s.CaseIDs {
				cases = append(cases, byID[id])
			}
			return writeFarm(directory, farm)
		}
		return nil
	})
	return claimed, cases, err
}
func CompleteShard(directory string, claim FarmShard, now int64, result ShardResult) error {
	return withLedgerLock(directory, func() error {
		farm, err := loadFarm(directory)
		if err != nil {
			return err
		}
		raw, err := json.Marshal(result)
		if err != nil {
			return err
		}
		for i := range farm.Shards {
			l := &farm.Shards[i].Lease
			if l.Shard == claim.Lease.Shard {
				if err = Submit(l, claim.Lease.Worker, claim.Lease.Version, now, string(raw)); err != nil {
					return err
				}
				if err = validateFarm(farm); err != nil {
					return err
				}
				return writeFarm(directory, farm)
			}
		}
		return ErrInvalid
	})
}
func FarmStatus(directory string) (map[string]any, error) {
	var farm Farm
	err := withLedgerLock(directory, func() error {
		var err error
		farm, err = loadFarm(directory)
		return err
	})
	if err != nil {
		return nil, err
	}
	completed, correct, total := 0, 0, 0
	pids := map[int]bool{}
	receipts := []ShardResult{}
	for _, s := range farm.Shards {
		if s.Lease.Done {
			var receipt ShardResult
			json.Unmarshal([]byte(s.Lease.Result), &receipt)
			receipts = append(receipts, receipt)
			completed++
			correct += receipt.Correct
			total += receipt.Total
			pids[receipt.WorkerPID] = true
		}
	}
	return map[string]any{"schema_version": 1, "dataset_sha256": farm.DatasetSHA256, "complete": completed == len(farm.Shards), "completed_shards": completed, "active_shards": len(farm.Shards), "correct": correct, "evaluated": total, "dataset_cases": len(farm.Cases), "worker_processes": len(pids), "shards": farm.Shards, "receipts": receipts, "scope": "same-host POSIX processes evaluating supplied recorded predictions"}, nil
}
