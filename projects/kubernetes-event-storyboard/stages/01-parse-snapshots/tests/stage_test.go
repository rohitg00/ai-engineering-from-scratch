package main

import (
	"encoding/json"
	"testing"
)

func fixture() Bundle {
	var b Bundle
	b.ObservedAt = "2026-01-02T00:00:00Z"
	b.Events.Items = []Event{{Metadata: Metadata{UID: "e1"}, Object: ObjectRef{UID: "p1", Name: "pod"}, Reason: "Failed", Type: "Warning", Count: 2, First: "2026-01-01T00:00:00Z", Last: "2026-01-01T00:01:00Z"}}
	b.Workloads.Items = []Workload{}
	return b
}

func TestParse(t *testing.T) {
	x, _ := json.Marshal(fixture())
	b, e := Parse(x)
	if e != nil || b.Events.Items[0].Count != 2 {
		t.Fatal(b, e)
	}
}
func TestBadTime(t *testing.T) {
	b := fixture()
	b.ObservedAt = "yesterday"
	x, _ := json.Marshal(b)
	if _, e := Parse(x); e == nil {
		t.Fatal("bad timestamp")
	}
}
func TestRequiredUID(t *testing.T) {
	b := fixture()
	b.Events.Items[0].Object.UID = ""
	x, _ := json.Marshal(b)
	if _, e := Parse(x); e == nil {
		t.Fatal("missing UID")
	}
}
func TestReversedRange(t *testing.T) {
	b := fixture()
	b.Events.Items[0].Last = "2025-01-01T00:00:00Z"
	x, _ := json.Marshal(b)
	if _, e := Parse(x); e == nil {
		t.Fatal("reversed")
	}
}
func TestFallback(t *testing.T) {
	b := fixture()
	b.Events.Items[0].First = ""
	b.Events.Items[0].Last = ""
	b.Events.Items[0].EventTime = "2026-01-01T00:00:00Z"
	x, _ := json.Marshal(b)
	p, e := Parse(x)
	if e != nil || p.Events.Items[0].First == "" {
		t.Fatal(p, e)
	}
}
