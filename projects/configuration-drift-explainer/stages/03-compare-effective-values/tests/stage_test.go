package main

import (
	"testing"
)

func TestChanged(t *testing.T) {
	r := Compare(Input{Layers: []Layer{{"a", map[string]any{"x": 1.0}}}, Observed: map[string]any{"x": 2.0}})
	if !r.Drift || r.Changes[0].Kind != "changed" {
		t.Fatal(r)
	}
}
func TestMissingNull(t *testing.T) {
	r := Compare(Input{Layers: []Layer{{"a", map[string]any{"x": nil}}}, Observed: map[string]any{}})
	if r.Changes[0].Kind != "missing" {
		t.Fatal(r)
	}
}
func TestUnexpectedSecret(t *testing.T) {
	r := Compare(Input{Observed: map[string]any{"api-key": "private"}})
	if r.Changes[0].Observed != "[REDACTED]" || r.Changes[0].Kind != "unexpected" {
		t.Fatal(r)
	}
}
func TestEqualSecret(t *testing.T) {
	r := Compare(Input{Layers: []Layer{{"a", map[string]any{"password": "same"}}}, Observed: map[string]any{"password": "same"}})
	if r.Drift || r.Changes[0].History[0].Value != "[REDACTED]" {
		t.Fatal(r)
	}
}
func TestSortedAndExplicit(t *testing.T) {
	r := Compare(Input{Observed: map[string]any{"z": false, "opaque": "hide"}, Sensitive: []string{"opaque"}})
	if r.Changes[0].Key != "opaque" || !r.Changes[0].Redacted {
		t.Fatal(r)
	}
}
