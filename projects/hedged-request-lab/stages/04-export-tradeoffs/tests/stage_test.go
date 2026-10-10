package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestComparisonCounts(t *testing.T) {
	r, e := Compare(1, 5*time.Millisecond)
	if e != nil || r.BaselineCalls != 1 || r.HedgedCalls != 2 {
		t.Fatal(r, e)
	}
}
func TestWorkContinues(t *testing.T) {
	r, e := Compare(1, time.Millisecond)
	if e != nil || r.Work.Started != 3 || r.Work.Completed != 3 {
		t.Fatal(r, e)
	}
}
func TestSampleBounds(t *testing.T) {
	if _, e := Compare(0, time.Millisecond); e == nil {
		t.Fatal("zero samples")
	}
}
func TestReceiptConsumer(t *testing.T) {
	r, e := Compare(1, time.Millisecond)
	if e != nil {
		t.Fatal(e)
	}
	b, _ := json.Marshal(r)
	var x Comparison
	if json.Unmarshal(b, &x) != nil || x.SchemaVersion != 1 || len(x.Receipts) != 1 {
		t.Fatal(string(b))
	}
}
func TestDelayNoDuplicates(t *testing.T) {
	r, e := Compare(1, 200*time.Millisecond)
	if e != nil || r.HedgedCalls != 1 || r.Work.Started != 2 {
		t.Fatal(r, e)
	}
}
