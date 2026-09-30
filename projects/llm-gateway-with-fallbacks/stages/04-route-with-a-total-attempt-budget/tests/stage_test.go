package main

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type transportFunc func(*http.Request) (*http.Response, error)

func (f transportFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }
func fixtureClient(status int, body string) *http.Client {
	return &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: status, Body: io.NopCloser(strings.NewReader(body)), Header: make(http.Header)}, nil
	})}
}
func TestSuccess(t *testing.T) {
	o, e := Route(context.Background(), fixtureClient(200, "ok"), []string{"https://a.test"}, "{}", 1, 10)
	if e != nil || o.State != "completed" || o.Attempts != 1 {
		t.Fatal(o, e)
	}
}
func TestFallback(t *testing.T) {
	n := 0
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		n++
		s := 503
		if n == 2 {
			s = 200
		}
		return &http.Response{StatusCode: s, Body: io.NopCloser(strings.NewReader("ok")), Header: make(http.Header)}, nil
	})}
	o, e := Route(context.Background(), client, []string{"https://a.test", "https://b.test"}, "{}", 2, 10)
	if e != nil || o.Attempts != 2 {
		t.Fatal(o, e)
	}
}
func TestBudget(t *testing.T) {
	o, e := Route(context.Background(), fixtureClient(503, "busy"), []string{"https://a.test", "https://b.test"}, "{}", 1, 10)
	if e != ErrLimit || o.Attempts != 1 {
		t.Fatal(o, e)
	}
}
func TestAuthStops(t *testing.T) {
	o, e := Route(context.Background(), fixtureClient(401, "no"), []string{"https://a.test", "https://b.test"}, "{}", 2, 10)
	if e == nil || o.Attempts != 1 || o.State != "terminal-error" {
		t.Fatal(o, e)
	}
}
func TestCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	o, e := Route(ctx, fixtureClient(200, "ok"), []string{"https://a.test"}, "{}", 1, 10)
	if e == nil || o.Attempts != 0 {
		t.Fatal(o, e)
	}
}
