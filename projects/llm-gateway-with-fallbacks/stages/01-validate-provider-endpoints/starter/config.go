package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"time"
)

var providerNamePattern = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)
var environmentNamePattern = regexp.MustCompile(`^[A-Za-z_][A-Za-z0-9_]*$`)

type Provider struct {
	Name   string `json:"name"`
	URL    string `json:"url"`
	KeyEnv string `json:"key_env,omitempty"`
	Model  string `json:"model,omitempty"`
}
type Config struct {
	Providers   []Provider `json:"providers"`
	MaxAttempts int        `json:"max_attempts"`
	MaxBytes    int64      `json:"max_response_bytes"`
	TimeoutMS   int        `json:"timeout_ms"`
}

func ReadBounded(path string) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, MaxRequestBytes+1))
	if len(data) > MaxRequestBytes {
		return nil, ErrLimit
	}
	return data, err
}
func ParseConfig(data []byte) (Config, error) {
	var config Config
	if len(data) > MaxRequestBytes {
		return config, ErrLimit
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&config); err != nil {
		return config, err
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return config, ErrInvalid
	}
	return config, config.Validate()
}
func (c Config) Validate() error {
	if len(c.Providers) < 1 || len(c.Providers) > 16 || c.MaxAttempts < 1 || c.MaxAttempts > 16 || c.MaxBytes < 1 || c.MaxBytes > 16*1024*1024 || c.TimeoutMS < 1 || c.TimeoutMS > 5000 {
		return ErrInvalid
	}
	names := map[string]bool{}
	urls := map[string]bool{}
	for _, p := range c.Providers {
		if !providerNamePattern.MatchString(p.Name) || names[p.Name] || urls[p.URL] {
			return ErrConflict
		}
		if _, err := Endpoints([]string{p.URL}); err != nil {
			return err
		}
		if p.KeyEnv != "" && !environmentNamePattern.MatchString(p.KeyEnv) {
			return ErrInvalid
		}
		names[p.Name] = true
		urls[p.URL] = true
	}
	return nil
}

type providerTransport struct {
	base      http.RoundTripper
	providers map[string]Provider
	keys      map[string]string
}

func (t providerTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	provider, ok := t.providers[req.URL.String()]
	if !ok {
		return nil, ErrInvalid
	}
	outbound := req.Clone(req.Context())
	outbound.Header = req.Header.Clone()
	outbound.Header.Del("Authorization")
	if key := t.keys[provider.URL]; key != "" {
		outbound.Header.Set("Authorization", "Bearer "+key)
	}
	if provider.Model != "" {
		data, err := io.ReadAll(io.LimitReader(req.Body, MaxRequestBytes+1))
		req.Body.Close()
		if err != nil || len(data) > MaxRequestBytes {
			return nil, ErrInvalid
		}
		var payload map[string]any
		decoder := json.NewDecoder(bytes.NewReader(data))
		decoder.UseNumber()
		if decoder.Decode(&payload) != nil || payload == nil {
			return nil, ErrInvalid
		}
		payload["model"] = provider.Model
		data, err = json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		outbound.Body = io.NopCloser(bytes.NewReader(data))
		outbound.GetBody = func() (io.ReadCloser, error) { return io.NopCloser(bytes.NewReader(data)), nil }
		outbound.ContentLength = int64(len(data))
	}
	return t.base.RoundTrip(outbound)
}
func RouteConfigured(ctx context.Context, client *http.Client, config Config, payload string) (Outcome, error) {
	if err := config.Validate(); err != nil {
		return Outcome{}, err
	}
	if client == nil {
		return Outcome{}, ErrInvalid
	}
	if !validPayload([]byte(payload)) {
		return Outcome{}, ErrInvalid
	}
	endpoints := []string{}
	providers := map[string]Provider{}
	keys := map[string]string{}
	for _, p := range config.Providers {
		endpoints = append(endpoints, p.URL)
		providers[p.URL] = p
		if p.KeyEnv != "" {
			key := os.Getenv(p.KeyEnv)
			if key == "" {
				return Outcome{}, fmt.Errorf("missing credential environment variable %s", p.KeyEnv)
			}
			keys[p.URL] = key
		}
	}
	configured := *client
	base := client.Transport
	if base == nil {
		base = http.DefaultTransport
	}
	configured.Transport = providerTransport{base: base, providers: providers, keys: keys}
	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.TimeoutMS)*time.Millisecond)
	defer cancel()
	return Route(ctx, &configured, endpoints, payload, config.MaxAttempts, config.MaxBytes)
}
func validPayload(data []byte) bool {
	if len(data) > MaxRequestBytes {
		return false
	}
	var body map[string]any
	if json.Unmarshal(data, &body) != nil || body == nil {
		return false
	}
	if stream, exists := body["stream"]; exists && stream != false {
		return false
	}
	return true
}
func writeGatewayError(w http.ResponseWriter, status int, message, state string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(struct {
		Error string `json:"error"`
		State string `json:"state,omitempty"`
	}{message, state})
}

func GatewayHandler(config Config, client *http.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if r.URL.Path != "/v1/chat/completions" {
			writeGatewayError(w, 404, "not-found", "")
			return
		}
		if r.Method != http.MethodPost {
			w.Header().Set("Allow", "POST")
			writeGatewayError(w, 405, "method", "")
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, MaxRequestBytes))
		if err != nil {
			writeGatewayError(w, 413, "request-limit", "")
			return
		}
		if !validPayload(body) {
			writeGatewayError(w, 400, "expected non-streaming JSON object", "")
			return
		}
		result, err := RouteConfigured(r.Context(), client, config, string(body))
		w.Header().Set("X-Gateway-Attempts", strconv.Itoa(result.Attempts))
		if err != nil {
			status := 502
			if result.State == "cancelled" {
				status = 504
			}
			writeGatewayError(w, status, "gateway-failed", result.State)
			return
		}
		for _, p := range config.Providers {
			if p.URL == result.Reply.Endpoint {
				w.Header().Set("X-Gateway-Provider", p.Name)
			}
		}
		w.WriteHeader(result.Reply.Status)
		io.WriteString(w, result.Reply.Body)
	})
}
