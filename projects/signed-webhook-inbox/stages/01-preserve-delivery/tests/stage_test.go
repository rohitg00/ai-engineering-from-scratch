package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func request(body string) *http.Request {
	r := httptest.NewRequest("POST", "/", strings.NewReader(body))
	r.Header.Set("X-Delivery-ID", "delivery-1")
	r.Header.Set("X-Timestamp", "1770000000")
	return r
}
func TestRawBytes(t *testing.T) {
	d, e := ReadDelivery(request("{ \"a\" : 1 }\n"))
	if e != nil || string(d.Body) != "{ \"a\" : 1 }\n" {
		t.Fatal(d, e)
	}
}
func TestWrongMethod(t *testing.T) {
	r := request("x")
	r.Method = "GET"
	if _, e := ReadDelivery(r); e == nil {
		t.Fatal("GET accepted")
	}
}
func TestIDTraversal(t *testing.T) {
	r := request("x")
	r.Header.Set("X-Delivery-ID", "../../outside")
	if _, e := ReadDelivery(r); e == nil {
		t.Fatal("bad ID")
	}
}
func TestTooLarge(t *testing.T) {
	if _, e := ReadDelivery(request(strings.Repeat("x", 65537))); e == nil {
		t.Fatal("unbounded")
	}
}
func TestTimestampCanonical(t *testing.T) {
	r := request("x")
	r.Header.Set("X-Timestamp", "01770000000")
	if _, e := ReadDelivery(r); e == nil {
		t.Fatal("ambiguous timestamp")
	}
}
func TestEmptyBody(t *testing.T) {
	if _, e := ReadDelivery(request("")); e == nil {
		t.Fatal("empty body")
	}
}
