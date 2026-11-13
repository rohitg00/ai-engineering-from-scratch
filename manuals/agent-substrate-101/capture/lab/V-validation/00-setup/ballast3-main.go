package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"sync/atomic"
	"time"
)

func bump(path string) int {
	if path == "" {
		return -1
	}
	b, _ := os.ReadFile(path)
	n, _ := strconv.Atoi(strings.TrimSpace(string(b)))
	n++
	if err := os.WriteFile(path, []byte(strconv.Itoa(n)), 0o644); err != nil {
		return -2
	}
	return n
}

func main() {
	mb := flag.Int("mb", 0, "MiB of memory to hold")
	fill := flag.String("fill", "random", "random, zero or mixed")
	rootfsFile := flag.String("rootfs-file", "", "counter file on the root filesystem")
	dataFile := flag.String("data-file", "", "counter file on a volume")
	child := flag.Bool("child", false, "run as the child process")
	spawn := flag.Bool("spawn-child", false, "start a child process on port 81")
	tag := flag.String("tag", "v3", "version label")
	flag.Parse()
	if *child {
		started := time.Now()
		http.ListenAndServe(":81", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			fmt.Fprintf(w, "child_pid=%d child_age_s=%.1f", os.Getpid(), time.Since(started).Seconds())
		}))
		return
	}
	if *spawn {
		c := exec.Command(os.Args[0], "--child")
		c.Start()
	}
	var ready atomic.Bool
	var count atomic.Int64
	started := time.Now()
	buf := make([]byte, *mb<<20)
	go func() {
		switch *fill {
		case "random":
			rand.Read(buf)
		case "mixed":
			rand.Read(buf[:len(buf)/2])
			for i := len(buf) / 2; i < len(buf); i += 4096 {
				buf[i] = 0
			}
		default:
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
		childState := "none"
		if *spawn {
			c := http.Client{Timeout: 500 * time.Millisecond}
			if resp, err := c.Get("http://127.0.0.1:81/"); err == nil {
				b, _ := io.ReadAll(resp.Body)
				resp.Body.Close()
				childState = string(b)
			} else {
				childState = "gone"
			}
		}
		fmt.Fprintf(w, "tag=%s count=%d mb=%d fill=%s sum=%d rootfs=%d data=%d pid=%d process_age_s=%.1f child[%s]\n", *tag, count.Add(1), *mb, *fill, sum, bump(*rootfsFile), bump(*dataFile), os.Getpid(), time.Since(started).Seconds(), childState)
	})
	http.HandleFunc("/slow", func(w http.ResponseWriter, r *http.Request) {
		s, _ := strconv.Atoi(r.URL.Query().Get("s"))
		begin := time.Now()
		time.Sleep(time.Duration(s) * time.Second)
		fmt.Fprintf(w, "slow done count=%d slept_wall_s=%.1f process_age_s=%.1f\n", count.Add(1), time.Since(begin).Seconds(), time.Since(started).Seconds())
	})
	http.HandleFunc("/exit", func(w http.ResponseWriter, r *http.Request) {
		go func() { time.Sleep(200 * time.Millisecond); os.Exit(3) }()
		fmt.Fprintln(w, "exiting with code 3")
	})
	http.HandleFunc("/hdr", func(w http.ResponseWriter, r *http.Request) {
		keys := make([]string, 0, len(r.Header))
		for k := range r.Header {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		for _, k := range keys {
			fmt.Fprintf(w, "%s: %s\n", k, strings.Join(r.Header[k], ","))
		}
	})
	http.HandleFunc("/fetch", func(w http.ResponseWriter, r *http.Request) {
		req, _ := http.NewRequest("GET", r.URL.Query().Get("url"), nil)
		if h := r.URL.Query().Get("auth"); h != "" {
			req.Header.Set("Authorization", h)
		}
		c := http.Client{Timeout: 10 * time.Second}
		resp, err := c.Do(req)
		if err != nil {
			fmt.Fprintf(w, "fetch error: %v\n", err)
			return
		}
		b, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		fmt.Fprintf(w, "status=%d\n%s", resp.StatusCode, b)
	})
	http.ListenAndServe(":80", nil)
}
