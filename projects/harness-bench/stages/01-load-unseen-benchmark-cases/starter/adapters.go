package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

type Settings struct {
	Temperature float64 `json:"temperature"`
	MaxTokens   int     `json:"max_tokens"`
}
type ModelConfig struct {
	Adapter         string   `json:"adapter"`
	Model           string   `json:"model"`
	Endpoint        string   `json:"endpoint,omitempty"`
	Settings        Settings `json:"settings"`
	RecordingSHA256 string   `json:"recording_sha256,omitempty"`
}
type RecordedResponse struct {
	Answer string `json:"answer"`
	Error  string `json:"error,omitempty"`
}
type Recording struct {
	Kind      string                        `json:"kind"`
	Model     string                        `json:"model"`
	Settings  Settings                      `json:"settings"`
	Responses map[string][]RecordedResponse `json:"responses"`
}

func Fingerprint(value any) string {
	data, _ := json.Marshal(value)
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:])
}
func DecodeStrict(data []byte, target any) error {
	if len(data) > 1024*1024 {
		return ErrLimit
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return ErrInvalid
	}
	return nil
}
func ReadBounded(path string) ([]byte, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, 1024*1024+1))
	if len(data) > 1024*1024 {
		return nil, ErrLimit
	}
	return data, err
}
func LoadRecording(data []byte) (Recording, error) {
	var r Recording
	if err := DecodeStrict(data, &r); err != nil {
		return r, err
	}
	if r.Kind != "authored_fixture" && r.Kind != "recorded_provider" {
		return r, ErrInvalid
	}
	if r.Model == "" || r.Settings.MaxTokens < 1 || r.Settings.Temperature < 0 || r.Settings.Temperature > 2 || len(r.Responses) == 0 {
		return r, ErrInvalid
	}
	for p, replies := range r.Responses {
		if strings.TrimSpace(p) == "" || len(replies) == 0 || len(replies) > 32 {
			return r, ErrInvalid
		}
	}
	return r, nil
}
func (r Recording) NewModel() ContextModel {
	positions := map[string]int{}
	return func(ctx context.Context, prompt string) (string, error) {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		position := positions[prompt]
		replies := r.Responses[prompt]
		if position >= len(replies) {
			return "", fmt.Errorf("recording exhausted for requested prompt")
		}
		positions[prompt]++
		reply := replies[position]
		if reply.Error != "" {
			return "", fmt.Errorf("recorded provider failure")
		}
		return reply.Answer, nil
	}
}
func HTTPModel(config ModelConfig, keyEnv string) (ContextModel, error) {
	u, err := url.Parse(config.Endpoint)
	if err != nil || u.Hostname() == "" || u.User != nil || u.Fragment != "" || u.RawQuery != "" {
		return nil, ErrInvalid
	}
	local := u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"
	if u.Scheme != "https" && !(u.Scheme == "http" && local) {
		return nil, ErrInvalid
	}
	if config.Model == "" || config.Settings.MaxTokens < 1 || config.Settings.Temperature < 0 || config.Settings.Temperature > 2 {
		return nil, ErrInvalid
	}
	key := ""
	if keyEnv != "" {
		key = os.Getenv(keyEnv)
		if key == "" {
			return nil, fmt.Errorf("missing credential environment variable %s", keyEnv)
		}
	}
	client := &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return func(ctx context.Context, prompt string) (string, error) {
		body, _ := json.Marshal(map[string]any{"model": config.Model, "temperature": config.Settings.Temperature, "max_tokens": config.Settings.MaxTokens, "messages": []map[string]string{{"role": "user", "content": prompt}}})
		req, err := http.NewRequestWithContext(ctx, http.MethodPost, config.Endpoint, bytes.NewReader(body))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", "application/json")
		if key != "" {
			req.Header.Set("Authorization", "Bearer "+key)
		}
		response, err := client.Do(req)
		if err != nil {
			return "", fmt.Errorf("provider transport failed")
		}
		defer response.Body.Close()
		data, err := io.ReadAll(io.LimitReader(response.Body, 1024*1024+1))
		if err != nil {
			return "", fmt.Errorf("provider response read failed")
		}
		if len(data) > 1024*1024 {
			return "", ErrLimit
		}
		if response.StatusCode < 200 || response.StatusCode >= 300 {
			return "", fmt.Errorf("provider HTTP %d", response.StatusCode)
		}
		var result struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
		}
		if json.Unmarshal(data, &result) != nil || len(result.Choices) != 1 {
			return "", ErrInvalid
		}
		return result.Choices[0].Message.Content, nil
	}, nil
}
