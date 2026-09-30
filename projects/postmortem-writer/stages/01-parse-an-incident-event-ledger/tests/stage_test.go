package main

import (
	"testing"
)

func TestValid(t *testing.T) {
	v, e := Parse("e1\t12\talert\tlatency high")
	if e != nil || v[0].Second != 12 {
		t.Fatal(v, e)
	}
}
func TestNegative(t *testing.T) {
	if _, e := Parse("e1\t-1\talert\tx"); e == nil {
		t.Fatal("accepted negative")
	}
}
func TestDuplicate(t *testing.T) {
	if _, e := Parse("e1\t1\ta\tx\ne1\t2\ta\ty"); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestMissing(t *testing.T) {
	if _, e := Parse("e1\t2\talert"); e == nil {
		t.Fatal("missing message")
	}
}
func TestEmpty(t *testing.T) {
	v, e := Parse("")
	if e != nil || len(v) != 0 {
		t.Fatal(v, e)
	}
}
