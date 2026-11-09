// Lesson: Parallel Swarm Networks (phase 16 / lesson 09)
// Go port of code/main.py. Go standard library only.
// Source: phases/16-multi-agent-and-swarms/09-parallel-swarm-networks/docs/en.md
// Run: go run code/main.go

package main

import (
	"fmt"
	"math"
	"strings"
	"sync"
	"time"
)

type Task struct {
	TaskID      int
	Duration    float64
	PreAssigned int
}

func fakeWork(task Task) string {
	time.Sleep(time.Duration(task.Duration * float64(time.Second)))
	return fmt.Sprintf("task-%d-done", task.TaskID)
}

func pyCounts(counts []int) string {
	parts := make([]string, len(counts))
	for i, c := range counts {
		parts[i] = fmt.Sprintf("%d: %d", i, c)
	}
	return "{" + strings.Join(parts, ", ") + "}"
}

func runSequential(tasks []Task) (float64, []int) {
	t0 := time.Now()
	counts := []int{0}
	for _, t := range tasks {
		fakeWork(t)
		counts[0]++
	}
	return time.Since(t0).Seconds(), counts
}

func runFixedAssignment(tasks []Task, nWorkers int) (float64, []int) {
	perWorker := make([][]Task, nWorkers)
	for _, t := range tasks {
		perWorker[t.PreAssigned] = append(perWorker[t.PreAssigned], t)
	}
	counts := make([]int, nWorkers)

	t0 := time.Now()
	var wg sync.WaitGroup
	for wid := 0; wid < nWorkers; wid++ {
		wg.Add(1)
		go func(wid int) {
			defer wg.Done()
			for _, t := range perWorker[wid] {
				fakeWork(t)
				counts[wid]++
			}
		}(wid)
	}
	wg.Wait()
	return time.Since(t0).Seconds(), counts
}

func runSwarm(tasks []Task, nWorkers int) (float64, []int) {
	q := make(chan Task, len(tasks))
	for _, t := range tasks {
		q <- t
	}
	close(q)
	counts := make([]int, nWorkers)
	var mu sync.Mutex

	t0 := time.Now()
	var wg sync.WaitGroup
	for wid := 0; wid < nWorkers; wid++ {
		wg.Add(1)
		go func(wid int) {
			defer wg.Done()
			for task := range q {
				fakeWork(task)
				mu.Lock()
				counts[wid]++
				mu.Unlock()
			}
		}(wid)
	}
	wg.Wait()
	return time.Since(t0).Seconds(), counts
}

func makeTasks(nWorkers int) []Task {
	tasks := []Task{}
	for i := 0; i < 8; i++ {
		isSlow := i < 4
		duration := 0.1
		pre := ((i-3)%nWorkers + nWorkers) % nWorkers
		if isSlow {
			duration = 0.4
			pre = 0
		}
		tasks = append(tasks, Task{TaskID: i, Duration: duration, PreAssigned: pre})
	}
	return tasks
}

func main() {
	fmt.Println("Swarm architecture demo: variable-duration workload")
	fmt.Println(strings.Repeat("-", 56))
	nWorkers := 4

	tasks := makeTasks(nWorkers)
	totalWork := 0.0
	for _, t := range tasks {
		totalWork += t.Duration
	}
	fmt.Printf("%d tasks, 4 slow (0.4s) + 4 fast (0.1s)\n", len(tasks))
	fmt.Printf("Total work-seconds: %.2fs\n", totalWork)
	fmt.Printf("Ideal parallel time with %d workers: %.2fs\n", nWorkers, totalWork/float64(nWorkers))

	seqTime, seqCounts := runSequential(tasks)
	fmt.Printf("\nSequential (1 worker):      wall=%.2fs, counts=%s\n", seqTime, pyCounts(seqCounts))

	fixedTime, fixedCounts := runFixedAssignment(tasks, nWorkers)
	fmt.Printf("Fixed assignment (%d workers): wall=%.2fs, counts=%s\n", nWorkers, fixedTime, pyCounts(fixedCounts))
	fmt.Println("  worker 0 got all 4 slow tasks; other workers idle after their fast ones.")

	swarmTime, swarmCounts := runSwarm(tasks, nWorkers)
	fmt.Printf("Swarm (%d workers):            wall=%.2fs, counts=%s\n", nWorkers, swarmTime, pyCounts(swarmCounts))
	fmt.Println("  load balances automatically: slow workers finish first, fast pull next job.")

	speedupVsSeq := math.Inf(1)
	speedupVsFixed := math.Inf(1)
	if swarmTime > 0 {
		speedupVsSeq = seqTime / swarmTime
		speedupVsFixed = fixedTime / swarmTime
	}
	fmt.Printf("\nSwarm speedup vs sequential: %.2fx\n", speedupVsSeq)
	fmt.Printf("Swarm speedup vs fixed:      %.2fx\n", speedupVsFixed)
	fmt.Println("\nTakeaway: swarm wins when duration varies and assignment is hard to predict.")
	fmt.Println("Tradeoff: no central trace; debugging requires per-task IDs and durable logs.")
}
