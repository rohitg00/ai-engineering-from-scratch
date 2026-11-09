// Lesson: Parallel Tool Calls and Streaming with Tools (phase 13 / lesson 03)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/docs/en.md
// Run: go run code/main.go

package main

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"
)

var cityOrder = []string{"Bengaluru", "Tokyo", "Zurich"}

var simulatedLatencyMS = map[string]int{"Bengaluru": 400, "Tokyo": 600, "Zurich": 800}

type weather struct {
	City  string
	TempC uint32
}

func (w weather) String() string {
	return fmt.Sprintf("{'city': '%s', 'temp_c': %d}", w.City, w.TempC)
}

func stableHash(s string) uint32 {
	var h uint32
	for _, c := range s {
		h = h*31 + uint32(c)
	}
	return h
}

func executorWeather(city string) weather {
	latency, ok := simulatedLatencyMS[city]
	if !ok {
		latency = 500
	}
	time.Sleep(time.Duration(latency) * time.Millisecond)
	return weather{City: city, TempC: stableHash(city) % 35}
}

func runSequential(cities []string) (float64, []weather) {
	start := time.Now()
	results := make([]weather, 0, len(cities))
	for _, c := range cities {
		results = append(results, executorWeather(c))
	}
	return float64(time.Since(start).Microseconds()) / 1000, results
}

func runParallel(cities []string) (float64, []weather) {
	start := time.Now()
	results := make([]weather, len(cities))
	var wg sync.WaitGroup
	for i, c := range cities {
		wg.Add(1)
		go func(i int, c string) {
			defer wg.Done()
			results[i] = executorWeather(c)
		}(i, c)
	}
	wg.Wait()
	return float64(time.Since(start).Microseconds()) / 1000, results
}

type callBuffer struct {
	id      string
	name    string
	argsBuf string
	done    bool
}

func (b *callBuffer) tryParse() map[string]string {
	if !b.done {
		return nil
	}
	var out map[string]string
	if err := json.Unmarshal([]byte(b.argsBuf), &out); err != nil {
		panic(err)
	}
	return out
}

type streamAccumulator struct {
	buffers map[string]*callBuffer
}

type event struct {
	kind  string
	id    string
	name  string
	chunk string
}

func (a *streamAccumulator) onEvent(e event) []*callBuffer {
	var completed []*callBuffer
	switch e.kind {
	case "call_start":
		a.buffers[e.id] = &callBuffer{id: e.id, name: e.name}
	case "args_delta":
		a.buffers[e.id].argsBuf += e.chunk
	case "call_stop":
		buf := a.buffers[e.id]
		buf.done = true
		completed = append(completed, buf)
	}
	return completed
}

func fakeOpenAIStream() []event {
	return []event{
		{kind: "call_start", id: "call_A", name: "get_weather"},
		{kind: "call_start", id: "call_B", name: "get_weather"},
		{kind: "call_start", id: "call_C", name: "get_weather"},
		{kind: "args_delta", id: "call_A", chunk: `{"city"`},
		{kind: "args_delta", id: "call_B", chunk: `{"city`},
		{kind: "args_delta", id: "call_A", chunk: `:"Beng`},
		{kind: "args_delta", id: "call_C", chunk: `{"city":"Zu`},
		{kind: "args_delta", id: "call_A", chunk: `aluru"}`},
		{kind: "call_stop", id: "call_A"},
		{kind: "args_delta", id: "call_B", chunk: `":"Tokyo"}`},
		{kind: "call_stop", id: "call_B"},
		{kind: "args_delta", id: "call_C", chunk: `rich"}`},
		{kind: "call_stop", id: "call_C"},
	}
}

type flight struct {
	id     string
	result chan weather
}

func replayAndExecute() []flight {
	acc := &streamAccumulator{buffers: map[string]*callBuffer{}}
	var inFlight []flight
	for _, e := range fakeOpenAIStream() {
		for _, buf := range acc.onEvent(e) {
			args := buf.tryParse()
			fmt.Printf("  call %s args complete -> {'city': '%s'}\n", buf.id, args["city"])
			ch := make(chan weather, 1)
			go func(city string) { ch <- executorWeather(city) }(args["city"])
			inFlight = append(inFlight, flight{id: buf.id, result: ch})
		}
	}
	return inFlight
}

func main() {
	bar := strings.Repeat("=", 72)
	fmt.Println(bar)
	fmt.Println("PHASE 13 LESSON 03 - PARALLEL AND STREAMING TOOL CALLS")
	fmt.Println(bar)

	sumLat, maxLat := 0, 0
	parts := make([]string, 0, len(cityOrder))
	for _, c := range cityOrder {
		v := simulatedLatencyMS[c]
		sumLat += v
		if v > maxLat {
			maxLat = v
		}
		parts = append(parts, fmt.Sprintf("'%s': %d", c, v))
	}

	fmt.Println("\n--- demo 1: three-city weather (simulated) ---")
	fmt.Printf("per-city simulated latency : {%s}\n", strings.Join(parts, ", "))
	fmt.Printf("theoretical sequential     : %d ms  (sum)\n", sumLat)
	fmt.Printf("theoretical parallel       : %d ms  (max)\n", maxLat)

	seqMS, _ := runSequential(cityOrder)
	parMS, _ := runParallel(cityOrder)
	fmt.Printf("\nactual sequential : %.0f ms\n", seqMS)
	fmt.Printf("actual parallel   : %.0f ms\n", parMS)
	speedup := 0.0
	if parMS > 0 {
		speedup = seqMS / parMS
	}
	fmt.Printf("speedup           : %.2fx\n", speedup)

	fmt.Println("\n--- demo 2: stream accumulator ---")
	fmt.Println("replaying fake interleaved stream of three parallel calls ...")
	inFlight := replayAndExecute()
	fmt.Println("\nfinal results (keyed by tool_call_id):")
	for _, f := range inFlight {
		fmt.Printf("  %s -> %s\n", f.id, <-f.result)
	}
}
