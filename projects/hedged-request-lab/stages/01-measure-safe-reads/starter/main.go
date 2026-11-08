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
	"net/url"
	"os"
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
	return Distribution{}, errors.New("TODO stage 1: percentiles")
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
func ValidBody(status int, body []byte) (string, error) { return string(body), nil }

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
	return Receipt{}, errors.New("TODO stage 2: hedging")
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
	return Comparison{}, errors.New("TODO stage 4: export comparison")
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
