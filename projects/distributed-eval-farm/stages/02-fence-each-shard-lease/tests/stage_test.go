package main

import (
	"testing"
)

func TestClaim(t *testing.T) {
	l := Lease{Shard: "s1"}
	if e := Acquire(&l, "w1", 0, 10); e != nil || l.Version != 1 {
		t.Fatal(l, e)
	}
}
func TestBusy(t *testing.T) {
	l := Lease{Shard: "s1"}
	Acquire(&l, "w1", 0, 10)
	if e := Acquire(&l, "w2", 9, 10); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestExpiry(t *testing.T) {
	l := Lease{Shard: "s1"}
	Acquire(&l, "w1", 0, 10)
	if e := Acquire(&l, "w2", 10, 10); e != nil || l.Version != 2 {
		t.Fatal(l, e)
	}
}
func TestDone(t *testing.T) {
	l := Lease{Shard: "s1", Done: true}
	if e := Acquire(&l, "w1", 0, 10); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestEmptyWorker(t *testing.T) {
	l := Lease{Shard: "s1"}
	if e := Acquire(&l, "", 0, 10); e != ErrInvalid {
		t.Fatal(e)
	}
}
