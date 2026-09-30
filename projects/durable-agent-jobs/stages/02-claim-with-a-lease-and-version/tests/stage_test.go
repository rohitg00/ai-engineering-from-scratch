package main

import (
	"testing"
)

func TestClaim(t *testing.T) {
	j, _ := NewJob("a")
	if e := ClaimJob(&j, 0, 10, 5, 3); e != nil || j.Version != 1 || j.LeaseUntil != 15 {
		t.Fatal(j, e)
	}
}
func TestStale(t *testing.T) {
	j, _ := NewJob("a")
	if e := ClaimJob(&j, 1, 0, 5, 3); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestAlreadyRunning(t *testing.T) {
	j, _ := NewJob("a")
	ClaimJob(&j, 0, 0, 5, 3)
	if e := ClaimJob(&j, 1, 0, 5, 3); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestAttemptLimit(t *testing.T) {
	j, _ := NewJob("a")
	if e := ClaimJob(&j, 0, 0, 5, 0); e != ErrLimit || j.State != "queued" {
		t.Fatal(j, e)
	}
}
func TestBadLease(t *testing.T) {
	j, _ := NewJob("a")
	if e := ClaimJob(&j, 0, 0, 0, 3); e != ErrInvalid {
		t.Fatal(e)
	}
}
