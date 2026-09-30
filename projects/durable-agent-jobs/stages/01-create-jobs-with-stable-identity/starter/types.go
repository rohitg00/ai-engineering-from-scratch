package main

import "errors"

var ErrInvalid = errors.New("invalid input")
var ErrLimit = errors.New("budget exceeded")
var ErrConflict = errors.New("conflict")

type Job struct {
	ID         string
	State      string
	Version    int
	LeaseUntil int64
	Attempts   int
}
