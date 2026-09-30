package main

import (
	"testing"
)

func TestComplete(t *testing.T) {
	l := Lease{Shard: "s"}
	Acquire(&l, "w", 0, 10)
	if e := Submit(&l, "w", 1, 1, "score=1"); e != nil || !l.Done {
		t.Fatal(l, e)
	}
}
func TestDuplicate(t *testing.T) {
	l := Lease{Shard: "s"}
	Acquire(&l, "w", 0, 10)
	Submit(&l, "w", 1, 1, "x")
	if e := Submit(&l, "w", 1, 20, "x"); e != nil {
		t.Fatal(e)
	}
}
func TestConflict(t *testing.T) {
	l := Lease{Shard: "s"}
	Acquire(&l, "w", 0, 10)
	Submit(&l, "w", 1, 1, "x")
	if e := Submit(&l, "w", 1, 2, "y"); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestStale(t *testing.T) {
	l := Lease{Shard: "s"}
	Acquire(&l, "old", 0, 10)
	Acquire(&l, "new", 10, 10)
	if e := Submit(&l, "old", 1, 11, "x"); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestExpired(t *testing.T) {
	l := Lease{Shard: "s"}
	Acquire(&l, "w", 0, 10)
	if e := Submit(&l, "w", 1, 10, "x"); e != ErrConflict {
		t.Fatal(e)
	}
}
