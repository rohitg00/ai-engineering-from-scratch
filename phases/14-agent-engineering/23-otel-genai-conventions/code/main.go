// Lesson: OpenTelemetry GenAI Semantic Conventions (phase 14 / lesson 23)
// Go port of code/main.py. Go standard library only.
// Source: phases/14-agent-engineering/23-otel-genai-conventions/docs/en.md
// Run: go run code/main.go

package main

import (
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode"
)

type Span struct {
	Name       string
	Kind       string
	Attributes map[string]string
	Children   []*Span
	StartNs    int64
	EndNs      int64
}

func (s *Span) DurationMs() float64 {
	return float64(s.EndNs-s.StartNs) / 1_000_000
}

type ExternalContentStore struct {
	store   map[string]string
	counter int
}

func NewExternalContentStore() *ExternalContentStore {
	return &ExternalContentStore{store: map[string]string{}}
}

func (c *ExternalContentStore) Put(content string) string {
	c.counter++
	cid := fmt.Sprintf("content_%03d", c.counter)
	c.store[cid] = content
	return cid
}

func (c *ExternalContentStore) Get(cid string) string {
	return c.store[cid]
}

func (c *ExternalContentStore) Items() [][2]string {
	keys := make([]string, 0, len(c.store))
	for k := range c.store {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	out := make([][2]string, len(keys))
	for i, k := range keys {
		out[i] = [2]string{k, c.store[k]}
	}
	return out
}

var clockStart = time.Now()

func perfCounterNs() int64 {
	return int64(time.Since(clockStart))
}

type Tracer struct {
	Root          *Span
	stack         []*Span
	CaptureInline bool
	ContentStore  *ExternalContentStore
}

func NewTracer(captureInline bool, store *ExternalContentStore) *Tracer {
	if store == nil {
		store = NewExternalContentStore()
	}
	root := &Span{Name: "__root__", Kind: "INTERNAL", Attributes: map[string]string{}}
	return &Tracer{Root: root, stack: []*Span{root}, CaptureInline: captureInline, ContentStore: store}
}

func (t *Tracer) StartSpan(name, kind string, attributes map[string]string) *Span {
	attrs := map[string]string{}
	for k, v := range attributes {
		attrs[k] = v
	}
	span := &Span{Name: name, Kind: kind, Attributes: attrs, StartNs: perfCounterNs()}
	parent := t.stack[len(t.stack)-1]
	parent.Children = append(parent.Children, span)
	t.stack = append(t.stack, span)
	return span
}

func (t *Tracer) EndSpan() {
	span := t.stack[len(t.stack)-1]
	t.stack = t.stack[:len(t.stack)-1]
	span.EndNs = perfCounterNs()
}

func (t *Tracer) AddContent(span *Span, key, content string) {
	if t.CaptureInline {
		span.Attributes[key] = truncate(content, 200)
		return
	}
	cid := t.ContentStore.Put(content)
	span.Attributes[key+".reference_id"] = cid
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func pyRepr(s string) string {
	quote := "'"
	if strings.Contains(s, "'") && !strings.Contains(s, "\"") {
		quote = "\""
	}
	var b strings.Builder
	b.WriteString(quote)
	for _, r := range s {
		switch {
		case r == '\\':
			b.WriteString("\\\\")
		case r == '\n':
			b.WriteString("\\n")
		case r == '\r':
			b.WriteString("\\r")
		case r == '\t':
			b.WriteString("\\t")
		case string(r) == quote:
			b.WriteString("\\" + quote)
		case r < 0x20 || r == 0x7f:
			fmt.Fprintf(&b, "\\x%02x", r)
		case r >= 0x80 && !unicode.IsPrint(r):
			if r <= 0xff {
				fmt.Fprintf(&b, "\\x%02x", r)
			} else if r <= 0xffff {
				fmt.Fprintf(&b, "\\u%04x", r)
			} else {
				fmt.Fprintf(&b, "\\U%08x", r)
			}
		default:
			b.WriteRune(r)
		}
	}
	b.WriteString(quote)
	return b.String()
}

func scriptedLLM(prompt string) string {
	lower := strings.ToLower(prompt)
	if strings.Contains(lower, "search") {
		return "search_tool(\"agent engineering\")"
	}
	if strings.Contains(lower, "result") {
		return "found 3 sources; drafting answer"
	}
	return "final answer: agents in 2026"
}

func searchTool(query string) string {
	return fmt.Sprintf("[3 sources for %s]", pyRepr(query))
}

func render(span *Span, indent int) {
	if span.Name == "__root__" {
		for _, child := range span.Children {
			render(child, indent)
		}
		return
	}
	pad := strings.Repeat("  ", indent)
	dur := "..."
	if span.EndNs != 0 {
		dur = fmt.Sprintf("%.2fms", span.DurationMs())
	}
	fmt.Printf("%s%s  [%s]  %s\n", pad, span.Name, span.Kind, dur)
	keys := make([]string, 0, len(span.Attributes))
	for k := range span.Attributes {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, key := range keys {
		val := span.Attributes[key]
		if len([]rune(val)) > 50 {
			val = truncate(val, 50) + "..."
		}
		fmt.Printf("%s  %s = %s\n", pad, key, pyRepr(val))
	}
	for _, child := range span.Children {
		render(child, indent+1)
	}
}

func main() {
	fmt.Println(strings.Repeat("=", 70))
	fmt.Println("OTEL GENAI SEMANTIC CONVENTIONS: Phase 14, Lesson 23")
	fmt.Println(strings.Repeat("=", 70))

	tracer := NewTracer(false, nil)

	tracer.StartSpan("create_agent research_bot", "INTERNAL", map[string]string{
		"gen_ai.agent.name":     "research_bot",
		"gen_ai.operation.name": "create_agent",
		"gen_ai.provider.name":  "anthropic",
	})
	tracer.EndSpan()

	tracer.StartSpan("invoke_agent research_bot", "INTERNAL", map[string]string{
		"gen_ai.agent.name":     "research_bot",
		"gen_ai.operation.name": "invoke_agent",
		"gen_ai.provider.name":  "anthropic",
		"gen_ai.request.model":  "claude-opus-4-6",
	})

	for turn := 0; turn < 3; turn++ {
		chat := tracer.StartSpan("chat", "INTERNAL", map[string]string{
			"gen_ai.operation.name": "chat",
			"gen_ai.provider.name":  "anthropic",
			"gen_ai.request.model":  "claude-opus-4-6",
			"gen_ai.response.model": "claude-opus-4-6",
		})
		prompt := fmt.Sprintf("turn %d: next action please", turn)
		tracer.AddContent(chat, "gen_ai.input.messages", prompt)
		output := scriptedLLM(prompt)
		tracer.AddContent(chat, "gen_ai.output.messages", output)
		tracer.EndSpan()

		if strings.Contains(output, "search_tool") {
			toolSpan := tracer.StartSpan("tool_call search_tool", "INTERNAL", map[string]string{
				"gen_ai.operation.name": "tool_call",
				"gen_ai.tool.name":      "search_tool",
				"gen_ai.data_source.id": "corpus://mem0/default",
			})
			result := searchTool("agent engineering")
			tracer.AddContent(toolSpan, "gen_ai.tool.result", result)
			tracer.EndSpan()
		}
	}

	tracer.EndSpan()

	fmt.Println("\nspan tree (GenAI-shaped)")
	render(tracer.Root, 0)

	fmt.Println("\nexternal content store (opt-in references, not inline)")
	for _, item := range tracer.ContentStore.Items() {
		fmt.Printf("  %s: %s\n", item[0], truncate(item[1], 60))
	}

	fmt.Println()
	fmt.Println("content NOT captured inline by default. store externally; span")
	fmt.Println("attributes carry reference IDs. set OTEL_SEMCONV_STABILITY_OPT_IN")
	fmt.Println("=gen_ai_latest_experimental to pin experimental attribute names.")
}
