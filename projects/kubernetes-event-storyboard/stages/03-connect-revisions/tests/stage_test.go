package main

import (
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

func TestRevision(t *testing.T) {
	r, _ := Group(fixture())
	w := []Workload{{Metadata: Metadata{UID: "p1", Annotations: map[string]string{"deployment.kubernetes.io/revision": "9"}}}}
	if Connect(r, w)[0].Revision != "9" {
		t.Fatal("revision")
	}
}
func TestNoNameFallback(t *testing.T) {
	r, _ := Group(fixture())
	w := []Workload{{Metadata: Metadata{UID: "p2", Name: "pod", Annotations: map[string]string{"deployment.kubernetes.io/revision": "9"}}}}
	if Connect(r, w)[0].Revision != "" {
		t.Fatal("name fallback")
	}
}
func TestMissing(t *testing.T) {
	r, _ := Group(fixture())
	if Connect(r, nil)[0].Revision != "" {
		t.Fatal("invented revision")
	}
}
func TestNoMutation(t *testing.T) {
	r, _ := Group(fixture())
	Connect(r, nil)
	if r[0].Investigation != "" {
		t.Fatal("mutated")
	}
}
func TestSuggestion(t *testing.T) {
	r, _ := Group(fixture())
	if !strings.Contains(Connect(r, nil)[0].Investigation, "does not prove cause") {
		t.Fatal("missing limitation")
	}
}
