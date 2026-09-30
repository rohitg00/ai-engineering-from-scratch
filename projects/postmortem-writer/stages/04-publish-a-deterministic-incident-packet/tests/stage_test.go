package main

import (
	"strings"
	"testing"
)

func TestPacket(t *testing.T) {
	s, e := Report([]Event{{ID: "a", Message: "slow"}}, []Claim{{"latency", []string{"a"}}}, 1)
	if e != nil || !strings.Contains(s, "evidence=a") {
		t.Fatal(s, e)
	}
}
func TestLimit(t *testing.T) {
	if _, e := Report(nil, []Claim{{Text: "x"}}, 0); e != ErrLimit {
		t.Fatal(e)
	}
}
func TestInvalidAtomic(t *testing.T) {
	s, e := Report(nil, []Claim{{"x", []string{"missing"}}}, 1)
	if e == nil || s != "" {
		t.Fatal(s, e)
	}
}
func TestEscaped(t *testing.T) {
	s, e := Report([]Event{{ID: "a", Message: "x\ny"}}, nil, 0)
	if e != nil || !strings.Contains(s, `"x\ny"`) {
		t.Fatal(s, e)
	}
}
func TestDeterministic(t *testing.T) {
	v := []Event{{ID: "a", Second: 1}}
	a, _ := Report(v, nil, 0)
	b, _ := Report(v, nil, 0)
	if a != b {
		t.Fatal(a, b)
	}
}
