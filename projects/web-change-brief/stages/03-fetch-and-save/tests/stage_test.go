package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestFetchUsesActualHTTPAndReturnsHTML(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			t.Error(r.Method)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte("<p>Library open</p>"))
	}))
	defer server.Close()
	s, e := FetchHTML(context.Background(), server.URL, nil)
	if e != nil || s != "<p>Library open</p>" {
		t.Fatal(s, e)
	}
}
func TestNonOKStatusFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Error(w, "Unavailable", 503) }))
	defer server.Close()
	if _, e := FetchHTML(context.Background(), server.URL, nil); e == nil {
		t.Fatal("503 accepted")
	}
}
func TestWrongMediaTypeFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte("{}"))
	}))
	defer server.Close()
	if _, e := FetchHTML(context.Background(), server.URL, nil); e == nil {
		t.Fatal("JSON accepted")
	}
}
func TestOversizeResponseFails(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html")
		w.Write([]byte(strings.Repeat("a", MaxHTMLBytes+1)))
	}))
	defer server.Close()
	if _, e := FetchHTML(context.Background(), server.URL, nil); e == nil {
		t.Fatal("oversize accepted")
	}
}
func TestCrossHostRedirectAndCancelledContextFail(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "http://example.invalid/elsewhere", 302)
	}))
	defer server.Close()
	if _, e := FetchHTML(context.Background(), server.URL, nil); e == nil {
		t.Fatal("redirect accepted")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e := FetchHTML(ctx, server.URL, nil); e == nil {
		t.Fatal("cancel ignored")
	}
}
func TestSavedSnapshotRoundTripAndNoTemporaryFiles(t *testing.T) {
	s, e := NewSnapshot("https://example.invalid/", "<p>One</p>", nil)
	if e != nil {
		t.Fatal(e)
	}
	dir := t.TempDir()
	path := filepath.Join(dir, "baseline.json")
	if e = SaveSnapshot(path, s); e != nil {
		t.Fatal(e)
	}
	loaded, e := LoadSnapshot(path)
	if e != nil || loaded.Hash != s.Hash || loaded.Blocks[0] != "One" {
		t.Fatal(loaded, e)
	}
	files, _ := os.ReadDir(dir)
	if len(files) != 1 {
		t.Fatal(files)
	}
}
func TestTamperedSnapshotFailsChecksum(t *testing.T) {
	s, _ := NewSnapshot("https://example.invalid/", "<p>One</p>", nil)
	path := filepath.Join(t.TempDir(), "baseline.json")
	SaveSnapshot(path, s)
	data, _ := os.ReadFile(path)
	os.WriteFile(path, []byte(strings.Replace(string(data), "One", "Two", 1)), 0644)
	if _, e := LoadSnapshot(path); e == nil {
		t.Fatal("tampered baseline accepted")
	}
}
