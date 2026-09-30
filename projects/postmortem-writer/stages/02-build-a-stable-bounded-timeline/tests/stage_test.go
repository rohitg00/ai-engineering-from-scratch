package main

import (
	"testing"
)

func TestOrdered(t *testing.T) {
	v, e := Timeline([]Event{{ID: "b", Second: 5}, {ID: "a", Second: 1}}, 9)
	if e != nil || v[0].ID != "a" {
		t.Fatal(v, e)
	}
}
func TestTied(t *testing.T) {
	v, _ := Timeline([]Event{{ID: "b", Second: 1}, {ID: "a", Second: 1}}, 2)
	if v[0].ID != "a" {
		t.Fatal(v)
	}
}
func TestNoMutation(t *testing.T) {
	v := []Event{{ID: "b", Second: 5}, {ID: "a", Second: 1}}
	Timeline(v, 9)
	if v[0].ID != "b" {
		t.Fatal(v)
	}
}
func TestBound(t *testing.T) {
	if _, e := Timeline([]Event{{Second: 10}}, 9); e != ErrLimit {
		t.Fatal(e)
	}
}
func TestEmpty(t *testing.T) {
	v, e := Timeline(nil, 0)
	if e != nil || len(v) != 0 {
		t.Fatal(v, e)
	}
}
