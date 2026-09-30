package main

import (
	"testing"
)

func TestCorrect(t *testing.T) {
	r, e := Evaluate("fixture", []Case{{Prompt: "p", Expected: "x"}}, func(string) (string, error) { return "x", nil }, 1)
	if e != nil || r.Correct != 1 {
		t.Fatal(r, e)
	}
}
func TestErrorsCount(t *testing.T) {
	r, _ := Evaluate("fixture", []Case{{Prompt: "p", Expected: "x"}}, func(string) (string, error) { return "", ErrInvalid }, 1)
	if r.Attempted != 1 || r.Errors != 1 {
		t.Fatal(r)
	}
}
func TestBudget(t *testing.T) {
	r, _ := Evaluate("fixture", []Case{{Expected: "x"}, {Expected: "x"}}, func(string) (string, error) { return "x", nil }, 1)
	if r.Total != 2 || r.State != "budget-exhausted" {
		t.Fatal(r)
	}
}
func TestNoCalls(t *testing.T) {
	n := 0
	r, _ := Evaluate("fixture", []Case{{Expected: "x"}}, func(string) (string, error) { n++; return "x", nil }, 0)
	if n != 0 || r.Attempted != 0 {
		t.Fatal(r)
	}
}
func TestPromptOnly(t *testing.T) {
	_, e := Evaluate("fixture", []Case{{Prompt: "visible", Expected: "hidden"}}, func(p string) (string, error) {
		if p != "visible" {
			t.Fatal(p)
		}
		return "x", nil
	}, 1)
	if e != nil {
		t.Fatal(e)
	}
}
