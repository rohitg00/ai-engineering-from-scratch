package main

import (
	"errors"
	"time"
)

var ErrInvalid = errors.New("invalid input")
var ErrLimit = errors.New("budget exceeded")
var ErrConflict = errors.New("conflict")

const DefaultTimeout = 5 * time.Second
const MaxRequestBytes = 1024 * 1024

type Reply struct {
	Status   int
	Body     string
	Endpoint string
}
type AttemptTrace struct {
	Endpoint  string
	Status    int
	Kind      string
	ElapsedMS int64
}
type Outcome struct {
	Reply    Reply
	Attempts int
	State    string
	Trace    []AttemptTrace
}
