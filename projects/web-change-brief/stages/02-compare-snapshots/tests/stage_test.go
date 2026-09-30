package main

import (
	"reflect"
	"testing"
)

func snap(t *testing.T, input string) Snapshot {
	t.Helper()
	s, e := NewSnapshot("https://example.invalid/path", input, nil)
	if e != nil {
		t.Fatal(e)
	}
	return s
}
func TestCanonicalURLDropsFragmentAndNormalizesHost(t *testing.T) {
	s, e := CanonicalURL("https://EXAMPLE.invalid#section")
	if e != nil || s != "https://example.invalid/" {
		t.Fatal(s, e)
	}
}
func TestURLCredentialsAndUnsupportedSchemesFail(t *testing.T) {
	for _, url := range []string{"file:///tmp/a", "https://user:secret@example.invalid/", "/relative"} {
		if _, e := CanonicalURL(url); e == nil {
			t.Fatal(url)
		}
	}
}
func TestMultisetDifferenceKeepsOccurrenceCounts(t *testing.T) {
	r, e := Compare(snap(t, "<p>A</p><p>A</p><p>B</p>"), snap(t, "<p>A</p><p>B</p><p>C</p>"))
	if e != nil || r.Unchanged != 2 || !reflect.DeepEqual(r.Removed, []Change{{"A", 1}}) || !reflect.DeepEqual(r.Added, []Change{{"C", 1}}) {
		t.Fatal(r, e)
	}
}
func TestReorderedBlocksKeepHashAndNoTextChanges(t *testing.T) {
	a, b := snap(t, "<p>A</p><p>B</p>"), snap(t, "<p>B</p><p>A</p>")
	r, e := Compare(a, b)
	if e != nil || a.Hash != b.Hash || len(r.Added)+len(r.Removed) != 0 {
		t.Fatal(r, e)
	}
}
func TestDifferentURLsCannotBeCompared(t *testing.T) {
	a, b := snap(t, "A"), snap(t, "A")
	b.URL += "?different=1"
	if _, e := Compare(a, b); e == nil {
		t.Fatal("URL mismatch accepted")
	}
}
func TestEmptySnapshotsHaveStableHash(t *testing.T) {
	a, b := snap(t, ""), snap(t, "<!--nothing-->")
	r, e := Compare(a, b)
	if e != nil || a.Hash != b.Hash || r.Unchanged != 0 || len(a.Hash) != 64 {
		t.Fatal(a, b, r, e)
	}
}
func TestNoiseDoesNotChangeContentHash(t *testing.T) {
	a, b := snap(t, "<nav>1</nav><p>A</p>"), snap(t, "<nav>2</nav><p>A</p>")
	if a.Hash != b.Hash {
		t.Fatal(a, b)
	}
}
