package main

import (
	"strings"
	"testing"
)

func TestQueued(t *testing.T) {
	j, e := NewJob("report-1")
	if e != nil || j.State != "queued" || j.Version != 0 {
		t.Fatal(j, e)
	}
}
func TestEmpty(t *testing.T) {
	if _, e := NewJob(""); e == nil {
		t.Fatal("empty")
	}
}
func TestTraversal(t *testing.T) {
	if _, e := NewJob("../job"); e == nil {
		t.Fatal("traversal")
	}
}
func TestBound(t *testing.T) {
	if _, e := NewJob(strings.Repeat("a", 65)); e == nil {
		t.Fatal("long")
	}
}
func TestWhitespace(t *testing.T) {
	if _, e := NewJob("my job"); e == nil {
		t.Fatal("space")
	}
}
