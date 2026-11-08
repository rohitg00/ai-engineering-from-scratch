package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"sort"
	"strconv"
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
func Delay(p Policy, client, attempt int) int {
	cap := p.BaseMS
	for i := 1; i < attempt && cap < p.MaxMS; i++ {
		cap *= 2
		if cap > p.MaxMS {
			cap = p.MaxMS
		}
	}
	if p.Jitter {
		x := uint64(client+1)*1103515245 + uint64(attempt)*12345 + uint64(p.Seed)
		x ^= x >> 16
		x *= 2246822519
		x ^= x >> 13
		return int(x % uint64(cap+1))
	}
	return cap
}
func Replay(clients, failUntil, capacity int, p Policy, budget int) (Report, error) {
	r := Report{1, "deterministic-simulation", clients, 0, 0, 0, []Attempt{}}
	if Validate(p) != nil || clients < 0 || clients > 1000 || failUntil < 0 || capacity < 1 || budget < 0 {
		return r, errors.New("invalid replay inputs")
	}
	pending := []Attempt{}
	for i := 0; i < clients; i++ {
		pending = append(pending, Attempt{Client: i, Number: 1})
	}
	loads := map[int]int{}
	for len(pending) > 0 {
		sort.Slice(pending, func(i, j int) bool {
			if pending[i].AtMS != pending[j].AtMS {
				return pending[i].AtMS < pending[j].AtMS
			}
			return pending[i].Client < pending[j].Client
		})
		a := pending[0]
		pending = pending[1:]
		loads[a.AtMS]++
		a.Status = 503
		if a.AtMS >= failUntil && loads[a.AtMS] <= capacity {
			a.Status = 200
			r.Successes++
		}
		r.Calls++
		r.Timeline = append(r.Timeline, a)
		if a.Status != 200 && a.Number < p.Attempts && r.Retries < budget {
			r.Retries++
			pending = append(pending, Attempt{Client: a.Client, Number: a.Number + 1, AtMS: a.AtMS + Delay(p, a.Client, a.Number)})
		}
	}
	return r, nil
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
func (b *Budget) Take() bool {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.remaining <= 0 {
		return false
	}
	b.remaining--
	return true
}
func ServerDelay(value string, now time.Time) (time.Duration, error) {
	if value == "" {
		return 0, nil
	}
	if n, e := strconv.ParseInt(value, 10, 32); e == nil {
		if n < 0 {
			return 0, errors.New("negative Retry-After")
		}
		return time.Duration(n) * time.Second, nil
	}
	t, e := http.ParseTime(value)
	if e != nil {
		return 0, e
	}
	if t.Before(now) {
		return 0, nil
	}
	return t.Sub(now), nil
}
func Fetch(ctx context.Context, client *http.Client, url string, id int, p Policy, budget *Budget) ([]Attempt, error) {
	if e := Validate(p); e != nil {
		return nil, e
	}
	if budget == nil {
		return nil, errors.New("shared budget required")
	}
	start := time.Now()
	out := []Attempt{}
	for n := 1; n <= p.Attempts; n++ {
		req, e := http.NewRequestWithContext(ctx, "GET", url, nil)
		if e != nil {
			return out, e
		}
		req.Header.Set("X-Client-ID", strconv.Itoa(id))
		resp, e := client.Do(req)
		a := Attempt{id, n, int(time.Since(start).Milliseconds()), 0}
		delay := time.Duration(Delay(p, id, n)) * time.Millisecond
		if e != nil {
			out = append(out, a)
			return out, e
		}
		a.Status = resp.StatusCode
		received, readErr := io.Copy(io.Discard, io.LimitReader(resp.Body, 65537))
		resp.Body.Close()
		out = append(out, a)
		if readErr != nil {
			return out, readErr
		}
		if received > 65536 {
			return out, errors.New("response exceeds 64 KiB")
		}
		if a.Status >= 200 && a.Status < 300 {
			return out, nil
		}
		if a.Status != 429 && a.Status != 502 && a.Status != 503 && a.Status != 504 {
			return out, errors.New("non-retryable HTTP status")
		}
		server, e := ServerDelay(resp.Header.Get("Retry-After"), time.Now())
		if e != nil {
			return out, e
		}
		if server > time.Duration(p.MaxMS)*time.Millisecond {
			return out, errors.New("server delay exceeds policy cap")
		}
		if server > delay {
			delay = server
		}
		if n == p.Attempts || !budget.Take() {
			break
		}
		timer := time.NewTimer(delay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return out, ctx.Err()
		case <-timer.C:
		}
	}
	return out, errors.New("retry attempts or shared budget exhausted")
}
func Local(p Policy, clients, budget int) (Report, error) {
	if Validate(p) != nil || clients < 1 || clients > 1000 || budget < 0 {
		return Report{}, errors.New("invalid local policy or client budget")
	}
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
