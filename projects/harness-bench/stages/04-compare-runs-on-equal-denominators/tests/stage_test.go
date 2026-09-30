package main

import (
	"strings"
	"testing"
)

func TestRank(t *testing.T) {
	s, e := Leaderboard([]Result{{Harness: "bad", Total: 2, Attempted: 2, Correct: 0}, {Harness: "good", Total: 2, Attempted: 2, Correct: 2}})
	if e != nil || strings.Index(s, "good") > strings.Index(s, "bad") {
		t.Fatal(s, e)
	}
}
func TestDenominator(t *testing.T) {
	if _, e := Leaderboard([]Result{{Harness: "a", Total: 1}, {Harness: "b", Total: 2}}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestCounter(t *testing.T) {
	if _, e := Leaderboard([]Result{{Harness: "a", Total: 1, Correct: 2, Attempted: 1}}); e == nil {
		t.Fatal("impossible")
	}
}
func TestDuplicate(t *testing.T) {
	if _, e := Leaderboard([]Result{{Harness: "a", Total: 1}, {Harness: "a", Total: 1}}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestTies(t *testing.T) {
	s, _ := Leaderboard([]Result{{Harness: "b", Total: 1}, {Harness: "a", Total: 1}})
	if strings.Index(s, "a correct") > strings.Index(s, "b correct") {
		t.Fatal(s)
	}
}
