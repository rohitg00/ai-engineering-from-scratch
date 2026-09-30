package main

import (
	"testing"
)

func TestSupported(t *testing.T) {
	if e := Verify(Claim{"latency rose", []string{"a"}}, []Event{{ID: "a"}}); e != nil {
		t.Fatal(e)
	}
}
func TestDangling(t *testing.T) {
	if e := Verify(Claim{"x", []string{"missing"}}, []Event{{ID: "a"}}); e == nil {
		t.Fatal("dangling accepted")
	}
}
func TestNoEvidence(t *testing.T) {
	if e := Verify(Claim{Text: "x"}, nil); e == nil {
		t.Fatal("uncited accepted")
	}
}
func TestDuplicate(t *testing.T) {
	if e := Verify(Claim{"x", []string{"a", "a"}}, []Event{{ID: "a"}}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestBlank(t *testing.T) {
	if e := Verify(Claim{" ", []string{"a"}}, []Event{{ID: "a"}}); e == nil {
		t.Fatal("blank accepted")
	}
}
