package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"sync"
	"time"
)

type Policy struct {
	BaseMS   int  `json:"baseMs"`
	MaxMS    int  `json:"maxMs"`
	Attempts int  `json:"attempts"`
	Jitter   bool `json:"jitter"`
	Seed     int  `json:"seed"`
}
type Attempt struct {
	Client int `json:"client"`
	Number int `json:"attempt"`
	AtMS   int `json:"atMs"`
	Status int `json:"status"`
}
type Report struct {
	SchemaVersion int       `json:"schemaVersion"`
	Mode          string    `json:"mode"`
	Clients       int       `json:"clients"`
	Calls         int       `json:"calls"`
	Successes     int       `json:"successes"`
	Retries       int       `json:"retries"`
	Timeline      []Attempt `json:"timeline"`
}

func Validate(p Policy) error {
	if p.BaseMS < 1 || p.MaxMS < p.BaseMS || p.MaxMS > 60000 || p.Attempts < 1 || p.Attempts > 10 {
		return errors.New("invalid bounded policy")
	}
	return nil
}
func Delay(p Policy, client, attempt int) int { return p.BaseMS }
func Replay(clients, failUntil, capacity int, p Policy, budget int) (Report, error) {
	return Report{}, errors.New("TODO stage 1: replay")
}

type Budget struct {
	mu        sync.Mutex
	remaining int
}

func NewBudget(n int) *Budget {
	if n < 0 {
		n = 0
	}
	return &Budget{remaining: n}
}
func (b *Budget) Take() bool { return false }

func ServerDelay(value string, now time.Time) (time.Duration, error) {
	return 0, errors.New("TODO stage 3: server delay")
}
func Fetch(ctx context.Context, client *http.Client, url string, id int, p Policy, budget *Budget) ([]Attempt, error) {
	return nil, errors.New("TODO stage 4: HTTP policy")
}
func Local(p Policy, clients, budget int) (Report, error) {
	var mu sync.Mutex
	seen := map[string]int{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		seen[r.Header.Get("X-Client-ID")]++
		n := seen[r.Header.Get("X-Client-ID")]
		mu.Unlock()
		if n == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(503)
			fmt.Fprint(w, "busy")
			return
		}
		fmt.Fprint(w, "ready")
	}))
	defer server.Close()
	shared := NewBudget(budget)
	report := Report{1, "local-http-fixture", clients, 0, 0, 0, []Attempt{}}
	var wg sync.WaitGroup
	for i := 0; i < clients; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			defer cancel()
			trace, e := Fetch(ctx, server.Client(), server.URL, id, p, shared)
			mu.Lock()
			report.Timeline = append(report.Timeline, trace...)
			report.Calls += len(trace)
			report.Retries += max(0, len(trace)-1)
			if e == nil {
				report.Successes++
			}
			mu.Unlock()
		}(i)
	}
	wg.Wait()
	sort.Slice(report.Timeline, func(i, j int) bool {
		a, b := report.Timeline[i], report.Timeline[j]
		if a.AtMS != b.AtMS {
			return a.AtMS < b.AtMS
		}
		return a.Client < b.Client
	})
	return report, nil
}
func main() {
	clients := flag.Int("clients", 20, "concurrent clients")
	budget := flag.Int("budget", 12, "shared retry attempts")
	seed := flag.Int("seed", 7, "jitter seed")
	jitter := flag.Bool("jitter", true, "spread retry delays")
	base := flag.Int("base-ms", 10, "initial backoff")
	cap := flag.Int("max-ms", 80, "maximum retry wait")
	attempts := flag.Int("attempts", 4, "maximum attempts per client")
	failure := flag.Int("fail-until-ms", 12, "simulated failure window")
	capacity := flag.Int("capacity", 5, "simulated capacity per exact millisecond")
	out := flag.String("out", "/tmp/aiefs-retry-report.json", "receipt path")
	live := flag.Bool("local-http", false, "run finite loopback fixture")
	flag.Parse()
	p := Policy{*base, *cap, *attempts, *jitter, *seed}
	var r Report
	var e error
	if *live {
		if *clients < 1 || *clients > 1000 || *budget < 0 {
			e = errors.New("invalid client or budget limit")
		} else {
			r, e = Local(p, *clients, *budget)
		}
	} else {
		r, e = Replay(*clients, *failure, *capacity, p, *budget)
	}
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	data, _ := json.MarshalIndent(r, "", "  ")
	if e = os.WriteFile(*out, append(data, '\n'), 0600); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	fmt.Println(string(data))
}
