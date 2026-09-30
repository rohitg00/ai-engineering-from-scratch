package main

import (
	"testing"
)

func TestSuccess(t *testing.T) {
	s, e := ClassifyStatus(201)
	if e != nil || s != "success" {
		t.Fatal(s, e)
	}
}
func TestRateLimit(t *testing.T) {
	s, _ := ClassifyStatus(429)
	if s != "retry" {
		t.Fatal(s)
	}
}
func TestServer(t *testing.T) {
	s, _ := ClassifyStatus(503)
	if s != "retry" {
		t.Fatal(s)
	}
}
func TestAuth(t *testing.T) {
	s, _ := ClassifyStatus(401)
	if s != "terminal" {
		t.Fatal(s)
	}
}
func TestInvalid(t *testing.T) {
	if _, e := ClassifyStatus(0); e == nil {
		t.Fatal("zero status")
	}
}
