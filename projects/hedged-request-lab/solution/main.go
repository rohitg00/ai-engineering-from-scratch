package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"sort"
	"sync/atomic"
	"time"
)

type Distribution struct {
	Samples int     `json:"samples"`
	P50MS   float64 `json:"p50Ms"`
	P95MS   float64 `json:"p95Ms"`
	MaxMS   float64 `json:"maxMs"`
}

func Summarize(values []float64) (Distribution, error) {
	d := Distribution{}
	if len(values) == 0 {
		return d, errors.New("at least one sample required")
	}
	copyValues := append([]float64{}, values...)
	for _, v := range copyValues {
		if math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
			return d, errors.New("latencies must be finite and nonnegative")
		}
	}
	sort.Float64s(copyValues)
	at := func(p float64) float64 { return copyValues[int(math.Ceil(p*float64(len(copyValues))))-1] }
	return Distribution{len(values), at(.5), at(.95), copyValues[len(copyValues)-1]}, nil
}

type Attempt struct {
	Index     int     `json:"index"`
	Status    int     `json:"status"`
	Valid     bool    `json:"valid"`
	Cancelled bool    `json:"cancelled"`
	Late      bool    `json:"late"`
	ElapsedMS float64 `json:"elapsedMs"`
	Value     string  `json:"value,omitempty"`
	Error     string  `json:"error,omitempty"`
}
type Receipt struct {
	SchemaVersion   int       `json:"schemaVersion"`
	Winner          int       `json:"winner"`
	Value           string    `json:"value,omitempty"`
	LatencyMS       float64   `json:"latencyMs"`
	Launched        int       `json:"launched"`
	CancelRequested int       `json:"cancelRequested"`
	Unobserved      int       `json:"unobserved"`
	Attempts        []Attempt `json:"attempts"`
}

func SafeURL(s string) error {
	u, e := url.Parse(s)
	if e != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") || u.User != nil || u.Fragment != "" {
		return errors.New("expected HTTP(S) URL without userinfo or fragment")
	}
	return nil
}
func ValidBody(status int, body []byte) (string, error) {
	if status != 200 {
		return "", errors.New("winner requires HTTP 200")
	}
	if len(body) > 65536 {
		return "", errors.New("body exceeds 64 KiB")
	}
	var x struct {
		Value string `json:"value"`
	}
	if e := json.Unmarshal(body, &x); e != nil || x.Value == "" {
		return "", errors.New("expected JSON with nonempty value")
	}
	return x.Value, nil
}
func Read(ctx context.Context, client *http.Client, endpoint string, index int) Attempt {
	start := time.Now()
	a := Attempt{Index: index}
	req, e := http.NewRequestWithContext(ctx, "GET", endpoint, nil)
	if e == nil {
		var r *http.Response
		r, e = client.Do(req)
		if e == nil {
			a.Status = r.StatusCode
			body, err := io.ReadAll(io.LimitReader(r.Body, 65537))
			r.Body.Close()
			if err != nil {
				e = err
			} else {
				a.Value, e = ValidBody(r.StatusCode, body)
			}
		}
	}
	a.ElapsedMS = float64(time.Since(start)) / float64(time.Millisecond)
	a.Valid = e == nil
	if e != nil {
		a.Error = e.Error()
	}
	a.Cancelled = ctx.Err() != nil
	return a
}
func Hedged(parent context.Context, client *http.Client, endpoints []string, delay time.Duration) (Receipt, error) {
	receipt := Receipt{SchemaVersion: 1, Winner: -1, Attempts: []Attempt{}}
	if len(endpoints) < 1 || len(endpoints) > 2 || delay < 0 || delay > time.Second {
		return receipt, errors.New("one or two read endpoints and delay 0..1s required")
	}
	for _, e := range endpoints {
		if err := SafeURL(e); err != nil {
			return receipt, err
		}
	}
	ctx, cancel := context.WithTimeout(parent, 2*time.Second)
	defer cancel()
	start := time.Now()
	results := make(chan Attempt, 2)
	launch := func(i int) { receipt.Launched++; go func() { results <- Read(ctx, client, endpoints[i], i) }() }
	launch(0)
	timer := time.NewTimer(delay)
	defer timer.Stop()
	launchedSecond := len(endpoints) == 1
	received := 0
	for {
		if ctx.Err() != nil {
			cancel()
			receipt.LatencyMS = float64(time.Since(start)) / float64(time.Millisecond)
			receipt.Unobserved = receipt.Launched - received
			return receipt, ctx.Err()
		}
		select {
		case a := <-results:
			received++
			receipt.Attempts = append(receipt.Attempts, a)
			if a.Valid {
				receipt.Winner = a.Index
				receipt.Value = a.Value
				receipt.LatencyMS = float64(time.Since(start)) / float64(time.Millisecond)
				receipt.CancelRequested = receipt.Launched - received
				cancel()
				grace := time.NewTimer(100 * time.Millisecond)
				for received < receipt.Launched {
					select {
					case late := <-results:
						late.Late = true
						receipt.Attempts = append(receipt.Attempts, late)
						received++
					case <-grace.C:
						receipt.Unobserved = receipt.Launched - received
						return receipt, nil
					}
				}
				grace.Stop()
				return receipt, nil
			}
			if received == len(endpoints) {
				receipt.LatencyMS = float64(time.Since(start)) / float64(time.Millisecond)
				return receipt, errors.New("no valid response")
			}
		case <-timer.C:
			if !launchedSecond && ctx.Err() == nil {
				launch(1)
				launchedSecond = true
			}
		case <-ctx.Done():
		}
	}
}

