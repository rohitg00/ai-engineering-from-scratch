package main

import (
	"bytes"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
)

func ValidateJobs(jobs []Job) error {
	seen := map[string]bool{}
	for _, j := range jobs {
		if _, e := NewJob(j.ID); e != nil {
			return e
		}
		if seen[j.ID] {
			return ErrConflict
		}
		seen[j.ID] = true
		if j.Version < 0 || j.Attempts < 0 || (j.State != "queued" && j.State != "running" && j.State != "completed") || (j.State == "running" && j.LeaseUntil <= 0) {
			return ErrInvalid
		}
	}
	return nil
}
func Save(file string, jobs []Job) error {
	if e := ValidateJobs(jobs); e != nil {
		return e
	}
	data, e := json.Marshal(jobs)
	if e != nil {
		return e
	}
	if len(data) > 4*1024*1024 {
		return ErrLimit
	}
	f, e := os.CreateTemp(filepath.Dir(file), ".jobs-*.tmp")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(data); e == nil {
		e = f.Sync()
	}
	closeErr := f.Close()
	if e != nil {
		return e
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(name, file)
}
func Load(file string) ([]Job, error) {
	f, e := os.Open(file)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, 4*1024*1024+1))
	if e != nil {
		return nil, e
	}
	if len(data) > 4*1024*1024 {
		return nil, ErrLimit
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var jobs []Job
	if e = decoder.Decode(&jobs); e != nil {
		return nil, e
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return nil, ErrInvalid
	}
	return jobs, ValidateJobs(jobs)
}
