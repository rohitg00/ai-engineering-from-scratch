package main

import (
	"context"
	"net/http"
)

func Attempt(ctx context.Context, client *http.Client, endpoint, payload string, maxBytes int64) (Reply, error) {
	panic("Stage 3: implement Attempt")
}
