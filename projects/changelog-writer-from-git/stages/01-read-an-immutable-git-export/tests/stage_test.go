package main

import (
	"testing"
)

func TestValid(t *testing.T) {
	v, e := ParseLog("abc1234\tfeat: cache")
	if e != nil || v[0].Hash != "abc1234" {
		t.Fatal(v, e)
	}
}
func TestDuplicate(t *testing.T) {
	if _, e := ParseLog("abc1234\ta\nabc1234\tb"); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestBadHash(t *testing.T) {
	if _, e := ParseLog("xyz1234\ta"); e == nil {
		t.Fatal("bad hash")
	}
}
func TestNoSubject(t *testing.T) {
	if _, e := ParseLog("abc1234\t"); e == nil {
		t.Fatal("blank")
	}
}
func TestEmpty(t *testing.T) {
	v, e := ParseLog("")
	if e != nil || len(v) != 0 {
		t.Fatal(v, e)
	}
}
