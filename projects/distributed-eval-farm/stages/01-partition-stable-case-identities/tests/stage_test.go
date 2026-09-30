package main

import (
	"fmt"
	"testing"
)

func TestOnce(t *testing.T) {
	v, e := Partition([]string{"a", "b", "c"}, 2)
	if e != nil || len(v[0])+len(v[1]) != 3 {
		t.Fatal(v, e)
	}
}
func TestDeterministic(t *testing.T) {
	a, _ := Partition([]string{"a"}, 3)
	b, _ := Partition([]string{"a"}, 3)
	if fmt.Sprint(a) != fmt.Sprint(b) {
		t.Fatal(a, b)
	}
}
func TestDuplicate(t *testing.T) {
	if _, e := Partition([]string{"a", "a"}, 2); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestZero(t *testing.T) {
	if _, e := Partition([]string{"a"}, 0); e == nil {
		t.Fatal("zero shards")
	}
}
func TestEmptyID(t *testing.T) {
	if _, e := Partition([]string{""}, 2); e == nil {
		t.Fatal("empty id")
	}
}