type Work struct {
	Started              int32 `json:"started"`
	Completed            int32 `json:"completed"`
	CancellationObserved int32 `json:"cancellationObserved"`
}
type Comparison struct {
	SchemaVersion int          `json:"schemaVersion"`
	Scope         string       `json:"scope"`
	Baseline      Distribution `json:"baseline"`
	Hedged        Distribution `json:"hedged"`
	BaselineCalls int          `json:"baselineCalls"`
	HedgedCalls   int          `json:"hedgedCalls"`
	Work          Work         `json:"fixtureWork"`
	Receipts      []Receipt    `json:"receipts"`
}

func Compare(samples int, delay time.Duration) (Comparison, error) {
	var started, completed, cancelled atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started.Add(1)
		d := 80 * time.Millisecond
		if r.URL.Path == "/fast" {
			d = 5 * time.Millisecond
		}
		time.Sleep(d)
		if r.Context().Err() != nil {
			cancelled.Add(1)
		}
		completed.Add(1)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"value":"same versioned read"}`)
	}))
	defer server.Close()
	return CompareEndpoints(samples, delay, server.Client(), server.URL+"/slow", server.URL+"/fast", func() Work { server.Close(); return Work{started.Load(), completed.Load(), cancelled.Load()} })
}
func CompareEndpoints(samples int, delay time.Duration, client *http.Client, primary, secondary string, work func() Work) (Comparison, error) {
	c := Comparison{SchemaVersion: 1, Scope: "controlled read comparison", Receipts: []Receipt{}}
	if samples < 1 || samples > 100 {
		return c, errors.New("samples must be 1..100")
	}
	base, hedges := []float64{}, []float64{}
	for i := 0; i < samples; i++ {
		a, e := Hedged(context.Background(), client, []string{primary}, delay)
		if e != nil {
			return c, e
		}
		base = append(base, a.LatencyMS)
		c.BaselineCalls += a.Launched
		b, e := Hedged(context.Background(), client, []string{primary, secondary}, delay)
		if e != nil {
			return c, e
		}
		hedges = append(hedges, b.LatencyMS)
		c.HedgedCalls += b.Launched
		c.Receipts = append(c.Receipts, b)
	}
	c.Baseline, _ = Summarize(base)
	c.Hedged, _ = Summarize(hedges)
	if work != nil {
		c.Work = work()
		c.Scope = "local fixture; server deliberately continues work after client cancellation"
	}
	return c, nil
}
func main() {
	delay := flag.Int("delay-ms", 10, "hedge delay")
	samples := flag.Int("samples", 3, "samples per policy")
	primary := flag.String("primary", "", "optional safe read endpoint")
	secondary := flag.String("secondary", "", "optional duplicate safe read endpoint")
	out := flag.String("out", "/tmp/aiefs-hedge-report.json", "receipt file")
	flag.Parse()
	var c Comparison
	var e error
	if *primary == "" && *secondary == "" {
		c, e = Compare(*samples, time.Duration(*delay)*time.Millisecond)
	} else {
		client := &http.Client{Timeout: 2 * time.Second, CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}
		c, e = CompareEndpoints(*samples, time.Duration(*delay)*time.Millisecond, client, *primary, *secondary, nil)
	}
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	b, _ := json.MarshalIndent(c, "", "  ")
	if e = os.WriteFile(*out, append(b, '\n'), 0600); e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	fmt.Println(string(b))
}
