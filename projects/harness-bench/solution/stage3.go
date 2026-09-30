package main

import (
	"context"
	"strings"
)

func PolicyPrompt(c Case, policy string) string {
	if policy == "evidence" && len(c.Evidence) > 0 {
		return c.Prompt + "\n\nEvidence:\n" + strings.Join(c.Evidence, "\n")
	}
	return c.Prompt
}
func Evaluate(name string, cases []Case, model Model, budget int) (Result, error) {
	if model == nil {
		return Result{}, ErrInvalid
	}
	return EvaluatePolicy(context.Background(), name, "baseline", cases, func(_ context.Context, p string) (string, error) { return model(p) }, budget, "legacy-local-model")
}
func EvaluatePolicy(ctx context.Context, name, policy string, cases []Case, model ContextModel, budget int, modelReceipt string) (Result, error) {
	if name == "" || model == nil || budget < 0 || modelReceipt == "" || (policy != "baseline" && policy != "retry-errors" && policy != "evidence") {
		return Result{}, ErrInvalid
	}
	out := Result{Harness: name, Total: len(cases), State: "completed", CallBudget: budget, DatasetSHA256: Fingerprint(cases), ModelConfigSHA256: modelReceipt}
	for _, c := range cases {
		if out.Calls >= budget {
			out.State = "budget-exhausted"
			break
		}
		if err := ctx.Err(); err != nil {
			out.State = "cancelled"
			return out, err
		}
		out.Attempted++
		attempts := 1
		if policy == "retry-errors" {
			attempts = 2
		}
		prompt := PolicyPrompt(c, policy)
		var answer string
		var callErr error
		for attempt := 1; attempt <= attempts; attempt++ {
			if out.Calls >= budget {
				out.State = "budget-exhausted"
				break
			}
			out.Calls++
			answer, callErr = model(ctx, prompt)
			out.Trace = append(out.Trace, CallTrace{CaseID: c.ID, Attempt: attempt, Prompt: prompt, Answer: answer, Failed: callErr != nil, Correct: callErr == nil && Correct(answer, c.Expected)})
			if err := ctx.Err(); err != nil {
				out.Errors++
				out.State = "cancelled"
				return out, err
			}
			if callErr == nil {
				break
			}
		}
		if callErr != nil {
			out.Errors++
		} else if Correct(answer, c.Expected) {
			out.Correct++
		}
	}
	return out, nil
}
