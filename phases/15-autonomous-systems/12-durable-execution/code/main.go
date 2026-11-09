// Lesson: Durable Execution (phase 15 / lesson 12)
// Go port of code/main.py. Go standard library only.
// Source: phases/15-autonomous-systems/12-durable-execution/docs/en.md
// Run: go run code/main.go

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

type Event struct {
	Name   string `json:"name"`
	Args   []any  `json:"args"`
	Status string `json:"status"`
	Result any    `json:"result,omitempty"`
}

type EventLog struct {
	Path string
}

func NewEventLog(path string) *EventLog {
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		must(os.WriteFile(path, []byte("[]"), 0o644))
	}
	return &EventLog{Path: path}
}

func (l *EventLog) Events() []Event {
	data, err := os.ReadFile(l.Path)
	must(err)
	var evs []Event
	must(json.Unmarshal(data, &evs))
	return evs
}

func (l *EventLog) Append(ev Event) {
	evs := append(l.Events(), ev)
	data, err := json.Marshal(evs)
	must(err)
	must(os.WriteFile(l.Path, data, 0o644))
}

func sameArgs(a, b []any) bool {
	x, _ := json.Marshal(a)
	y, _ := json.Marshal(b)
	return string(x) == string(y)
}

func (l *EventLog) Lookup(name string, args []any) *Event {
	for _, ev := range l.Events() {
		if ev.Name == name && sameArgs(ev.Args, args) && ev.Status == "done" {
			return &ev
		}
	}
	return nil
}

func must(err error) {
	if err != nil {
		panic(err)
	}
}

func pyRepr(v any) string {
	switch x := v.(type) {
	case nil:
		return "None"
	case bool:
		if x {
			return "True"
		}
		return "False"
	case string:
		return "'" + strings.ReplaceAll(x, "'", "\\'") + "'"
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	default:
		return fmt.Sprint(x)
	}
}

func pyStr(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return pyRepr(v)
}

func tupleRepr(args []any) string {
	parts := make([]string, len(args))
	for i, a := range args {
		parts[i] = pyRepr(a)
	}
	if len(parts) == 1 {
		return "(" + parts[0] + ",)"
	}
	return "(" + strings.Join(parts, ", ") + ")"
}

func normalize(v any) any {
	data, _ := json.Marshal(v)
	var out any
	_ = json.Unmarshal(data, &out)
	return out
}

func activity(name string, fn func(args []any) any) func(*EventLog, ...any) any {
	return func(log *EventLog, args ...any) any {
		if args == nil {
			args = []any{}
		}
		args = normalize(args).([]any)
		if hit := log.Lookup(name, args); hit != nil {
			fmt.Printf("    [replay] %s(%s) -> %s (from log)\n", name, tupleRepr(args), pyStr(hit.Result))
			return hit.Result
		}
		log.Append(Event{Name: name, Args: args, Status: "started"})
		result := normalize(fn(args))
		log.Append(Event{Name: name, Args: args, Status: "done", Result: result})
		fmt.Printf("    [run]    %s(%s) -> %s\n", name, tupleRepr(args), pyStr(result))
		return result
	}
}

var fetchDocs = activity("fetch_docs", func(args []any) any {
	return len(args[0].(string)) * 3
})

var callLLM = activity("call_llm", func(args []any) any {
	return fmt.Sprintf("summary(%s_docs)", pyStr(args[0]))
})

var writeReport = activity("write_report", func(args []any) any {
	return "report://" + args[0].(string)
})

func workflow(log *EventLog, query string, crashAfter int) (string, error) {
	docCount := fetchDocs(log, query)
	if crashAfter == 1 {
		return "", errors.New("simulated crash after fetch_docs")
	}
	summary := callLLM(log, docCount)
	if crashAfter == 2 {
		return "", errors.New("simulated crash after call_llm")
	}
	report := writeReport(log, summary)
	return report.(string), nil
}

func resetLog(path string) *EventLog {
	_ = os.Remove(path)
	return NewEventLog(path)
}

func countRuns(log *EventLog) int {
	n := 0
	for _, ev := range log.Events() {
		if ev.Status == "started" {
			n++
		}
	}
	return n
}

func main() {
	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("DURABLE EXECUTION (Phase 15, Lesson 12)")
	fmt.Println(strings.Repeat("=", 70))

	tmpdir, err := os.MkdirTemp("", "durable")
	must(err)
	defer os.RemoveAll(tmpdir)

	fmt.Println("\nNaive retry (no event log persisted)")
	fmt.Println(strings.Repeat("-", 70))
	for attempt := 1; attempt <= 3; attempt++ {
		log := resetLog(filepath.Join(tmpdir, "naive.json"))
		fmt.Printf("  attempt %d:\n", attempt)
		crash := -1
		if attempt == 1 {
			crash = 2
		}
		r, err := workflow(log, "hello", crash)
		if err != nil {
			fmt.Printf("    -> crash: %s; %d activity starts wasted\n", err, countRuns(log))
			continue
		}
		fmt.Printf("    -> result %s\n", r)
		fmt.Printf("    -> %d activity starts this attempt\n", countRuns(log))
		break
	}

	fmt.Println("\nDurable retry (event log preserved across attempts)")
	fmt.Println(strings.Repeat("-", 70))
	durablePath := filepath.Join(tmpdir, "durable.json")
	_ = os.Remove(durablePath)

	for attempt := 1; attempt <= 3; attempt++ {
		log := NewEventLog(durablePath)
		fmt.Printf("  attempt %d:\n", attempt)
		crash := -1
		if attempt == 1 {
			crash = 2
		}
		r, err := workflow(log, "hello", crash)
		if err != nil {
			fmt.Printf("    -> crash: %s\n", err)
			continue
		}
		fmt.Printf("    -> result %s\n", r)
		fmt.Printf("    -> %d total activity starts across attempts\n", countRuns(log))
		break
	}

	fmt.Println()
	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("HEADLINE: durability makes long-horizon runs affordable to fail")
	fmt.Println(strings.Repeat("-", 70))
	fmt.Println("  Naive retry re-executes every activity on every attempt.")
	fmt.Println("  Durable retry replays completed activities from the log;")
	fmt.Println("  only the missing activity actually runs. Same design used")
	fmt.Println("  by Temporal, LangGraph checkpointing, Microsoft Agent")
	fmt.Println("  Framework, and Claude Code Routines. The LLM call is")
	fmt.Println("  just another non-deterministic activity in the log.")
}
