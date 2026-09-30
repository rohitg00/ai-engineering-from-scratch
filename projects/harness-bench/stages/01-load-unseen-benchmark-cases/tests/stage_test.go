package main

import (
	"testing"
)

func TestValid(t *testing.T) {
	v, e := Cases([]byte(`[{"ID":"a","Prompt":"p","Expected":"x"}]`), 1)
	if e != nil || len(v) != 1 {
		t.Fatal(v, e)
	}
}
func TestUnknown(t *testing.T) {
	if _, e := Cases([]byte(`[{"ID":"a","Prompt":"p","Expected":"x","leak":true}]`), 2); e == nil {
		t.Fatal("unknown")
	}
}
func TestDuplicate(t *testing.T) {
	if _, e := Cases([]byte(`[{"ID":"a","Prompt":"p","Expected":"x"},{"ID":"a","Prompt":"q","Expected":"y"}]`), 2); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestBound(t *testing.T) {
	if _, e := Cases([]byte(`[{}]`), 0); e != ErrLimit {
		t.Fatal(e)
	}
}
func TestMissing(t *testing.T) {
	if _, e := Cases([]byte(`[{"ID":"a","Prompt":"p"}]`), 2); e == nil {
		t.Fatal("missing expected")
	}
}
