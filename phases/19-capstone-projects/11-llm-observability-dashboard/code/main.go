// Lesson: LLM Observability Dashboard (phase 19 / lesson 11)
// Go port of code/main.py. Go standard library only.
// Source: phases/19-capstone-projects/11-llm-observability-dashboard/docs/en.md
// Run: go run code/main.go

package main

import (
	"crypto/sha256"
	"fmt"
	"math"
	"math/bits"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type PyRandom struct {
	mt  [624]uint32
	mti int
}

func NewPyRandom(seed uint32) *PyRandom {
	r := &PyRandom{}
	r.initByArray([]uint32{seed})
	return r
}

func (r *PyRandom) initGenrand(s uint32) {
	r.mt[0] = s
	for r.mti = 1; r.mti < 624; r.mti++ {
		prev := r.mt[r.mti-1] ^ (r.mt[r.mti-1] >> 30)
		r.mt[r.mti] = 1812433253*prev + uint32(r.mti)
	}
}

func (r *PyRandom) initByArray(key []uint32) {
	r.initGenrand(19650218)
	i, j := 1, 0
	k := 624
	if len(key) > k {
		k = len(key)
	}
	for ; k > 0; k-- {
		prev := r.mt[i-1] ^ (r.mt[i-1] >> 30)
		r.mt[i] = (r.mt[i] ^ (prev * 1664525)) + key[j] + uint32(j)
		i++
		j++
		if i >= 624 {
			r.mt[0] = r.mt[623]
			i = 1
		}
		if j >= len(key) {
			j = 0
		}
	}
	for k = 623; k > 0; k-- {
		prev := r.mt[i-1] ^ (r.mt[i-1] >> 30)
		r.mt[i] = (r.mt[i] ^ (prev * 1566083941)) - uint32(i)
		i++
		if i >= 624 {
			r.mt[0] = r.mt[623]
			i = 1
		}
	}
	r.mt[0] = 0x80000000
}

func (r *PyRandom) genrand() uint32 {
	if r.mti >= 624 {
		for kk := 0; kk < 624; kk++ {
			y := (r.mt[kk] & 0x80000000) | (r.mt[(kk+1)%624] & 0x7fffffff)
			mag := uint32(0)
			if y&1 == 1 {
				mag = 0x9908b0df
			}
			r.mt[kk] = r.mt[(kk+397)%624] ^ (y >> 1) ^ mag
		}
		r.mti = 0
	}
	y := r.mt[r.mti]
	r.mti++
	y ^= y >> 11
	y ^= (y << 7) & 0x9d2c5680
	y ^= (y << 15) & 0xefc60000
	y ^= y >> 18
	return y
}

func (r *PyRandom) Random() float64 {
	a := r.genrand() >> 5
	b := r.genrand() >> 6
	return (float64(a)*67108864.0 + float64(b)) / 9007199254740992.0
}

func (r *PyRandom) randBelow(n int) int {
	k := bits.Len(uint(n))
	for {
		v := int(r.genrand() >> (32 - k))
		if v < n {
			return v
		}
	}
}

func (r *PyRandom) Choice(items []string) string {
	return items[r.randBelow(len(items))]
}

func (r *PyRandom) RandInt(a, b int) int {
	return a + r.randBelow(b-a+1)
}

func (r *PyRandom) Uniform(a, b float64) float64 {
	return a + (b-a)*r.Random()
}

type Attrs map[string]any

func (a Attrs) num(key string) float64 {
	switch v := a[key].(type) {
	case float64:
		return v
	case int:
		return float64(v)
	}
	return 0
}

func (a Attrs) str(key, fallback string) string {
	if v, ok := a[key].(string); ok {
		return v
	}
	return fallback
}

type Span struct {
	TraceID      string
	SpanID       string
	ParentSpanID string
	Name         string
	StartMs      int64
	DurationMs   int64
	Attributes   Attrs
	Events       []map[string]any
	Status       string
}

func (s Span) IsLLM() bool {
	_, ok := s.Attributes["gen_ai.system"]
	return ok
}

type TailSampler struct {
	SampleRate float64
	Rng        *PyRandom
}

func (t *TailSampler) Decide(trace []Span) bool {
	for _, s := range trace {
		if s.Status == "error" {
			return true
		}
	}
	for _, s := range trace {
		if s.Name == "eval" && (s.Attributes.num("toxicity") > 0.5 || s.Attributes.num("pii_leak") > 0.8) {
			return true
		}
	}
	return t.Rng.Random() < t.SampleRate
}

type orderedFloat struct {
	keys []string
	vals map[string]float64
}

func newOrderedFloat() *orderedFloat {
	return &orderedFloat{vals: map[string]float64{}}
}

func (o *orderedFloat) add(key string, v float64) {
	if _, ok := o.vals[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.vals[key] += v
}

type SpanStore struct {
	Spans      []Span
	ByUser     *orderedFloat
	ByModel    *orderedFloat
	CostByUser *orderedFloat
}

func NewSpanStore() *SpanStore {
	return &SpanStore{ByUser: newOrderedFloat(), ByModel: newOrderedFloat(), CostByUser: newOrderedFloat()}
}

func (st *SpanStore) InsertTrace(trace []Span) {
	st.Spans = append(st.Spans, trace...)
	for _, s := range trace {
		if s.IsLLM() {
			u := s.Attributes.str("user_id", "anon")
			m := s.Attributes.str("gen_ai.request.model", "unknown")
			st.ByUser.add(u, 1)
			st.ByModel.add(m, 1)
			st.CostByUser.add(u, s.Attributes.num("cost_usd"))
		}
	}
}

func wordSet(text string) map[string]bool {
	out := map[string]bool{}
	for _, w := range strings.Fields(strings.ToLower(text)) {
		out[w] = true
	}
	return out
}

func EvalFaithfulness(response, context string) float64 {
	r := wordSet(response)
	c := wordSet(context)
	if len(r) == 0 {
		return 0.0
	}
	overlap := 0
	for w := range r {
		if c[w] {
			overlap++
		}
	}
	return float64(overlap) / float64(len(r))
}

func EvalToxicity(response string) float64 {
	bad := map[string]bool{"hate": true, "kill": true, "stupid": true, "garbage": true}
	words := strings.Fields(strings.ToLower(response))
	hits := 0
	for _, w := range words {
		if bad[w] {
			hits++
		}
	}
	return math.Min(1.0, float64(hits)/float64(max(1, len(words)))*10)
}

var (
	ssnRe   = regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`)
	emailRe = regexp.MustCompile(`[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_.-]+`)
)

func EvalPIILeak(response string) float64 {
	if ssnRe.MatchString(response) {
		return 0.95
	}
	if emailRe.MatchString(response) {
		return 0.6
	}
	return 0.05
}

func PromptFingerprint(prompt string, nBins int) int {
	h := sha256.Sum256([]byte(prompt))
	return int(h[0]) % nBins
}

func PSI(a, b []int, nBins int) float64 {
	ca := make([]int, nBins)
	cb := make([]int, nBins)
	for _, v := range a {
		ca[v]++
	}
	for _, v := range b {
		cb[v]++
	}
	totalA := max(len(a), 1)
	totalB := max(len(b), 1)
	score := 0.0
	for i := 0; i < nBins; i++ {
		pa := math.Max(float64(ca[i])/float64(totalA), 0.0001)
		pb := math.Max(float64(cb[i])/float64(totalB), 0.0001)
		score += (pa - pb) * math.Log(pa/pb)
	}
	return score
}

func pyRound(x float64, digits int) float64 {
	v, _ := strconv.ParseFloat(strconv.FormatFloat(x, 'f', digits, 64), 64)
	return v
}

func SynthTrace(traceID string, leakPII bool, rng *PyRandom) []Span {
	model := rng.Choice([]string{"claude-sonnet-4-7", "gpt-5-4", "gemini-3-pro"})
	user := rng.Choice([]string{"u_01", "u_02", "u_03", "u_04"})
	root := Span{
		TraceID: traceID, SpanID: traceID + "_0", Name: "chat_turn",
		StartMs: time.Now().UnixMilli(), DurationMs: int64(rng.RandInt(400, 2400)),
		Attributes: Attrs{"app_id": "chatbot"}, Status: "ok",
	}
	prompt := rng.Choice([]string{
		"what is the weather in Tokyo today",
		"summarize the recent Tokyo forecast",
		"give me a travel tip for Tokyo",
		"how warm is Tokyo this week",
	})
	resp := "the weather in Tokyo is mild"
	if leakPII {
		resp = "your ssn is 123-45-6789"
	}
	ctx := "relevant weather context Tokyo mild"
	attrs := Attrs{"gen_ai.system": strings.Split(model, "-")[0], "gen_ai.request.model": model}
	attrs["gen_ai.usage.input_tokens"] = rng.RandInt(80, 800)
	attrs["gen_ai.usage.output_tokens"] = rng.RandInt(20, 300)
	attrs["user_id"] = user
	attrs["prompt"] = prompt
	attrs["response"] = resp
	attrs["context"] = ctx
	attrs["cost_usd"] = pyRound(rng.Uniform(0.002, 0.05), 4)
	llm := Span{
		TraceID: traceID, SpanID: traceID + "_1", ParentSpanID: root.SpanID, Name: "llm_call",
		StartMs: root.StartMs + 50, DurationMs: root.DurationMs - 80, Attributes: attrs, Status: "ok",
	}
	return []Span{root, llm}
}

func EnrichWithEvals(trace []Span) []Span {
	out := append([]Span(nil), trace...)
	for _, s := range trace {
		if s.IsLLM() {
			resp := s.Attributes.str("response", "")
			ctx := s.Attributes.str("context", "")
			out = append(out, Span{
				TraceID: s.TraceID, SpanID: s.SpanID + "_eval", ParentSpanID: s.SpanID, Name: "eval",
				StartMs: s.StartMs + s.DurationMs, DurationMs: 120, Status: "ok",
				Attributes: Attrs{
					"faithfulness": EvalFaithfulness(resp, ctx),
					"toxicity":     EvalToxicity(resp),
					"pii_leak":     EvalPIILeak(resp),
				},
			})
		}
	}
	return out
}

func Alerter(store *SpanStore) []string {
	alerts := []string{}
	var pii, tox []Span
	for _, s := range store.Spans {
		if s.Name == "eval" && s.Attributes.num("pii_leak") > 0.8 {
			pii = append(pii, s)
		}
		if s.Name == "eval" && s.Attributes.num("toxicity") > 0.5 {
			tox = append(tox, s)
		}
	}
	if len(pii) > 0 {
		alerts = append(alerts, fmt.Sprintf("PII LEAK DETECTED: %d events (first trace: %s)", len(pii), pii[0].TraceID))
	}
	if len(tox) > 0 {
		alerts = append(alerts, fmt.Sprintf("TOXICITY SURGE: %d events", len(tox)))
	}
	return alerts
}

func pyFloat(x float64) string {
	if x == math.Trunc(x) {
		return strconv.FormatFloat(x, 'f', 1, 64)
	}
	return strconv.FormatFloat(x, 'f', -1, 64)
}

func formatDict(o *orderedFloat, value func(float64) string) string {
	items := make([]string, len(o.keys))
	for i, k := range o.keys {
		items[i] = fmt.Sprintf("'%s': %s", k, value(o.vals[k]))
	}
	return "{" + strings.Join(items, ", ") + "}"
}

func main() {
	rng := NewPyRandom(5)
	sampler := &TailSampler{SampleRate: 0.20, Rng: rng}
	store := NewSpanStore()

	var baselineFps, currentFps []int
	for i := 0; i < 200; i++ {
		leak := rng.Random() < 0.01
		trace := SynthTrace(fmt.Sprintf("t%04d", i), leak, rng)
		trace = EnrichWithEvals(trace)
		if sampler.Decide(trace) {
			store.InsertTrace(trace)
		}
		fp := PromptFingerprint(trace[1].Attributes.str("prompt", ""), 8)
		if i > 150 {
			currentFps = append(currentFps, fp)
		} else {
			baselineFps = append(baselineFps, fp)
		}
	}

	fmt.Printf("ingested spans     : %d\n", len(store.Spans))
	fmt.Printf("spans by model     : %s\n", formatDict(store.ByModel, func(v float64) string { return strconv.Itoa(int(v)) }))
	fmt.Printf("cost by user       : %s\n", formatDict(store.CostByUser, func(v float64) string { return pyFloat(pyRound(v, 4)) }))

	alerts := Alerter(store)
	if len(alerts) > 0 {
		fmt.Println("\nALERTS:")
		for _, a := range alerts {
			fmt.Printf("  - %s\n", a)
		}
	} else {
		fmt.Println("\nno alerts")
	}

	psiVal := PSI(baselineFps, currentFps, 8)
	fmt.Printf("\nPSI (current vs baseline): %.3f\n", psiVal)
	if psiVal > 0.2 {
		fmt.Println("  drift alert (PSI > 0.2)")
	}
}
