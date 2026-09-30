package main

import (
	"testing"
)

func TestFeatures(t *testing.T) {
	v, _ := Group([]Commit{{Hash: "a", Subject: "feat: cache"}})
	if len(v["Features"]) != 1 {
		t.Fatal(v)
	}
}
func TestBreakingFirst(t *testing.T) {
	v, _ := Group([]Commit{{Subject: "fix!: incompatible"}})
	if len(v["Breaking changes"]) != 1 {
		t.Fatal(v)
	}
}
func TestStable(t *testing.T) {
	v, _ := Group([]Commit{{Hash: "b", Subject: "fix: b"}, {Hash: "a", Subject: "fix: a"}})
	if v["Fixes"][0].Hash != "a" {
		t.Fatal(v)
	}
}
func TestUnknown(t *testing.T) {
	v, _ := Group([]Commit{{Subject: "chore: tidy"}})
	if len(v["Other"]) != 1 {
		t.Fatal(v)
	}
}
func TestEmpty(t *testing.T) {
	v, e := Group(nil)
	if e != nil || len(v) != 0 {
		t.Fatal(v, e)
	}
}
