package main

import (
	"testing"
)

func TestValid(t *testing.T) {
	x, e := Load([]byte(`{"layers":[{"name":"base","values":{"a":1}}],"observed":{"a":1}}`))
	if e != nil || len(x.Layers) != 1 {
		t.Fatal(x, e)
	}
}
func TestUnknown(t *testing.T) {
	if _, e := Load([]byte(`{"layers":[],"observed":{},"oops":1}`)); e == nil {
		t.Fatal("unknown field")
	}
}
func TestDuplicate(t *testing.T) {
	if _, e := Load([]byte(`{"layers":[{"name":"x","values":{}},{"name":"x","values":{}}],"observed":{}}`)); e == nil {
		t.Fatal("duplicate")
	}
}
func TestNested(t *testing.T) {
	if _, e := Load([]byte(`{"layers":[],"observed":{"a":{"nested":1}}}`)); e == nil {
		t.Fatal("nested")
	}
}
func TestTrailing(t *testing.T) {
	if _, e := Load([]byte(`{"layers":[],"observed":{}} {}`)); e == nil {
		t.Fatal("trailing")
	}
}
func TestBounds(t *testing.T) {
	if _, e := Load(make([]byte, (1<<20)+1)); e == nil {
		t.Fatal("unbounded")
	}
}
