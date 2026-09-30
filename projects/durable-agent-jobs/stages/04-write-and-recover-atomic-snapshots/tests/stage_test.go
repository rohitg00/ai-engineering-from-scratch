package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRoundtrip(t *testing.T) {
	p := filepath.Join(t.TempDir(), "jobs.json")
	j, _ := NewJob("a")
	if e := Save(p, []Job{j}); e != nil {
		t.Fatal(e)
	}
	v, e := Load(p)
	if e != nil || len(v) != 1 || v[0] != j {
		t.Fatal(v, e)
	}
}
func TestDuplicate(t *testing.T) {
	j, _ := NewJob("a")
	if e := Save(filepath.Join(t.TempDir(), "jobs.json"), []Job{j, j}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestTruncated(t *testing.T) {
	p := filepath.Join(t.TempDir(), "jobs.json")
	os.WriteFile(p, []byte(`[{`), 0600)
	if _, e := Load(p); e == nil {
		t.Fatal("truncated")
	}
}
func TestUnknownField(t *testing.T) {
	p := filepath.Join(t.TempDir(), "jobs.json")
	os.WriteFile(p, []byte(`[{"ID":"a","State":"queued","secret":1}]`), 0600)
	if _, e := Load(p); e == nil {
		t.Fatal("unknown field")
	}
}
func TestPreserveOnInvalid(t *testing.T) {
	p := filepath.Join(t.TempDir(), "jobs.json")
	j, _ := NewJob("a")
	Save(p, []Job{j})
	if e := Save(p, []Job{{ID: "bad/"}}); e == nil {
		t.Fatal("invalid")
	}
	v, _ := Load(p)
	if len(v) != 1 || v[0].ID != "a" {
		t.Fatal(v)
	}
}

func TestOversizedSnapshotIsRejected(t *testing.T) {
	file := filepath.Join(t.TempDir(), "jobs.json")
	if err := os.WriteFile(file, []byte("[]"), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Truncate(file, 4*1024*1024+1); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(file); err != ErrLimit {
		t.Fatal(err)
	}
}
