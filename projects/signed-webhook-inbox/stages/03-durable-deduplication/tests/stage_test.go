package main

import (
	"errors"
	"os"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPersistAndReopen(t *testing.T) {
	dir := t.TempDir()
	x, new, e := Accept(dir, "d1", []byte("raw"), time.Now())
	if e != nil || !new {
		t.Fatal(x, e)
	}
	y, e := LoadEntry(dir, "d1")
	if e != nil || string(y.Body) != "raw" || y.SHA256 != x.SHA256 {
		t.Fatal(y, e)
	}
}
func TestRetryPreservesTimestamp(t *testing.T) {
	dir := t.TempDir()
	a, _, _ := Accept(dir, "d1", []byte("raw"), time.Unix(1, 0))
	b, new, e := Accept(dir, "d1", []byte("raw"), time.Unix(2, 0))
	if e != nil || new || a.AcceptedAt != b.AcceptedAt {
		t.Fatal(a, b, new, e)
	}
}
func TestConflict(t *testing.T) {
	dir := t.TempDir()
	Accept(dir, "d1", []byte("old"), time.Now())
	if _, _, e := Accept(dir, "d1", []byte("new"), time.Now()); !errors.Is(e, ErrConflict) {
		t.Fatal(e)
	}
}
func TestConcurrentIdentity(t *testing.T) {
	dir := t.TempDir()
	var wg sync.WaitGroup
	var fresh atomic.Int32
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, created, e := Accept(dir, "same", []byte("raw"), time.Now())
			if e != nil {
				t.Error(e)
			}
			if created {
				fresh.Add(1)
			}
		}()
	}
	wg.Wait()
	if fresh.Load() != 1 {
		t.Fatal(fresh.Load())
	}
}
func TestCorruption(t *testing.T) {
	dir := t.TempDir()
	Accept(dir, "d1", []byte("raw"), time.Now())
	os.WriteFile(entryPath(dir, "d1"), []byte(`{"schemaVersion":1,"deliveryId":"d1","body":"eA==","sha256":"wrong"}`), 0600)
	if _, e := LoadEntry(dir, "d1"); e == nil {
		t.Fatal("corruption accepted")
	}
}
func TestPermissions(t *testing.T) {
	dir := t.TempDir()
	Accept(dir, "d1", []byte("raw"), time.Now())
	s, e := os.Stat(entryPath(dir, "d1"))
	if e != nil || s.Mode().Perm() != 0600 {
		t.Fatal(s, e)
	}
}
