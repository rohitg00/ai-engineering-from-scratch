package main

import (
	"bytes"
	"encoding/json"
	"testing"
)

func TestExportSchema(t *testing.T) {
	b, e := Export(Input{Observed: map[string]any{}})
	var r Report
	if e != nil || json.Unmarshal(b, &r) != nil || r.SchemaVersion != 1 {
		t.Fatal(string(b), e)
	}
}
func TestNoCurrentSecret(t *testing.T) {
	b, _ := Export(Input{Observed: map[string]any{"TOKEN": "held-out-secret"}})
	if bytes.Contains(b, []byte("held-out-secret")) {
		t.Fatal(string(b))
	}
}
func TestNoHistoricSecret(t *testing.T) {
	b, _ := Export(Input{Layers: []Layer{{"base", map[string]any{"password": "ancient"}}, {"override", map[string]any{"password": "latest"}}}, Observed: map[string]any{}})
	if bytes.Contains(b, []byte("ancient")) || bytes.Contains(b, []byte("latest")) {
		t.Fatal(string(b))
	}
}
func TestConsumer(t *testing.T) {
	b, _ := Export(Input{Layers: []Layer{{"base", map[string]any{"timeout": 4.0}}}, Observed: map[string]any{"timeout": 5.0}})
	var r Report
	json.Unmarshal(b, &r)
	if !r.Drift || r.Changes[0].History[0].Layer != "base" {
		t.Fatal(r)
	}
}
func TestStable(t *testing.T) {
	in := Input{Observed: map[string]any{"b": 2.0, "a": 1.0}}
	a, _ := Export(in)
	b, _ := Export(in)
	if !bytes.Equal(a, b) {
		t.Fatal("nondeterministic")
	}
}
