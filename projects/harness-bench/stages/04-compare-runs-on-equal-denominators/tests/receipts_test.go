package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func receipt(name, prompt, model string) Result {
	r, _ := EvaluatePolicy(context.Background(), name, "baseline", []Case{{ID: "a", Prompt: prompt, Expected: "ok"}}, func(context.Context, string) (string, error) { return "ok", nil }, 2, model)
	return r
}
func TestEqualCountDifferentDatasetRejected(t *testing.T) {
	if _, e := Leaderboard([]Result{receipt("a", "first", "m"), receipt("b", "second", "m")}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestDifferentModelSettingsRejected(t *testing.T) {
	if _, e := Leaderboard([]Result{receipt("a", "same", Fingerprint(Settings{MaxTokens: 5})), receipt("b", "same", Fingerprint(Settings{MaxTokens: 50}))}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestDifferentBudgetsRejected(t *testing.T) {
	a := receipt("a", "same", "m")
	b := receipt("b", "same", "m")
	b.CallBudget++
	if _, e := Leaderboard([]Result{a, b}); e != ErrConflict {
		t.Fatal(e)
	}
}
func TestCanonicalDatasetWhitespaceAndExecutionOrder(t *testing.T) {
	a, e := Cases([]byte(`[{"ID":"a","Prompt":"p","Expected":"x"},{"ID":"b","Prompt":"q","Expected":"y"}]`), 2)
	if e != nil {
		t.Fatal(e)
	}
	b, e := Cases([]byte(`[ { "Expected": "x", "Prompt": "p", "ID": "a" }, {"Expected":"y","ID":"b","Prompt":"q"} ]`), 2)
	if e != nil || Fingerprint(a) != Fingerprint(b) {
		t.Fatal(e)
	}
	b[0], b[1] = b[1], b[0]
	if Fingerprint(a) == Fingerprint(b) {
		t.Fatal("order matters under a budget")
	}
}
func TestHTTPAdapterUsesOnlyPromptAndConfiguredKey(t *testing.T) {
	t.Setenv("HARNESS_TEST_KEY", "fixture-provider-key")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer fixture-provider-key" {
			t.Error("wrong auth")
		}
		var request map[string]any
		json.NewDecoder(r.Body).Decode(&request)
		data, _ := json.Marshal(request)
		if strings.Contains(string(data), "hidden-answer") || request["model"] != "loopback-model" {
			t.Error("invalid model input")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer server.Close()
	model, e := HTTPModel(ModelConfig{Model: "loopback-model", Endpoint: server.URL, Settings: Settings{MaxTokens: 10}}, "HARNESS_TEST_KEY")
	if e != nil {
		t.Fatal(e)
	}
	r, e := EvaluatePolicy(context.Background(), "wire", "baseline", []Case{{ID: "a", Prompt: "visible", Expected: "hidden-answer"}}, model, 1, "loopback-config")
	if e != nil || r.Calls != 1 || r.Correct != 0 || r.Errors != 0 {
		t.Fatal(r, e)
	}
}
func TestHTTPAdapterRejectsOversizedResponse(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(strings.Repeat("x", 1024*1024+1))) }))
	defer server.Close()
	model, e := HTTPModel(ModelConfig{Model: "local", Endpoint: server.URL, Settings: Settings{MaxTokens: 10}}, "")
	if e != nil {
		t.Fatal(e)
	}
	if _, e = model(context.Background(), "p"); e != ErrLimit {
		t.Fatal(e)
	}
}

func TestReceiptCannotClaimAttemptWithoutModelCall(t *testing.T) {
	r := receipt("a", "same", "m")
	r.Calls = 0
	if _, e := Leaderboard([]Result{r}); e != ErrInvalid {
		t.Fatal(e)
	}
}
