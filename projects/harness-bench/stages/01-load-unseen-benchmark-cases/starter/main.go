package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"
)

func run() error {
	casesPath := flag.String("cases", "fixtures/orchard-cases.json", "case JSON array")
	recordingPath := flag.String("recording", "fixtures/orchard-recording.json", "bounded response recording")
	endpoint := flag.String("endpoint", "", "optional chat-completions HTTP endpoint; disables recordings")
	modelName := flag.String("model", "", "HTTP model identifier")
	keyEnv := flag.String("key-env", "", "environment variable holding the provider key")
	temperature := flag.Float64("temperature", 0, "HTTP sampling temperature")
	maxTokens := flag.Int("max-tokens", 128, "HTTP output token ceiling")
	budget := flag.Int("budget", 4, "model calls available to each policy")
	timeout := flag.Duration("timeout", 30*time.Second, "total deadline per policy")
	output := flag.String("out", "", "write JSON receipt and per-call traces")
	flag.Parse()
	if *budget < 0 || *budget > 10000 || *timeout <= 0 || *timeout > 5*time.Minute {
		return ErrInvalid
	}
	data, err := ReadBounded(*casesPath)
	if err != nil {
		return err
	}
	cases, err := Cases(data, 1000)
	if err != nil {
		return err
	}
	if len(cases) == 0 {
		return ErrInvalid
	}
	var factory func() ContextModel
	var config ModelConfig
	scope := ""
	if *endpoint == "" {
		data, err = ReadBounded(*recordingPath)
		if err != nil {
			return err
		}
		recording, err := LoadRecording(data)
		if err != nil {
			return err
		}
		config = ModelConfig{Adapter: "recording", Model: recording.Model, Settings: recording.Settings, RecordingSHA256: Fingerprint(recording)}
		factory = recording.NewModel
		scope = recording.Kind
	} else {
		config = ModelConfig{Adapter: "http", Model: *modelName, Endpoint: *endpoint, Settings: Settings{Temperature: *temperature, MaxTokens: *maxTokens}}
		model, err := HTTPModel(config, *keyEnv)
		if err != nil {
			return err
		}
		factory = func() ContextModel { return model }
		scope = "live_http_sequential_runs"
	}
	results := []Result{}
	for _, policy := range []string{"baseline", "retry-errors", "evidence"} {
		ctx, cancel := context.WithTimeout(context.Background(), *timeout)
		result, err := EvaluatePolicy(ctx, policy, policy, cases, factory(), *budget, Fingerprint(config))
		cancel()
		if err != nil {
			return err
		}
		results = append(results, result)
	}
	table, err := Leaderboard(results)
	if err != nil {
		return err
	}
	fmt.Printf("SCOPE %s\nMODEL %s\nDATASET %s\n%s", scope, config.Model, Fingerprint(cases), table)
	if *output != "" {
		receipt := struct {
			SchemaVersion int         `json:"schema_version"`
			Scope         string      `json:"scope"`
			Model         ModelConfig `json:"model"`
			Results       []Result    `json:"results"`
		}{1, scope, config, results}
		data, err = json.MarshalIndent(receipt, "", "  ")
		if err != nil {
			return err
		}
		return os.WriteFile(*output, append(data, '\n'), 0600)
	}
	return nil
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "harness:", err)
		os.Exit(1)
	}
}
