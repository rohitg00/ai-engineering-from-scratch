package main

import (
	"context"
	"io"
	"net/http"
	"strings"
)

func Attempt(ctx context.Context, client *http.Client, endpoint, payload string, maxBytes int64) (Reply, error) {
	if client == nil || maxBytes < 1 || maxBytes > 16*1024*1024 || len(payload) > MaxRequestBytes {
		return Reply{}, ErrInvalid
	}
	if _, e := Endpoints([]string{endpoint}); e != nil {
		return Reply{}, e
	}
	ctx, cancel := context.WithTimeout(ctx, DefaultTimeout)
	defer cancel()
	req, e := http.NewRequestWithContext(ctx, "POST", endpoint, strings.NewReader(payload))
	if e != nil {
		return Reply{}, e
	}
	req.Header.Set("Content-Type", "application/json")
	boundedClient := *client
	boundedClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	response, e := boundedClient.Do(req)
	if e != nil {
		return Reply{}, e
	}
	defer response.Body.Close()
	body, e := io.ReadAll(io.LimitReader(response.Body, maxBytes+1))
	if e != nil {
		return Reply{}, e
	}
	if int64(len(body)) > maxBytes {
		return Reply{}, ErrLimit
	}
	return Reply{response.StatusCode, string(body), endpoint}, nil
}
