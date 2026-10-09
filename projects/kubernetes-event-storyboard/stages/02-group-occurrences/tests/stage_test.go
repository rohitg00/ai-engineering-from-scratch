package main

import (
	"testing"
)

func fixture() Bundle {
	var b Bundle
	b.ObservedAt = "2026-01-02T00:00:00Z"
	b.Events.Items = []Event{{Metadata: Metadata{UID: "e1"}, Object: ObjectRef{UID: "p1", Name: "pod"}, Reason: "Failed", Type: "Warning", Count: 2, First: "2026-01-01T00:00:00Z", Last: "2026-01-01T00:01:00Z"}}
	b.Workloads.Items = []Workload{}
	return b
}

func TestCount(t *testing.T) {
	r, e := Group(fixture())
	if e != nil || r[0].Count != 2 {
		t.Fatal(r, e)
	}
}
func TestSnapshotMax(t *testing.T) {
	b := fixture()
	e := b.Events.Items[0]
	e.Count = 5
	b.Events.Items = append(b.Events.Items, e)
	r, _ := Group(b)
	if r[0].Count != 5 || len(r[0].EventUIDs) != 1 {
		t.Fatal(r)
	}
}
func TestDistinctSeries(t *testing.T) {
	b := fixture()
	e := b.Events.Items[0]
	e.Metadata.UID = "e2"
	b.Events.Items = append(b.Events.Items, e)
	r, _ := Group(b)
	if r[0].Count != 4 {
		t.Fatal(r)
	}
}
func TestReusedName(t *testing.T) {
	b := fixture()
	e := b.Events.Items[0]
	e.Metadata.UID = "e2"
	e.Object.UID = "p2"
	b.Events.Items = append(b.Events.Items, e)
	r, _ := Group(b)
	if len(r) != 2 {
		t.Fatal(r)
	}
}
func TestIdentityConflict(t *testing.T) {
	b := fixture()
	e := b.Events.Items[0]
	e.Object.UID = "different"
	b.Events.Items = append(b.Events.Items, e)
	if _, err := Group(b); err == nil {
		t.Fatal("UID conflict")
	}
}

func TestRepresentativeStable(t *testing.T) {
	b := fixture()
	b.Events.Items[0].Object.ResourceVersion = "4"
	e := b.Events.Items[0]
	e.Metadata.UID = "e2"
	e.Object.ResourceVersion = "9"
	b.Events.Items = append(b.Events.Items, e)
	for i := 0; i < 20; i++ {
		r, err := Group(b)
		if err != nil || r[0].Object.ResourceVersion != "4" {
			t.Fatal(r, err)
		}
	}
}
