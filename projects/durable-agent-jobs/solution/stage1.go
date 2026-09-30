package main

import "regexp"

func NewJob(id string) (Job, error) {
	if !regexp.MustCompile(`^[a-z][a-z0-9-]{0,63}$`).MatchString(id) {
		return Job{}, ErrInvalid
	}
	return Job{ID: id, State: "queued"}, nil
}
