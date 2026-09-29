package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"strings"
	"sync/atomic"
	"testing"
)

func TestConfiguredBodyAndReplayUseSameBytes(t *testing.T) {
	endpoint := "http://127.0.0.1/chat"
	base := transportFunc(func(req *http.Request) (*http.Response, error) {
		body, err := io.ReadAll(req.Body)
		if err != nil {
			t.Fatal(err)
		}
		defer req.Body.Close()
		if req.GetBody == nil {
			t.Fatal("request is not replayable")
		}
		for range 2 {
			replay, err := req.GetBody()
			if err != nil {
				t.Fatal(err)
			}
			replayed, err := io.ReadAll(replay)
			replay.Close()
			if err != nil || !bytes.Equal(body, replayed) || req.ContentLength != int64(len(replayed)) {
				t.Fatalf("body=%s replay=%s length=%d error=%v", body, replayed, req.ContentLength, err)
			}
		}
		if !strings.Contains(string(body), `"model":"configured-large-model"`) {
			t.Fatal(string(body))
		}
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader("{}"))}, nil
	})
	transport := providerTransport{base: base, providers: map[string]Provider{endpoint: {URL: endpoint, Model: "configured-large-model"}}}
	req, _ := http.NewRequest("POST", endpoint, strings.NewReader(`{"model":"caller","seed":9007199254740993}`))
	response, err := transport.RoundTrip(req)
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
}

type failNextWriteConn struct {
	net.Conn
	fail     atomic.Bool
	failures atomic.Int32
}

func (c *failNextWriteConn) Write(data []byte) (int, error) {
	if c.fail.Swap(false) {
		c.failures.Add(1)
		return 0, errors.New("injected zero-byte write failure")
	}
	return c.Conn.Write(data)
}

func TestRealTransportRetryKeepsConfiguredModel(t *testing.T) {
	var dials atomic.Int32
	first := make(chan *failNextWriteConn, 1)
	models := make(chan string, 4)
	transport := &http.Transport{DialContext: func(context.Context, string, string) (net.Conn, error) {
		client, server := net.Pipe()
		connection := &failNextWriteConn{Conn: client}
		if dials.Add(1) == 1 {
			first <- connection
		}
		t.Cleanup(func() { client.Close(); server.Close() })
		go func() {
			defer server.Close()
			reader := bufio.NewReader(server)
			for {
				req, err := http.ReadRequest(reader)
				if err != nil {
					return
				}
				body, err := io.ReadAll(req.Body)
				req.Body.Close()
				if err != nil {
					return
				}
				var payload map[string]any
				if json.Unmarshal(body, &payload) != nil {
					return
				}
				model, _ := payload["model"].(string)
				models <- model
				if _, err := io.WriteString(server, "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}"); err != nil {
					return
				}
			}
		}()
		return connection, nil
	}}
	defer transport.CloseIdleConnections()
	client := &http.Client{Transport: transport}
	config := Config{Providers: []Provider{{Name: "primary", URL: "http://127.0.0.1/chat", Model: "server"}}, MaxAttempts: 1, MaxBytes: 100, TimeoutMS: 2000}
	if _, err := RouteConfigured(context.Background(), client, config, `{"model":"client"}`); err != nil {
		t.Fatal(err)
	}
	connection := <-first
	connection.fail.Store(true)
	result, err := RouteConfigured(context.Background(), client, config, `{"model":"client"}`)
	if err != nil || result.State != "completed" || result.Attempts != 1 {
		t.Fatal(result, err)
	}
	if dials.Load() != 2 || connection.failures.Load() != 1 {
		t.Fatal("retry was not exercised", dials.Load(), connection.failures.Load())
	}
	for range 2 {
		select {
		case model := <-models:
			if model != "server" {
				t.Fatalf("transport sent caller model: %q", model)
			}
		default:
			t.Fatal("provider did not receive both requests")
		}
	}
}
