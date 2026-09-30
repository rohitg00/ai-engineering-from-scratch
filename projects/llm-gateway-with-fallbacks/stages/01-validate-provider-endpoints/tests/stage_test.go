package main

import (
	"testing"
)

func TestHttps(t *testing.T) {
	v, e := Endpoints([]string{"https://api.example.test/v1"})
	if e != nil || len(v) != 1 {
		t.Fatal(v, e)
	}
}
func TestLocal(t *testing.T) {
	if _, e := Endpoints([]string{"http://127.0.0.1:8000"}); e != nil {
		t.Fatal(e)
	}
}
func TestPlaintext(t *testing.T) {
	if _, e := Endpoints([]string{"http://api.example.test"}); e == nil {
		t.Fatal("plaintext")
	}
}
func TestCredentials(t *testing.T) {
	if _, e := Endpoints([]string{"https://user:pass@api.example.test"}); e == nil {
		t.Fatal("userinfo")
	}
}
func TestDedup(t *testing.T) {
	v, _ := Endpoints([]string{"https://a.test", "https://a.test"})
	if len(v) != 1 {
		t.Fatal(v)
	}
}
