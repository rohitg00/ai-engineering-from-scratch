package main

import "sort"

func Timeline(events []Event, horizon int) ([]Event, error) {
	if horizon < 0 {
		return nil, ErrInvalid
	}
	out := append([]Event{}, events...)
	for _, e := range out {
		if e.Second < 0 || e.Second > horizon {
			return nil, ErrLimit
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Second == out[j].Second {
			return out[i].ID < out[j].ID
		}
		return out[i].Second < out[j].Second
	})
	return out, nil
}
