package main

import "strings"

func ParseLog(text string) ([]Commit, error) {
	out := []Commit{}
	seen := map[string]bool{}
	for _, line := range strings.Split(strings.TrimSpace(text), "\n") {
		if line == "" {
			continue
		}
		p := strings.SplitN(line, "\t", 2)
		if len(p) != 2 || len(p[0]) < 7 || len(p[0]) > 40 || strings.TrimSpace(p[1]) == "" {
			return nil, ErrInvalid
		}
		for _, c := range p[0] {
			if !strings.ContainsRune("0123456789abcdef", c) {
				return nil, ErrInvalid
			}
		}
		if seen[p[0]] {
			return nil, ErrConflict
		}
		seen[p[0]] = true
		out = append(out, Commit{Hash: p[0], Subject: p[1]})
	}
	return out, nil
}
