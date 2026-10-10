package main

import (
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestSharedReplayCap(t *testing.T) {
	r, _ := Replay(20, 100, 5, Policy{10, 80, 4, true, 7}, 12)
	if r.Calls != 32 || r.Retries != 12 {
		t.Fatal(r)
	}
}
func TestBudgetConcurrent(t *testing.T) {
	b := NewBudget(7)
	var wg sync.WaitGroup
	var count atomic.Int32
	for i := 0; i < 50; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if b.Take() {
				count.Add(1)
			}
		}()
	}
	wg.Wait()
	if count.Load() != 7 {
		t.Fatal(count.Load())
	}
}
func TestSeconds(t *testing.T) {
	d, e := ServerDelay("2", time.Now())
	if e != nil || d != 2*time.Second {
		t.Fatal(d, e)
	}
}
func TestHTTPDate(t *testing.T) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	d, e := ServerDelay(now.Add(3*time.Second).Format(http.TimeFormat), now)
	if e != nil || d != 3*time.Second {
		t.Fatal(d, e)
	}
}
func TestMalformedDelay(t *testing.T) {
	if _, e := ServerDelay("-2", time.Now()); e == nil {
		t.Fatal("negative accepted")
	}
}
