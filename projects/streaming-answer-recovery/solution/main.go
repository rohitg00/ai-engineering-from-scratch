package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

type StreamEvent struct {
	ID   int    `json:"id"`
	Data string `json:"data"`
}

func Encode(e StreamEvent) ([]byte, error) {
	if e.ID < 1 || !json.Valid([]byte(e.Data)) {
		return nil, errors.New("positive ID and JSON payload required")
	}
	return []byte(fmt.Sprintf("id: %d\ndata: %s\n\n", e.ID, strings.ReplaceAll(e.Data, "\n", "\ndata: "))), nil
}
func After(events []StreamEvent, last string) ([]StreamEvent, error) {
	id := 0
	var err error
	if last != "" {
		id, err = strconv.Atoi(last)
		if err != nil || id < 0 {
			return nil, errors.New("invalid Last-Event-ID")
		}
	}
	out := []StreamEvent{}
	for i, e := range events {
		if e.ID != i+1 {
			return nil, errors.New("fixture IDs must be contiguous")
		}
		if e.ID > id {
			out = append(out, e)
		}
	}
	if id > len(events) {
		return nil, errors.New("resume beyond stream")
	}
	return out, nil
}
func FixtureEvents() []StreamEvent {
	return []StreamEvent{{1, `{"type":"text","text":"Caf"}`}, {2, `{"type":"text","text":"é supports interrupted answers. "}`}, {3, `{"type":"citation","label":"SSE specification","url":"https://html.spec.whatwg.org/multipage/server-sent-events.html"}`}, {4, `{"type":"complete"}`}}
}
func Handler(events []StreamEvent) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" {
			http.Error(w, "GET only", 405)
			return
		}
		selected, err := After(events, r.Header.Get("Last-Event-ID"))
		if err != nil {
			http.Error(w, err.Error(), 400)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		for _, e := range selected {
			b, err := Encode(e)
			if err != nil {
				http.Error(w, "invalid fixture", 500)
				return
			}
			if r.URL.Query().Get("interrupt") == "1" && r.Header.Get("Last-Event-ID") == "" && e.ID == 2 {
				n := strings.Index(string(b), "é")
				if n >= 0 {
					w.Write(b[:n+1])
					if f, ok := w.(http.Flusher); ok {
						f.Flush()
					}
					return
				}
			}
			for len(b) > 0 {
				n := 3
				if len(b) < n {
					n = len(b)
				}
				if _, err := w.Write(b[:n]); err != nil {
					return
				}
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
				b = b[n:]
			}
		}
	})
}
func main() {
	addr := flag.String("listen", "127.0.0.1:0", "loopback address")
	seconds := flag.Int("seconds", 20, "finite server lifetime")
	web := flag.String("web", "", "optional generated browser directory")
	flag.Parse()
	if *seconds < 1 || *seconds > 600 {
		fmt.Fprintln(os.Stderr, "seconds must be 1..600")
		os.Exit(1)
	}
	ln, e := net.Listen("tcp", *addr)
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	var handler http.Handler = Handler(FixtureEvents())
	if *web != "" {
		mux := http.NewServeMux()
		mux.Handle("/events", handler)
		mux.Handle("/", http.FileServer(http.Dir(*web)))
		handler = mux
	}
	server := &http.Server{Handler: handler, ReadHeaderTimeout: 2 * time.Second, WriteTimeout: 5 * time.Second}
	fmt.Println("http://" + ln.Addr().String() + "/?interrupt=1")
	time.AfterFunc(time.Duration(*seconds)*time.Second, func() { server.Close() })
	if e = server.Serve(ln); e != nil && e != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
}
