package main

import "errors"

var ErrInvalid = errors.New("invalid input")
var ErrLimit = errors.New("budget exceeded")
var ErrConflict = errors.New("conflict")

type Event struct {
	ID      string
	Second  int
	Kind    string
	Message string
}
type Claim struct {
	Text     string
	Evidence []string
}
