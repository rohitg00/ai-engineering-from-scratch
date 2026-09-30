package main

import "errors"

var ErrInvalid = errors.New("invalid input")
var ErrLimit = errors.New("budget exceeded")
var ErrConflict = errors.New("conflict")

type Lease struct {
	Shard   string
	Worker  string
	Version int
	Until   int64
	Result  string
	Done    bool
}
type Item struct {
	ID    string
	Value string
}
