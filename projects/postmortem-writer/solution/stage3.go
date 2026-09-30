package main

import "strings"

func Verify(claim Claim, events []Event) error {
	if strings.TrimSpace(claim.Text) == "" || len(claim.Evidence) == 0 {
		return ErrInvalid
	}
	known := map[string]bool{}
	for _, e := range events {
		known[e.ID] = true
	}
	seen := map[string]bool{}
	for _, id := range claim.Evidence {
		if !known[id] {
			return ErrInvalid
		}
		if seen[id] {
			return ErrConflict
		}
		seen[id] = true
	}
	return nil
}
