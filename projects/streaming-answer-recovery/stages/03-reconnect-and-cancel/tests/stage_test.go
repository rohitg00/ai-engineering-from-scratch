package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestEncode(t *testing.T) {
	b, e := Encode(StreamEvent{1, `{"type":"complete"}`})
	if e != nil || !strings.HasSuffix(string(b), "\n\n") {
		t.Fatal(string(b), e)
	}
}
func TestBadPayload(t *testing.T) {
	if _, e := Encode(StreamEvent{1, "{"}); e == nil {
		t.Fatal("invalid JSON")
	}
}
func TestAfter(t *testing.T) {
	x, e := After(FixtureEvents(), "2")
	if e != nil || len(x) != 2 || x[0].ID != 3 {
		t.Fatal(x, e)
	}
}
func TestBadResume(t *testing.T) {
	if _, e := After(FixtureEvents(), "99"); e == nil {
		t.Fatal("unavailable resume")
	}
}
func TestHTTPResume(t *testing.T) {
	s := httptest.NewServer(Handler(FixtureEvents()))
	defer s.Close()
	req, _ := http.NewRequest("GET", s.URL, nil)
	req.Header.Set("Last-Event-ID", "2")
	r, e := s.Client().Do(req)
	if e != nil {
		t.Fatal(e)
	}
	defer r.Body.Close()
	b, _ := io.ReadAll(r.Body)
	if strings.Contains(string(b), "id: 1") || !strings.Contains(string(b), "id: 3") {
		t.Fatal(string(b))
	}
}
