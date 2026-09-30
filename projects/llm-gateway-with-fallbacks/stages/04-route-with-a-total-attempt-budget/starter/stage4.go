package main

import (
	"context"
	"net/http"
)

func Route(ctx context.Context, client *http.Client, providers []string, payload string, maxAttempts int, maxBytes int64) (Outcome, error) {
	panic("Stage 4: implement Route")
}
