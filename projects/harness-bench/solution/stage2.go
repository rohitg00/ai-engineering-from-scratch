package main

import "strings"

func Correct(actual, expected string) bool {
	normalize := func(s string) string { return strings.ToLower(strings.Join(strings.Fields(s), " ")) }
	want := normalize(expected)
	return want != "" && normalize(actual) == want
}
