package main

import "context"

func PolicyPrompt(c Case, policy string) string { panic("Stage 3: implement PolicyPrompt") }
func Evaluate(name string, cases []Case, model Model, budget int) (Result, error) {
	panic("Stage 3: implement Evaluate")
}
func EvaluatePolicy(ctx context.Context, name, policy string, cases []Case, model ContextModel, budget int, modelReceipt string) (Result, error) {
	panic("Stage 3: implement EvaluatePolicy")
}
