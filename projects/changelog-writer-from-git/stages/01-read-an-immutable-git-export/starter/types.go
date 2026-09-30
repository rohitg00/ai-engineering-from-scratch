package main

import "errors"

var ErrInvalid = errors.New("invalid input")
var ErrLimit = errors.New("budget exceeded")
var ErrConflict = errors.New("conflict")

type Commit struct {
	Hash        string
	Subject     string
	Kind        string
	Scope       string
	Breaking    bool
	Description string
}
