package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"
)

type WorkerOptions struct {
	Worker          string
	Now             func() int64
	LeaseMS         int64
	Delay           time.Duration
	CrashAfterClaim bool
}

func normalized(text string) string { return strings.ToLower(strings.Join(strings.Fields(text), " ")) }
func WorkShard(directory string, options WorkerOptions) (map[string]any, error) {
	if options.Worker == "" || options.Now == nil || options.LeaseMS <= 0 || options.Delay < 0 || options.Delay > time.Minute {
		return nil, ErrInvalid
	}
	claim, cases, err := ClaimShard(directory, options.Worker, options.Now(), options.LeaseMS)
	if err != nil {
		return nil, err
	}
	if claim == nil {
		return map[string]any{"claimed": false, "worker_pid": os.Getpid()}, nil
	}
	if options.CrashAfterClaim {
		fmt.Printf("{\"crash_after\":\"claim\",\"shard\":%q,\"version\":%d}\n", claim.Lease.Shard, claim.Lease.Version)
		os.Exit(86)
	}
	time.Sleep(options.Delay)
	receipt := ShardResult{WorkerPID: os.Getpid(), Cases: []CaseResult{}, Total: len(cases)}
	for _, c := range cases {
		correct := normalized(c.Expected) == normalized(c.Response)
		receipt.Cases = append(receipt.Cases, CaseResult{c.ID, correct})
		if correct {
			receipt.Correct++
		}
	}
	if err = CompleteShard(directory, *claim, options.Now(), receipt); err != nil {
		return nil, fmt.Errorf("completion fenced for %s v%d: %w", claim.Lease.Shard, claim.Lease.Version, err)
	}
	return map[string]any{"claimed": true, "shard": claim.Lease.Shard, "worker_pid": os.Getpid(), "version": claim.Lease.Version, "correct": receipt.Correct, "total": receipt.Total}, nil
}
func RunFarm(ctx context.Context, directory string, workers int, now, ttl, delay int64) (map[string]any, error) {
	if workers < 1 || workers > 64 || now < -1 || ttl <= 0 || delay < 0 || delay > 60000 {
		return nil, ErrInvalid
	}
	executable, err := os.Executable()
	if err != nil {
		return nil, err
	}
	status, err := FarmStatus(directory)
	if err != nil {
		return nil, err
	}
	waves := status["active_shards"].(int)
	events := []json.RawMessage{}
	for wave := 0; wave < waves && !status["complete"].(bool); wave++ {
		ids := make([]string, workers)
		for i := range ids {
			ids[i] = fmt.Sprintf("worker-%d", i+1)
		}
		items, err := Parallel(ctx, ids, workers, func(ctx context.Context, id string) (string, error) {
			args := []string{"worker", "--store", directory, "--worker-id", id, "--now-ms", strconv.FormatInt(now, 10), "--lease-ms", strconv.FormatInt(ttl, 10), "--delay-ms", strconv.FormatInt(delay, 10)}
			raw, err := exec.CommandContext(ctx, executable, args...).CombinedOutput()
			if err != nil {
				return "", fmt.Errorf("%s: %w: %s", id, err, raw)
			}
			return string(raw), nil
		})
		if err != nil {
			return nil, err
		}
		progress := false
		for _, item := range items {
			var event struct {
				Claimed bool `json:"claimed"`
			}
			if err = json.Unmarshal([]byte(item.Value), &event); err != nil {
				return nil, err
			}
			progress = progress || event.Claimed
			events = append(events, json.RawMessage(item.Value))
		}
		status, err = FarmStatus(directory)
		if err != nil {
			return nil, err
		}
		if !progress {
			break
		}
	}
	status["worker_events"] = events
	return status, nil
}
