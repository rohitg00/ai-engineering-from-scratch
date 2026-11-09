// Lesson: LLM Routing Layer (phase 13 / lesson 21)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/21-llm-routing-layer/docs/en.md
// Run: go run code/main.go

package main

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"
)

type rate struct{ in, out float64 }

var prices = map[string]rate{
	"openai/gpt-4o":           {5.0, 15.0},
	"openai/gpt-4o-mini":      {0.15, 0.60},
	"anthropic/claude-sonnet": {3.0, 15.0},
	"anthropic/claude-haiku":  {0.80, 4.0},
	"google/gemini-pro":       {1.25, 5.0},
}

var outage = map[string]bool{}

type chatMessage struct {
	Role    string
	Content string
}

type usage struct {
	PromptTokens     int
	CompletionTokens int
}

type response struct {
	ID      string
	Model   string
	Content string
	Usage   usage
}

func providerCall(model string, messages []chatMessage) (*response, error) {
	if outage[model] {
		return nil, fmt.Errorf("simulated 5xx from %s", model)
	}
	time.Sleep(10 * time.Millisecond)
	last := []rune(messages[len(messages)-1].Content)
	outToks := max(20, len(last)/3)
	preview := last
	if len(preview) > 60 {
		preview = preview[:60]
	}
	return &response{
		ID:      "resp_" + strings.ReplaceAll(model, "/", "_"),
		Model:   model,
		Content: fmt.Sprintf("[%s] echoed: %s", model, string(preview)),
		Usage:   usage{PromptTokens: len(last) / 4, CompletionTokens: outToks},
	}, nil
}

var routes = map[string][]string{
	"smart": {"openai/gpt-4o", "anthropic/claude-sonnet", "google/gemini-pro"},
	"fast":  {"openai/gpt-4o-mini", "anthropic/claude-haiku"},
}

var piiPatterns = []*regexp.Regexp{
	regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`),
	regexp.MustCompile(`\b\d{16}\b`),
}

func redactPII(text string) (string, bool) {
	redacted := false
	for _, pat := range piiPatterns {
		if pat.MatchString(text) {
			text = pat.ReplaceAllString(text, "[REDACTED]")
			redacted = true
		}
	}
	return text, redacted
}

type invocation struct {
	alias        string
	chosenModel  string
	attempts     []string
	inputTokens  int
	outputTokens int
	costUSD      float64
	redacted     bool
	response     *response
	err          error
}

func route(alias string, messages []chatMessage) invocation {
	inv := invocation{alias: alias}
	newMsgs := make([]chatMessage, 0, len(messages))
	for _, m := range messages {
		txt, r := redactPII(m.Content)
		if r {
			inv.redacted = true
		}
		newMsgs = append(newMsgs, chatMessage{Role: m.Role, Content: txt})
	}
	chain, ok := routes[alias]
	if !ok {
		chain = []string{alias}
	}
	for _, model := range chain {
		inv.attempts = append(inv.attempts, model)
		resp, err := providerCall(model, newMsgs)
		if err != nil {
			continue
		}
		inv.chosenModel = model
		inv.response = resp
		inv.inputTokens = resp.Usage.PromptTokens
		inv.outputTokens = resp.Usage.CompletionTokens
		p := prices[model]
		inv.costUSD = (float64(inv.inputTokens)*p.in + float64(inv.outputTokens)*p.out) / 1_000_000
		return inv
	}
	inv.err = errors.New("all providers failed")
	return inv
}

func pyList(items []string) string {
	quoted := make([]string, len(items))
	for i, s := range items {
		quoted[i] = "'" + s + "'"
	}
	return "[" + strings.Join(quoted, ", ") + "]"
}

func pyBool(b bool) string {
	if b {
		return "True"
	}
	return "False"
}

func main() {
	bar := strings.Repeat("=", 72)
	fmt.Println(bar)
	fmt.Println("PHASE 13 LESSON 20 - LLM ROUTING GATEWAY")
	fmt.Println(bar)

	fmt.Println("\n--- scenario 1: smart route, primary available ---")
	inv := route("smart", []chatMessage{{Role: "user", Content: "explain MCP"}})
	fmt.Printf("  chosen  : %s\n", inv.chosenModel)
	fmt.Printf("  attempts: %s\n", pyList(inv.attempts))
	fmt.Printf("  tokens  : in=%d out=%d\n", inv.inputTokens, inv.outputTokens)
	fmt.Printf("  cost    : $%.6f\n", inv.costUSD)
	fmt.Printf("  reply   : %s\n", inv.response.Content)

	fmt.Println("\n--- scenario 2: openai/gpt-4o OUTAGE -> falls back to Claude ---")
	outage["openai/gpt-4o"] = true
	inv = route("smart", []chatMessage{{Role: "user", Content: "same request"}})
	fmt.Printf("  chosen  : %s\n", inv.chosenModel)
	fmt.Printf("  attempts: %s\n", pyList(inv.attempts))
	fmt.Printf("  cost    : $%.6f\n", inv.costUSD)
	clear(outage)

	fmt.Println("\n--- scenario 3: PII in input gets redacted pre-dispatch ---")
	inv = route("fast", []chatMessage{{Role: "user", Content: "contact me at SSN 123-45-6789 please"}})
	fmt.Printf("  redacted: %s\n", pyBool(inv.redacted))
	fmt.Printf("  reply   : %s\n", inv.response.Content)

	fmt.Println("\n--- scenario 4: all providers down ---")
	for _, m := range routes["fast"] {
		outage[m] = true
	}
	inv = route("fast", []chatMessage{{Role: "user", Content: "help"}})
	fmt.Printf("  attempts: %s\n", pyList(inv.attempts))
	fmt.Printf("  error   : %s\n", inv.err)
}
