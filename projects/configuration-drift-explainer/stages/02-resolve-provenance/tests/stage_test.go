package main

import (
	"testing"
)

func TestLaterWins(t *testing.T) {
	r := Resolve([]Layer{{"a", map[string]any{"x": 1.0}}, {"b", map[string]any{"x": 2.0}}})
	if r["x"].Value != 2.0 {
		t.Fatal(r)
	}
}
func TestHistory(t *testing.T) {
	r := Resolve([]Layer{{"a", map[string]any{"x": 1.0}}, {"b", map[string]any{"x": 2.0}}})
	if len(r["x"].History) != 2 || r["x"].History[0].Layer != "a" {
		t.Fatal(r)
	}
}
func TestNullOverride(t *testing.T) {
	r := Resolve([]Layer{{"a", map[string]any{"x": true}}, {"b", map[string]any{"x": nil}}})
	if r["x"].Value != nil || len(r["x"].History) != 2 {
		t.Fatal(r)
	}
}
func TestUntouched(t *testing.T) {
	r := Resolve([]Layer{{"a", map[string]any{"held-out": "north"}}, {"b", map[string]any{}}})
	if r["held-out"].Value != "north" {
		t.Fatal(r)
	}
}
func TestEmpty(t *testing.T) {
	if len(Resolve(nil)) != 0 {
		t.Fatal("not empty")
	}
}
