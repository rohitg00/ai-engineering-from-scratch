package main

import (
	"testing"
)

func TestFeature(t *testing.T) {
	v, e := Classify(Commit{Subject: "feat: cache"})
	if e != nil || v.Kind != "feat" {
		t.Fatal(v, e)
	}
}
func TestScope(t *testing.T) {
	v, _ := Classify(Commit{Subject: "fix(api): timeout"})
	if v.Scope != "api" {
		t.Fatal(v)
	}
}
func TestBreaking(t *testing.T) {
	v, _ := Classify(Commit{Subject: "feat!: remove legacy"})
	if !v.Breaking {
		t.Fatal(v)
	}
}
func TestOther(t *testing.T) {
	v, _ := Classify(Commit{Subject: "Merge branch useful"})
	if v.Kind != "other" {
		t.Fatal(v)
	}
}
func TestBlank(t *testing.T) {
	if _, e := Classify(Commit{}); e == nil {
		t.Fatal("blank")
	}
}
