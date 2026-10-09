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

func TestValidJSON(t *testing.T) {
	v, e := ValidBody(200, []byte(`{"value":"heldout"}`))
	if e != nil || v != "heldout" {
		t.Fatal(v, e)
	}
}
func TestErrorCannotWin(t *testing.T) {
	if _, e := ValidBody(503, []byte(`{"value":"x"}`)); e == nil {
		t.Fatal("error winner")
	}
}
func TestEmptyAndMalformed(t *testing.T) {
	for _, b := range []string{`{}`, `{"value":""}`, `{`} {
		if _, e := ValidBody(200, []byte(b)); e == nil {
			t.Fatal(b)
		}
	}
}
func TestBodyLimit(t *testing.T) {
	if _, e := ValidBody(200, make([]byte, 65537)); e == nil {
		t.Fatal("unbounded")
	}
}
func TestFastInvalidLoses(t *testing.T) {
	a := endpoint(0, 500, `{"value":"bad"}`)
	defer a.Close()
	b := endpoint(0, 200, `{"value":"good"}`)
	defer b.Close()
	r, e := Hedged(context.Background(), a.Client(), []string{a.URL, b.URL}, time.Millisecond)
	if e != nil || r.Winner != 1 || r.Value != "good" {
		t.Fatal(r, e)
	}
}
func TestLateCancellationAccounted(t *testing.T) {
	a := endpoint(100*time.Millisecond, 200, `{"value":"x"}`)
	defer a.Close()
	b := endpoint(0, 200, `{"value":"x"}`)
	defer b.Close()
	r, e := Hedged(context.Background(), a.Client(), []string{a.URL, b.URL}, time.Millisecond)
	if e != nil || r.CancelRequested != 1 || len(r.Attempts)+r.Unobserved != r.Launched {
		t.Fatal(r, e)
	}
}
