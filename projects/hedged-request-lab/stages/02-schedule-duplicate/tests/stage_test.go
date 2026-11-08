package main

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func endpoint(delay time.Duration, status int, body string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(delay)
		w.WriteHeader(status)
		fmt.Fprint(w, body)
	}))
}

func TestFastPrimaryNoHedge(t *testing.T) {
	a := endpoint(0, 200, `{"value":"x"}`)
	defer a.Close()
	b := endpoint(0, 200, `{"value":"y"}`)
	defer b.Close()
	r, e := Hedged(context.Background(), a.Client(), []string{a.URL, b.URL}, 200*time.Millisecond)
	if e != nil || r.Launched != 1 || r.Winner != 0 {
		t.Fatal(r, e)
	}
}
func TestSlowPrimaryHedges(t *testing.T) {
	a := endpoint(100*time.Millisecond, 200, `{"value":"x"}`)
	defer a.Close()
	b := endpoint(0, 200, `{"value":"x"}`)
	defer b.Close()
	r, e := Hedged(context.Background(), a.Client(), []string{a.URL, b.URL}, time.Millisecond)
	if e != nil || r.Launched != 2 || r.Winner != 1 {
		t.Fatal(r, e)
	}
}
func TestSingleEndpoint(t *testing.T) {
	a := endpoint(0, 200, `{"value":"x"}`)
	defer a.Close()
	r, e := Hedged(context.Background(), a.Client(), []string{a.URL}, 0)
	if e != nil || r.Launched != 1 {
		t.Fatal(r, e)
	}
}
func TestTooMany(t *testing.T) {
	if _, e := Hedged(context.Background(), http.DefaultClient, []string{"a", "b", "c"}, 0); e == nil {
		t.Fatal("unbounded attempts")
	}
}
func TestParentCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	a := endpoint(0, 200, `{"value":"x"}`)
	defer a.Close()
	if _, e := Hedged(ctx, a.Client(), []string{a.URL}, 0); e == nil {
		t.Fatal("ignored cancellation")
	}
}
