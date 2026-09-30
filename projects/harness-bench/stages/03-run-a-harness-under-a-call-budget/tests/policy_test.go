package main

import (
	"context"
	"strings"
	"testing"
)

func TestPoliciesChangeRequestsAndRetryErrors(t *testing.T) {
	cases := []Case{{ID: "restore", Prompt: "state?", Expected: "ready", Evidence: []string{"Receipt: ready"}}}
	calls := []string{}
	model := func(_ context.Context, p string) (string, error) {
		calls = append(calls, p)
		if len(calls) == 1 {
			return "", ErrInvalid
		}
		return "ready", nil
	}
	r, e := EvaluatePolicy(context.Background(), "retry", "retry-errors", cases, model, 2, "model-a")
	if e != nil || r.Correct != 1 || r.Calls != 2 || r.Attempted != 1 || r.Errors != 0 || calls[0] != calls[1] {
		t.Fatal(r, e, calls)
	}
	r, e = EvaluatePolicy(context.Background(), "evidence", "evidence", cases, func(_ context.Context, p string) (string, error) {
		if p != "state?\n\nEvidence:\nReceipt: ready" {
			t.Fatal(p)
		}
		return "ready", nil
	}, 2, "model-a")
	if e != nil || r.Correct != 1 || r.Calls != 1 {
		t.Fatal(r, e)
	}
}
func TestRetryConsumesLastCallWithoutScoringAnUnseenCase(t *testing.T) {
	cases := []Case{{ID: "first", Prompt: "first", Expected: "yes"}, {ID: "second", Prompt: "second", Expected: "yes"}}
	r, e := EvaluatePolicy(context.Background(), "retry", "retry-errors", cases, func(context.Context, string) (string, error) { return "", ErrInvalid }, 1, "model-a")
	if e != nil || r.Calls != 1 || r.Attempted != 1 || r.Errors != 1 || r.Total != 2 || r.State != "budget-exhausted" {
		t.Fatal(r, e)
	}
}
func TestWrongAnswerDoesNotTriggerOracleRetry(t *testing.T) {
	calls := 0
	r, _ := EvaluatePolicy(context.Background(), "retry", "retry-errors", []Case{{ID: "a", Prompt: "visible", Expected: "hidden-sentinel"}}, func(_ context.Context, p string) (string, error) {
		calls++
		if strings.Contains(p, "hidden-sentinel") {
			t.Fatal("answer leakage")
		}
		return "wrong", nil
	}, 10, "model-a")
	if calls != 1 || r.Correct != 0 || r.Errors != 0 {
		t.Fatal(r, calls)
	}
}
func TestRecordingIsFiniteAndResetsPerPolicy(t *testing.T) {
	recording := Recording{Responses: map[string][]RecordedResponse{"p": {{Answer: "first"}, {Answer: "second"}}}}
	model := recording.NewModel()
	ctx := context.Background()
	a, _ := model(ctx, "p")
	b, _ := model(ctx, "p")
	_, e := model(ctx, "p")
	fresh, _ := recording.NewModel()(ctx, "p")
	if a != "first" || b != "second" || e == nil || fresh != "first" {
		t.Fatal(a, b, e, fresh)
	}
}
func TestCancellationBeforeAnyModelCall(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	r, e := EvaluatePolicy(ctx, "x", "baseline", []Case{{ID: "a", Prompt: "p", Expected: "q"}}, func(context.Context, string) (string, error) { t.Fatal("called"); return "", nil }, 2, "model-a")
	if e == nil || r.Calls != 0 || r.State != "cancelled" {
		t.Fatal(r, e)
	}
}
