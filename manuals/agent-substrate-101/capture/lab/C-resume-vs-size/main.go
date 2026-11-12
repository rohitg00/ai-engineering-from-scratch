package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"net/http"
	"sync/atomic"
	"time"
)

func main() {
	mb := flag.Int("mb", 0, "MiB of memory to hold")
	fill := flag.String("fill", "random", "random or zero")
	flag.Parse()
	var ready atomic.Bool
	var count atomic.Int64
	started := time.Now()
	buf := make([]byte, *mb<<20)
	go func() {
		if *fill == "random" {
			rand.Read(buf)
		} else {
			for i := 0; i < len(buf); i += 4096 {
				buf[i] = 0
			}
		}
		ready.Store(true)
	}()
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if !ready.Load() {
			w.WriteHeader(503)
			return
		}
		w.WriteHeader(200)
	})
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		var sum uint64
		for i := 0; i < len(buf); i += 1 << 20 {
			sum += uint64(buf[i])
		}
		fmt.Fprintf(w, "count=%d mb=%d fill=%s sum=%d process_age_s=%.1f\n", count.Add(1), *mb, *fill, sum, time.Since(started).Seconds())
	})
	http.ListenAndServe(":80", nil)
}
