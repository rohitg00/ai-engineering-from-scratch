package main

import (
	"testing"
)

func TestFinish(t *testing.T) {
	j, _ := NewJob("a")
	ClaimJob(&j, 0, 0, 10, 3)
	if e := Finish(&j, 1, 9); e != nil || j.State != "completed" {
		t.Fatal(j, e)
	}
}
func TestExpiryBoundary(t *testing.T) {
	j, _ := NewJob("a")
	ClaimJob(&j, 0, 0, 10, 3)
	if e := Finish(&j, 1, 10); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestReclaim(t *testing.T) {
	j, _ := NewJob("a")
	ClaimJob(&j, 0, 0, 10, 3)
	if !Reclaim(&j, 10) || j.Version != 2 || j.Attempts != 1 {
		t.Fatal(j)
	}
}
func TestEarly(t *testing.T) {
	j, _ := NewJob("a")
	ClaimJob(&j, 0, 0, 10, 3)
	if Reclaim(&j, 9) {
		t.Fatal(j)
	}
}
func TestFenced(t *testing.T) {
	j, _ := NewJob("a")
	ClaimJob(&j, 0, 0, 10, 3)
	Reclaim(&j, 10)
	ClaimJob(&j, 2, 10, 10, 3)
	if e := Finish(&j, 1, 11); e != ErrConflict {
		t.Fatal(e)
	}
}
