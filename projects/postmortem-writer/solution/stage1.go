package main

import (
	"strconv"
	"strings"
)

func Parse(text string) ([]Event, error) {
	out := []Event{}
	seen := map[string]bool{}
	for _, line := range strings.Split(strings.TrimSpace(text), "\n") {
		if line == "" {
			continue
		}
		p := strings.Split(line, "\t")
		if len(p) != 4 || p[0] == "" || p[2] == "" || p[3] == "" {
			return nil, ErrInvalid
		}
		n, e := strconv.Atoi(p[1])
		if e != nil || n < 0 {
			return nil, ErrInvalid
		}
		if seen[p[0]] {
			return nil, ErrConflict
		}
		seen[p[0]] = true
		out = append(out, Event{p[0], n, p[2], p[3]})
	}
	return out, nil
}
