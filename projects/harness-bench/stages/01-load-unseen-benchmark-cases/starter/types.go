package main

import (
	"context"
	"errors"
)

var ErrInvalid = errors.New("invalid input")
var ErrLimit = errors.New("budget exceeded")
var ErrConflict = errors.New("conflict")

type Case struct {
	ID       string
	Prompt   string
	Expected string
	Evidence []string `json:",omitempty"`
}
type CallTrace struct {
	CaseID  string
	Attempt int
	Prompt  string
	Answer  string
	Failed  bool
	Correct bool
}
type Result struct {
	Harness           string
	Correct           int
	Attempted         int
	Errors            int
	Total             int
	State             string
	Calls             int
	CallBudget        int
	DatasetSHA256     string
	ModelConfigSHA256 string
	Trace             []CallTrace
}
type Model func(string) (string, error)
type ContextModel func(context.Context, string) (string, error)
