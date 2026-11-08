package main

import (
	"math"
	"testing"
)

func TestPercentiles(t *testing.T) {
	d, e := Summarize([]float64{80, 2, 10, 4, 20})
	if e != nil || d.P50MS != 10 || d.P95MS != 80 || d.Samples != 5 {
		t.Fatal(d, e)
	}
}
func TestEmpty(t *testing.T) {
	if _, e := Summarize(nil); e == nil {
		t.Fatal("empty")
	}
}
func TestInvalidSamples(t *testing.T) {
	for _, v := range []float64{-1, math.Inf(1), math.NaN()} {
		if _, e := Summarize([]float64{v}); e == nil {
			t.Fatal(v)
		}
	}
}
func TestNoMutation(t *testing.T) {
	v := []float64{9, 1}
	Summarize(v)
	if v[0] != 9 {
		t.Fatal(v)
	}
}
func TestSafeURL(t *testing.T) {
	for _, u := range []string{"file:///etc/passwd", "https://user:pass@example.com", "ftp://example.com"} {
		if SafeURL(u) == nil {
			t.Fatal(u)
		}
	}
	if SafeURL("http://127.0.0.1/read") != nil {
		t.Fatal("valid URL")
	}
}
