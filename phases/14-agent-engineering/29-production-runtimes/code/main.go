// Lesson: Production Runtimes (phase 14 / lesson 29)
// Go port of code/main.py. Go standard library only.
// Source: phases/14-agent-engineering/29-production-runtimes/docs/en.md
// Run: go run code/main.go

package main

import (
	"fmt"
	"strings"
)

func head(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func agentFn(inputText string) []string {
	return []string{
		"parse: " + head(inputText, 40),
		"plan: 3-step plan",
		"step 1: search",
		"step 2: read",
		"final: answered " + head(inputText, 20),
	}
}

func requestResponse(inputText string) string {
	steps := agentFn(inputText)
	return steps[len(steps)-1]
}

func streaming(inputText string) <-chan string {
	out := make(chan string)
	go func() {
		defer close(out)
		for _, step := range agentFn(inputText) {
			out <- step
		}
	}()
	return out
}

type Job struct {
	Jid     string
	Payload string
	Attempt int
}

type Result struct {
	Key   string
	Value string
}

type QueueRuntime struct {
	queue   []*Job
	dlq     []*Job
	counter int
}

func (q *QueueRuntime) Enqueue(payload string) string {
	q.counter++
	jid := fmt.Sprintf("j%03d", q.counter)
	q.queue = append(q.queue, &Job{Jid: jid, Payload: payload})
	return jid
}

func (q *QueueRuntime) Worker(failPolicy func(*Job) bool) []Result {
	var results []Result
	for len(q.queue) > 0 {
		job := q.queue[0]
		q.queue = q.queue[1:]
		job.Attempt++
		if failPolicy(job) && job.Attempt < 3 {
			q.queue = append(q.queue, job)
			results = append(results, Result{job.Jid, "retry"})
			continue
		}
		if failPolicy(job) {
			q.dlq = append(q.dlq, job)
			results = append(results, Result{job.Jid, "DLQ"})
			continue
		}
		steps := agentFn(job.Payload)
		results = append(results, Result{job.Jid, steps[len(steps)-1]})
	}
	return results
}

type EventBus struct {
	subscribers map[string][]func(string) string
}

func NewEventBus() *EventBus {
	return &EventBus{subscribers: map[string][]func(string) string{}}
}

func (b *EventBus) Subscribe(eventType string, handler func(string) string) {
	b.subscribers[eventType] = append(b.subscribers[eventType], handler)
}

func (b *EventBus) Publish(eventType, payload string) []Result {
	var results []Result
	for _, handler := range b.subscribers[eventType] {
		results = append(results, Result{eventType, handler(payload)})
	}
	return results
}

func main() {
	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("PRODUCTION RUNTIME SHAPES: Phase 14, Lesson 29")
	fmt.Println(strings.Repeat("=", 70))

	fmt.Println("\n1. request-response (synchronous)")
	out := requestResponse("list project files")
	fmt.Printf("  result: %s\n", out)

	fmt.Println("\n2. streaming (generator)")
	for step := range streaming("review this PR") {
		fmt.Printf("  chunk: %s\n", step)
	}

	fmt.Println("\n3. queue-based (with retry and DLQ)")
	rt := &QueueRuntime{}
	rt.Enqueue("long job A")
	rt.Enqueue("long job B")
	rt.Enqueue("long job C")

	failB := func(job *Job) bool {
		return job.Payload == "long job B"
	}

	for _, r := range rt.Worker(failB) {
		fmt.Printf("  %s: %s\n", r.Key, r.Value)
	}
	fmt.Printf("  queue: %d   dlq: %d\n", len(rt.queue), len(rt.dlq))

	fmt.Println("\n4. event-driven (subscriber pattern)")
	bus := NewEventBus()

	onPrOpened := func(payload string) string {
		return "ran checks on " + payload
	}
	onMemoryConsolidate := func(payload string) string {
		return "consolidated " + payload
	}

	bus.Subscribe("pr.opened", onPrOpened)
	bus.Subscribe("memory.consolidate", onMemoryConsolidate)

	for _, r := range bus.Publish("pr.opened", "#123 add feature") {
		fmt.Printf("  %s -> %s\n", r.Key, r.Value)
	}
	for _, r := range bus.Publish("memory.consolidate", "session_001") {
		fmt.Printf("  %s -> %s\n", r.Key, r.Value)
	}

	fmt.Println("\n5. scheduled (cron stand-in)")
	schedule := [][2]string{
		{"02:00", "memory.consolidate"},
		{"03:00", "eval.nightly"},
	}
	for _, s := range schedule {
		fmt.Printf("  %s: would fire %s\n", s[0], s[1])
	}

	fmt.Println()
	fmt.Println("same agent logic, four outer shells. pick by task shape.")
	fmt.Println("observability (Lesson 23/24) is load-bearing at every shape.")
}
