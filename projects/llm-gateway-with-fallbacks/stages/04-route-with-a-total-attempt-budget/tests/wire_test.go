package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

func configFor(servers ...*httptest.Server) Config {
	c := Config{MaxAttempts: len(servers), MaxBytes: 4096, TimeoutMS: 1000}
	for i, s := range servers {
		c.Providers = append(c.Providers, Provider{Name: []string{"primary", "backup"}[i], URL: s.URL})
	}
	return c
}
func TestActualProxySeparatesProviderCredentials(t *testing.T) {
	t.Setenv("GATEWAY_PRIMARY_TEST_KEY", "primary-fixture-key")
	t.Setenv("GATEWAY_BACKUP_TEST_KEY", "backup-fixture-key")
	var first, second atomic.Int32
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		first.Add(1)
		if r.Header.Get("Authorization") != "Bearer primary-fixture-key" || r.Header.Get("X-Caller-Secret") != "" {
			t.Error("caller headers escaped")
		}
		w.WriteHeader(503)
		io.WriteString(w, `{"error":"busy"}`)
	}))
	defer primary.Close()
	backup := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		second.Add(1)
		if r.Header.Get("Authorization") != "Bearer backup-fixture-key" {
			t.Error("wrong backup auth")
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["model"] != "backup-model" {
			t.Error("model override absent")
		}
		io.WriteString(w, `{"choices":[{"message":{"content":"ready"}}]}`)
	}))
	defer backup.Close()
	config := configFor(primary, backup)
	config.Providers[0].KeyEnv = "GATEWAY_PRIMARY_TEST_KEY"
	config.Providers[1].KeyEnv = "GATEWAY_BACKUP_TEST_KEY"
	config.Providers[1].Model = "backup-model"
	proxy := httptest.NewServer(GatewayHandler(config, http.DefaultClient))
	defer proxy.Close()
	request, _ := http.NewRequest("POST", proxy.URL+"/v1/chat/completions", strings.NewReader(`{"model":"caller-model","messages":[{"role":"user","content":"state?"}]}`))
	request.Header.Set("Authorization", "Bearer caller-key-never-forward")
	request.Header.Set("X-Caller-Secret", "private")
	response, e := http.DefaultClient.Do(request)
	if e != nil {
		t.Fatal(e)
	}
	defer response.Body.Close()
	body, _ := io.ReadAll(response.Body)
	if response.StatusCode != 200 || response.Header.Get("X-Gateway-Attempts") != "2" || response.Header.Get("X-Gateway-Provider") != "backup" || first.Load() != 1 || second.Load() != 1 || !strings.Contains(string(body), "ready") {
		t.Fatal(response.Status, response.Header, string(body), first.Load(), second.Load())
	}
}
func TestConfiguredBackgroundContextHasOverallDeadline(t *testing.T) {
	started := make(chan struct{}, 1)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started <- struct{}{}
		select {
		case <-r.Context().Done():
		case <-time.After(time.Second):
		}
	}))
	defer server.Close()
	config := configFor(server)
	config.TimeoutMS = 40
	begin := time.Now()
	result, e := RouteConfigured(context.Background(), http.DefaultClient, config, `{}`)
	if !errors.Is(e, context.DeadlineExceeded) || result.State != "cancelled" || result.Attempts != 1 || time.Since(begin) > 500*time.Millisecond {
		t.Fatal(result, e, time.Since(begin))
	}
	select {
	case <-started:
	default:
		t.Fatal("wire not contacted")
	}
}
func TestDefaultRouteCreatesDeadlineWithoutCallerDeadline(t *testing.T) {
	client := &http.Client{Transport: transportFunc(func(r *http.Request) (*http.Response, error) {
		deadline, ok := r.Context().Deadline()
		if !ok || time.Until(deadline) > DefaultTimeout {
			t.Error("missing default deadline")
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("ok"))}, nil
	})}
	if _, e := Route(context.Background(), client, []string{"https://a.test"}, `{}`, 1, 10); e != nil {
		t.Fatal(e)
	}
}
func TestDeadlineSharedAcrossProviders(t *testing.T) {
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { time.Sleep(35 * time.Millisecond); w.WriteHeader(503) }))
	defer primary.Close()
	backup := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(100 * time.Millisecond):
			io.WriteString(w, "ok")
		case <-r.Context().Done():
		}
	}))
	defer backup.Close()
	config := configFor(primary, backup)
	config.TimeoutMS = 65
	begin := time.Now()
	out, e := RouteConfigured(context.Background(), http.DefaultClient, config, `{}`)
	if !errors.Is(e, context.DeadlineExceeded) || out.State != "cancelled" || time.Since(begin) > 250*time.Millisecond {
		t.Fatal(out, e, time.Since(begin))
	}
}
func TestActualWireResponseLimitStopsFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { io.WriteString(w, "0123456789") }))
	defer server.Close()
	config := configFor(server)
	config.MaxBytes = 5
	out, e := RouteConfigured(context.Background(), http.DefaultClient, config, `{}`)
	if e != ErrLimit || out.State != "response-limit" || out.Attempts != 1 {
		t.Fatal(out, e)
	}
}
func TestNoRedirectCredentialLeakOnWire(t *testing.T) {
	var contacted atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { contacted.Add(1) }))
	defer target.Close()
	source := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, target.URL, 307) }))
	defer source.Close()
	out, e := RouteConfigured(context.Background(), http.DefaultClient, configFor(source), `{}`)
	if e == nil || out.State != "terminal-error" || contacted.Load() != 0 {
		t.Fatal(out, e, contacted.Load())
	}
}
func TestConfigRejectsInlineKeysAndQueryCredentials(t *testing.T) {
	for _, data := range []string{`{"providers":[{"name":"p","url":"https://a.test","api_key":"secret"}],"max_attempts":1,"max_response_bytes":100,"timeout_ms":50}`, `{"providers":[{"name":"p","url":"https://a.test?api_key=secret"}],"max_attempts":1,"max_response_bytes":100,"timeout_ms":50}`} {
		if _, e := ParseConfig([]byte(data)); e == nil {
			t.Fatal("unsafe config accepted")
		}
	}
}
func TestMissingCredentialFailsBeforeAnyRequest(t *testing.T) {
	t.Setenv("GATEWAY_MISSING_TEST_KEY", "")
	var contacted atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { contacted.Add(1) }))
	defer server.Close()
	config := configFor(server)
	config.Providers[0].KeyEnv = "GATEWAY_MISSING_TEST_KEY"
	out, e := RouteConfigured(context.Background(), http.DefaultClient, config, `{}`)
	if e == nil || out.Attempts != 0 || contacted.Load() != 0 {
		t.Fatal(out, e)
	}
}
func TestProxyRejectsStreamingAndOversizedInput(t *testing.T) {
	handler := GatewayHandler(Config{}, http.DefaultClient)
	for _, body := range []string{`{"stream":true}`, strings.Repeat("x", MaxRequestBytes+1)} {
		request := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(body))
		response := httptest.NewRecorder()
		handler.ServeHTTP(response, request)
		if response.Code != 400 && response.Code != 413 {
			t.Fatal(response.Code)
		}
	}
}

func TestModelRewritePreservesLargeJSONIntegers(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), `9007199254740993`) {
			t.Error("integer changed", string(body))
		}
		io.WriteString(w, `{}`)
	}))
	defer server.Close()
	config := configFor(server)
	config.Providers[0].Model = "local-model"
	if _, e := RouteConfigured(context.Background(), http.DefaultClient, config, `{"seed":9007199254740993}`); e != nil {
		t.Fatal(e)
	}
}
func TestProxyErrorsAreJSON(t *testing.T) {
	request := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"stream":true}`))
	response := httptest.NewRecorder()
	GatewayHandler(Config{}, http.DefaultClient).ServeHTTP(response, request)
	if response.Header().Get("Content-Type") != "application/json" || !json.Valid(response.Body.Bytes()) {
		t.Fatal(response.Header(), response.Body.String())
	}
}
