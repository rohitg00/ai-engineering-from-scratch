package main

import (
	"strings"
	"testing"
)

func TestOutput(t *testing.T) {
	s, e := Release("v1.2", []Commit{{Hash: "abc1234", Subject: "feat: cache"}}, 2)
	if e != nil || !strings.Contains(s, "## Features") {
		t.Fatal(s, e)
	}
}
func TestBadLabel(t *testing.T) {
	if _, e := Release("x\n# injected", nil, 2); e == nil {
		t.Fatal("injected label")
	}
}
func TestLimit(t *testing.T) {
	if _, e := Release("v1", []Commit{{Subject: "fix: x"}}, 0); e != ErrLimit {
		t.Fatal(e)
	}
}
func TestEscape(t *testing.T) {
	s, _ := Release("v1", []Commit{{Subject: "fix: [x](bad)"}}, 2)
	if !strings.Contains(s, `\[x\]`) {
		t.Fatal(s)
	}
}
func TestSectionOrder(t *testing.T) {
	s, _ := Release("v1", []Commit{{Subject: "fix: bug"}, {Subject: "feat: add"}}, 2)
	if strings.Index(s, "Features") > strings.Index(s, "Fixes") {
		t.Fatal(s)
	}
}
