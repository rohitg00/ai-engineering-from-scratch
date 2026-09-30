package main

import (
	"context"
	"sort"
	"sync"
)

func Parallel(ctx context.Context, ids []string, workers int, run func(context.Context, string) (string, error)) ([]Item, error) {
	if workers < 1 || workers > 64 || run == nil {
		return nil, ErrInvalid
	}
	if _, e := Partition(ids, 1); e != nil {
		return nil, e
	}
	type answer struct {
		item Item
		err  error
	}
	jobs := make(chan string)
	results := make(chan answer, len(ids))
	var group sync.WaitGroup
	for i := 0; i < workers; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for id := range jobs {
				if e := ctx.Err(); e != nil {
					results <- answer{err: e}
					continue
				}
				value, e := run(ctx, id)
				results <- answer{Item{id, value}, e}
			}
		}()
	}
	go func() {
		defer close(jobs)
		for _, id := range ids {
			select {
			case <-ctx.Done():
				return
			case jobs <- id:
			}
		}
	}()
	go func() { group.Wait(); close(results) }()
	out := []Item{}
	var first error
	for answer := range results {
		if answer.err != nil {
			if first == nil {
				first = answer.err
			}
			continue
		}
		out = append(out, answer.item)
	}
	if e := ctx.Err(); e != nil {
		return out, e
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, first
}
