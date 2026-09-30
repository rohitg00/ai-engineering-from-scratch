package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"time"
)

func demo() error {
	primary := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(503)
		fmt.Fprint(w, `{"error":"orchard-primary-busy"}`)
	}))
	defer primary.Close()
	backup := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		json.NewEncoder(w).Encode(map[string]any{"model": body["model"], "choices": []any{map[string]any{"message": map[string]string{"role": "assistant", "content": "Orchard export links last 15 minutes."}}}})
	}))
	defer backup.Close()
	config := Config{Providers: []Provider{{Name: "primary", URL: primary.URL, Model: "orchard-primary"}, {Name: "backup", URL: backup.URL, Model: "orchard-backup"}}, MaxAttempts: 2, MaxBytes: 4096, TimeoutMS: 1000}
	proxy := httptest.NewServer(GatewayHandler(config, http.DefaultClient))
	defer proxy.Close()
	response, err := http.Post(proxy.URL+"/v1/chat/completions", "application/json", strings.NewReader(`{"model":"caller-default","messages":[{"role":"user","content":"How long do Orchard links last?"}]}`))
	if err != nil {
		return err
	}
	defer response.Body.Close()
	body, err := io.ReadAll(response.Body)
	if err != nil {
		return err
	}
	fmt.Printf("MODE actual loopback HTTP, authored provider responses\nHTTP %d\nATTEMPTS %s\nPROVIDER %s\nBODY %s", response.StatusCode, response.Header.Get("X-Gateway-Attempts"), response.Header.Get("X-Gateway-Provider"), body)
	if response.StatusCode != 200 {
		return ErrInvalid
	}
	return nil
}
func run() error {
	configPath := flag.String("config", "", "provider JSON configuration")
	requestPath := flag.String("request", "", "non-streaming JSON request file")
	listen := flag.String("listen", "", "loopback bind address, for example 127.0.0.1:8088")
	flag.Parse()
	if *configPath == "" {
		if *requestPath != "" || *listen != "" {
			return ErrInvalid
		}
		return demo()
	}
	data, err := ReadBounded(*configPath)
	if err != nil {
		return err
	}
	config, err := ParseConfig(data)
	if err != nil {
		return err
	}
	if *listen != "" {
		if *requestPath != "" {
			return ErrInvalid
		}
		host, _, err := net.SplitHostPort(*listen)
		if err != nil {
			return err
		}
		ip := net.ParseIP(host)
		if host != "localhost" && (ip == nil || !ip.IsLoopback()) {
			return fmt.Errorf("gateway bind must be loopback")
		}
		server := &http.Server{Addr: *listen, Handler: GatewayHandler(config, http.DefaultClient), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: time.Duration(config.TimeoutMS)*time.Millisecond + 2*time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 * 1024}
		fmt.Printf("Listening on http://%s/v1/chat/completions\n", *listen)
		return server.ListenAndServe()
	}
	if *requestPath == "" {
		return fmt.Errorf("provide --request or --listen")
	}
	data, err = ReadBounded(*requestPath)
	if err != nil {
		return err
	}
	result, routeErr := RouteConfigured(context.Background(), http.DefaultClient, config, string(data))
	if err := json.NewEncoder(os.Stdout).Encode(result); err != nil {
		return err
	}
	return routeErr
}
func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "gateway:", err)
		os.Exit(1)
	}
}
