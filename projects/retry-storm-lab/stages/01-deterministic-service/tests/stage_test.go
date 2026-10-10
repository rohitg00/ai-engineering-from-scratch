package main

import (
	"testing"
)

func TestSingleAttempt(t *testing.T) {
	r, e := Replay(3, 0, 2, Policy{10, 10, 1, false, 0}, 100)
	if e != nil || r.Calls != 3 || r.Successes != 2 {
		t.Fatal(r, e)
	}
}
func TestFailureWindow(t *testing.T) {
	r, _ := Replay(2, 50, 10, Policy{10, 10, 1, false, 0}, 100)
	if r.Successes != 0 {
		t.Fatal(r)
	}
}
func TestEmpty(t *testing.T) {
	r, e := Replay(0, 0, 1, Policy{10, 10, 1, false, 0}, 100)
	if e != nil || r.Calls != 0 {
		t.Fatal(r, e)
	}
}
func TestInvalidCapacity(t *testing.T) {
	if _, e := Replay(1, 0, 0, Policy{10, 10, 1, false, 0}, 100); e == nil {
		t.Fatal("zero capacity")
	}
}
func TestInitialOrder(t *testing.T) {
	r, _ := Replay(4, 0, 4, Policy{10, 10, 1, false, 0}, 100)
	for i, a := range r.Timeline {
		if a.Client != i || a.AtMS != 0 || a.Number != 1 {
			t.Fatal(r)
		}
	}
}
