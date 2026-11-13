package main

import (
	"encoding/json"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type result struct {
	Threads   int     `json:"threads"`
	TargetCPU float64 `json:"target_cpu_s"`
	Wall      float64 `json:"wall_s"`
	User      float64 `json:"cpu_user_s"`
	Sys       float64 `json:"cpu_sys_s"`
	Running   bool    `json:"running"`
}

var (
	mu   sync.Mutex
	last result
)

func cpuNow() (float64, float64) {
	var ru syscall.Rusage
	syscall.Getrusage(syscall.RUSAGE_SELF, &ru)
	return float64(ru.Utime.Sec) + float64(ru.Utime.Usec)/1e6, float64(ru.Stime.Sec) + float64(ru.Stime.Usec)/1e6
}

func burn(threads int, target float64) {
	u0, s0 := cpuNow()
	start := time.Now()
	var done atomic.Bool
	var wg sync.WaitGroup
	for i := 0; i < threads; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runtime.LockOSThread()
			x := uint64(1)
			for !done.Load() {
				for j := 0; j < 200000; j++ {
					x = x*6364136223846793005 + 1442695040888963407
				}
				u, s := cpuNow()
				if (u-u0)+(s-s0) >= target {
					done.Store(true)
				}
			}
			_ = x
		}()
	}
	wg.Wait()
	u1, s1 := cpuNow()
	mu.Lock()
	last = result{Threads: threads, TargetCPU: target, Wall: time.Since(start).Seconds(), User: u1 - u0, Sys: s1 - s0}
	mu.Unlock()
}

func work(threads, chunks int) {
	u0, s0 := cpuNow()
	start := time.Now()
	var wg sync.WaitGroup
	for i := 0; i < threads; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			runtime.LockOSThread()
			x := uint64(1)
			for c := 0; c < chunks/threads; c++ {
				for j := 0; j < 200000; j++ {
					x = x*6364136223846793005 + 1442695040888963407
				}
			}
			_ = x
		}()
	}
	wg.Wait()
	u1, s1 := cpuNow()
	mu.Lock()
	last = result{Threads: threads, TargetCPU: float64(chunks), Wall: time.Since(start).Seconds(), User: u1 - u0, Sys: s1 - s0}
	mu.Unlock()
}

func read(p string) string {
	b, err := os.ReadFile(p)
	if err != nil {
		return "unreadable"
	}
	return strings.TrimSpace(string(b))
}

func main() {
	runtime.GOMAXPROCS(8)
	http.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) })
	http.HandleFunc("/info", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"num_cpu": runtime.NumCPU(), "cgroup_cpu_max": read("/sys/fs/cgroup/cpu.max"), "cgroup_v1_quota": read("/sys/fs/cgroup/cpu/cpu.cfs_quota_us"), "proc_cpuinfo_processors": strings.Count(read("/proc/cpuinfo"), "processor\t")})
	})
	http.HandleFunc("/burn", func(w http.ResponseWriter, r *http.Request) {
		t, _ := strconv.Atoi(r.URL.Query().Get("threads"))
		c, _ := strconv.ParseFloat(r.URL.Query().Get("cpu"), 64)
		if t < 1 || c <= 0 {
			w.WriteHeader(400)
			return
		}
		mu.Lock()
		if last.Running {
			mu.Unlock()
			w.WriteHeader(409)
			return
		}
		last = result{Threads: t, TargetCPU: c, Running: true}
		mu.Unlock()
		go burn(t, c)
		w.Write([]byte("started\n"))
	})
	http.HandleFunc("/work", func(w http.ResponseWriter, r *http.Request) {
		t, _ := strconv.Atoi(r.URL.Query().Get("threads"))
		c, _ := strconv.Atoi(r.URL.Query().Get("chunks"))
		if t < 1 || c < 1 {
			w.WriteHeader(400)
			return
		}
		mu.Lock()
		if last.Running {
			mu.Unlock()
			w.WriteHeader(409)
			return
		}
		last = result{Threads: t, TargetCPU: float64(c), Running: true}
		mu.Unlock()
		go work(t, c)
		w.Write([]byte("started\n"))
	})
	http.HandleFunc("/result", func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		json.NewEncoder(w).Encode(last)
	})
	http.ListenAndServe(":80", nil)
}
