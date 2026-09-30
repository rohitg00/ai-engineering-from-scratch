package main

import (
	"testing"
)

func TestWhitespace(t *testing.T) {
	if !Correct("  Blue\n SKY ", "blue sky") {
		t.Fatal("whitespace")
	}
}
func TestNumber(t *testing.T) {
	if Correct("10 ms", "100 ms") {
		t.Fatal("number drift")
	}
}
func TestPunctuation(t *testing.T) {
	if Correct("yes!", "yes") {
		t.Fatal("punctuation ignored")
	}
}
func TestEmpty(t *testing.T) {
	if Correct("", "") {
		t.Fatal("empty success")
	}
}
func TestUnicode(t *testing.T) {
	if !Correct("CAFÉ", "café") {
		t.Fatal("unicode case")
	}
}
