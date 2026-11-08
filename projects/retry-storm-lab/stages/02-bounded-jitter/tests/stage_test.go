package main

import (
	"testing"
)

func TestDoubling(t *testing.T) {
	p := Policy{10, 25, 4, false, 0}
	for i, w := range []int{10, 20, 25, 25} {
		if Delay(p, 0, i+1) != w {
			t.Fatal(i)
		}
	}
}
func TestJitterBound(t *testing.T) {
	p := Policy{10, 20, 4, true, 9}
	for i := 0; i < 100; i++ {
		d := Delay(p, i, 2)
		if d < 0 || d > 20 {
			t.Fatal(d)
		}
	}
}
func TestRepeatable(t *testing.T) {
	p := Policy{10, 20, 4, true, 3}
	if Delay(p, 7, 2) != Delay(p, 7, 2) {
		t.Fatal("not deterministic")
	}
}
func TestClientSpread(t *testing.T) {
	p := Policy{20, 20, 4, true, 3}
	seen := map[int]bool{}
	for i := 0; i < 20; i++ {
		seen[Delay(p, i, 1)] = true
	}
	if len(seen) < 2 {
		t.Fatal("synchronized")
	}
}
func TestInvalidPolicy(t *testing.T) {
	if Validate(Policy{0, 20, 4, true, 0}) == nil || Validate(Policy{10, 20, 11, true, 0}) == nil {
		t.Fatal("invalid policy")
	}
}
