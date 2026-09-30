package main

import (
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
)

type redirectTransport func(*http.Request) (*http.Response, error)

func (f redirectTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestRedirectPreservesSelectedHTTPS(t *testing.T) {
	for _, tc := range []struct {
		start, target string
		allowed       bool
	}{
		{"https://example.invalid/page", "http://example.invalid/next", false},
		{"https://example.invalid:8443/page", "http://example.invalid:8443/next", false},
		{"https://example.invalid/page", "https://example.invalid/next", true},
		{"http://example.invalid/page", "http://example.invalid/next", true},
		{"http://example.invalid/page", "https://example.invalid/next", true},
		{"https://example.invalid:8443/page", "https://example.invalid:8080/next", false},
		{"https://example.invalid/page", "https://other.invalid/next", false},
	} {
		t.Run(tc.start+" to "+tc.target, func(t *testing.T) {
			calls := 0
			client := &http.Client{Transport: redirectTransport(func(r *http.Request) (*http.Response, error) {
				calls++
				if calls == 1 {
					return &http.Response{StatusCode: 302, Header: http.Header{"Location": {tc.target}}, Body: io.NopCloser(strings.NewReader("redirect")), Request: r}, nil
				}
				return &http.Response{StatusCode: 200, Header: http.Header{"Content-Type": {"text/html"}}, Body: io.NopCloser(strings.NewReader("<p>Current page</p>")), Request: r}, nil
			})}
			body, err := FetchHTML(context.Background(), tc.start, client)
			if tc.allowed {
				if err != nil || calls != 2 || body != "<p>Current page</p>" {
					t.Fatal(body, err, calls)
				}
			} else if err == nil || calls != 1 {
				t.Fatal("redirect target was requested", err, calls)
			}
			if client.CheckRedirect != nil {
				t.Fatal("caller redirect policy mutated")
			}
		})
	}
}
