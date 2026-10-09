package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func fixture() Bundle {
	var b Bundle
	b.ObservedAt = "2026-01-02T00:00:00Z"
	b.Events.Items = []Event{{Metadata: Metadata{UID: "e1"}, Object: ObjectRef{UID: "p1", Name: "pod"}, Reason: "Failed", Type: "Warning", Count: 2, First: "2026-01-01T00:00:00Z", Last: "2026-01-01T00:01:00Z"}}
	b.Workloads.Items = []Workload{}
	return b
}

func TestSchema(t *testing.T) {
	p, e := Export(fixture())
	if e != nil || p.SchemaVersion != 1 || len(p.Rows) != 1 {
		t.Fatal(p, e)
	}
}
func TestObservation(t *testing.T) {
	p, _ := Export(fixture())
	if p.Rows[0].ObservedAt == p.Rows[0].First {
		t.Fatal("clocks conflated")
	}
}
func TestRedactions(t *testing.T) {
	p, _ := Export(fixture())
	if len(p.Redactions) != 2 {
		t.Fatal(p)
	}
}
func TestEmptyPack(t *testing.T) {
	b := fixture()
	b.Events.Items = []Event{}
	p, _ := Export(b)
	x, _ := json.Marshal(p)
	if !strings.Contains(string(x), `"rows":[]`) {
		t.Fatal(string(x))
	}
}
func TestErrorPropagation(t *testing.T) {
	b := fixture()
	e := b.Events.Items[0]
	e.Type = "Normal"
	b.Events.Items = append(b.Events.Items, e)
	if _, err := Export(b); err == nil {
		t.Fatal("conflict lost")
	}
}
