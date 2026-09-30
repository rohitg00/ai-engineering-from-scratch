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
func TestBody(t *testing.T) {
	r, e := Attempt(context.Background(), fixtureClient(200, "ok"), "https://a.test", "{}", 2)
	if e != nil || r.Body != "ok" {
		t.Fatal(r, e)
	}
}
func TestLimit(t *testing.T) {
	if _, e := Attempt(context.Background(), fixtureClient(200, "long"), "https://a.test", "{}", 2); e != ErrLimit {
		t.Fatal(e)
	}
}
func TestStatus(t *testing.T) {
	r, e := Attempt(context.Background(), fixtureClient(503, "busy"), "https://a.test", "{}", 9)
	if e != nil || r.Status != 503 {
		t.Fatal(r, e)
	}
}
func TestInvalidBudget(t *testing.T) {
	if _, e := Attempt(context.Background(), fixtureClient(200, "ok"), "https://a.test", "{}", 0); e != ErrInvalid {
		t.Fatal(e)
	}
}
func TestRequestShape(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		if r.Method != "POST" || r.Header.Get("Content-Type") != "application/json" {
			t.Fatal(r)
		}
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader("ok")), Header: make(http.Header)}, nil
	})}
	if _, e := Attempt(context.Background(), client, "https://a.test", "{}", 10); e != nil {
		t.Fatal(e)
	}
}

func TestRedirectCannotBypassEndpointValidation(t *testing.T) {
	calls := 0
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		calls++
		return &http.Response{StatusCode: 302, Body: io.NopCloser(strings.NewReader("redirect")), Header: http.Header{"Location": []string{"http://untrusted.test/collect"}}}, nil
	})}
	reply, err := Attempt(context.Background(), client, "https://a.test", "{}", 32)
	if err != nil || calls != 1 || reply.Status != 302 || client.CheckRedirect != nil {
		t.Fatal(reply, calls, err)
	}
}

func TestNilClientIsInvalid(t *testing.T) {
	if _, err := Attempt(context.Background(), nil, "https://a.test", "{}", 32); err != ErrInvalid {
		t.Fatal(err)
	}
}
