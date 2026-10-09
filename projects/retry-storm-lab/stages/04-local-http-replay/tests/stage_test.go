package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWireRetry(t *testing.T) {
	n := 0
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n++
		if n == 1 {
			w.WriteHeader(503)
		} else {
			fmt.Fprint(w, "ok")
		}
	}))
	defer s.Close()
	a, e := Fetch(context.Background(), s.Client(), s.URL, 9, Policy{1, 10, 3, false, 0}, NewBudget(1))
	if e != nil || len(a) != 2 || n != 2 {
		t.Fatal(a, e, n)
	}
}
func TestWireNonRetry(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(400) }))
	defer s.Close()
	a, e := Fetch(context.Background(), s.Client(), s.URL, 0, Policy{1, 10, 3, false, 0}, NewBudget(9))
	if e == nil || len(a) != 1 {
		t.Fatal(a, e)
	}
}
func TestWireBudget(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(503) }))
	defer s.Close()
	a, e := Fetch(context.Background(), s.Client(), s.URL, 0, Policy{1, 10, 3, false, 0}, NewBudget(0))
	if e == nil || len(a) != 1 {
		t.Fatal(a, e)
	}
}
func TestWireServerDelay(t *testing.T) {
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Header().Set("Retry-After", "5"); w.WriteHeader(503) }))
	defer s.Close()
	a, e := Fetch(context.Background(), s.Client(), s.URL, 0, Policy{1, 10, 3, false, 0}, NewBudget(9))
	if e == nil || len(a) != 1 {
		t.Fatal(a, e)
	}
}
func TestCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	s := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer s.Close()
	_, e := Fetch(ctx, s.Client(), s.URL, 0, Policy{1, 10, 3, false, 0}, NewBudget(2))
	if e == nil {
		t.Fatal("cancel ignored")
	}
}
