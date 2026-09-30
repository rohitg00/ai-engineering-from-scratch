package main

import (
	"context"
	"errors"
	"net/http"
	"time"
)

func Route(ctx context.Context, client *http.Client, providers []string, payload string, maxAttempts int, maxBytes int64) (Outcome, error) {
	endpoints, err := Endpoints(providers)
	if err != nil {
		return Outcome{}, err
	}
	if maxAttempts < 1 {
		return Outcome{}, ErrLimit
	}
	if client == nil || maxBytes < 1 || maxBytes > 16*1024*1024 || len(payload) > MaxRequestBytes {
		return Outcome{}, ErrInvalid
	}
	ctx, cancel := context.WithTimeout(ctx, DefaultTimeout)
	defer cancel()
	out := Outcome{State: "exhausted"}
	for _, endpoint := range endpoints {
		if err := ctx.Err(); err != nil {
			out.State = "cancelled"
			return out, err
		}
		if out.Attempts >= maxAttempts {
			return out, ErrLimit
		}
		out.Attempts++
		started := time.Now()
		reply, err := Attempt(ctx, client, endpoint, payload, maxBytes)
		trace := AttemptTrace{Endpoint: endpoint, Status: reply.Status, ElapsedMS: time.Since(started).Milliseconds()}
		if err != nil {
			trace.Kind = "transport-error"
			if errors.Is(err, ErrLimit) {
				trace.Kind = "response-limit"
			}
			if ctx.Err() != nil {
				trace.Kind = "cancelled"
			}
			out.Trace = append(out.Trace, trace)
			if ctx.Err() != nil {
				out.State = "cancelled"
				return out, ctx.Err()
			}
			if errors.Is(err, ErrLimit) {
				out.State = "response-limit"
				return out, err
			}
			continue
		}
		out.Reply = reply
		kind, err := ClassifyStatus(reply.Status)
		trace.Kind = kind
		out.Trace = append(out.Trace, trace)
		if err != nil {
			return out, err
		}
		if kind == "success" {
			out.State = "completed"
			return out, nil
		}
		if kind == "terminal" {
			out.State = "terminal-error"
			return out, ErrInvalid
		}
	}
	return out, ErrLimit
}
