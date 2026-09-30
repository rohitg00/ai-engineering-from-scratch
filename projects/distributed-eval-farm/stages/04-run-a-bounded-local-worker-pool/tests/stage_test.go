package main

import (
	"context"
	"sync/atomic"
	"testing"
	"time"
)

func TestStableOrder(t *testing.T) {
	v, e := Parallel(context.Background(), []string{"b", "a"}, 2, func(_ context.Context, id string) (string, error) { return id + "!", nil })
	if e != nil || len(v) != 2 || v[0].ID != "a" {
		t.Fatal(v, e)
	}
}
func TestBounded(t *testing.T) {
	var active, maximum atomic.Int32
	_, e := Parallel(context.Background(), []string{"a", "b", "c", "d"}, 2, func(_ context.Context, id string) (string, error) {
		n := active.Add(1)
		for old := maximum.Load(); n > old && !maximum.CompareAndSwap(old, n); old = maximum.Load() {
		}
		time.Sleep(time.Millisecond)
		active.Add(-1)
		return id, nil
	})
	if e != nil || maximum.Load() > 2 {
		t.Fatal(maximum.Load(), e)
	}
}
func TestCancelled(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, e := Parallel(ctx, []string{"a"}, 1, func(context.Context, string) (string, error) { t.Fatal("executed after cancel"); return "", nil }); e == nil {
		t.Fatal("missing cancel")
	}
}
func TestErrorVisible(t *testing.T) {
	if _, e := Parallel(context.Background(), []string{"a"}, 1, func(context.Context, string) (string, error) { return "", ErrInvalid }); e != ErrInvalid {
		t.Fatal(e)
	}
}
func TestDuplicateRejected(t *testing.T) {
	if _, e := Parallel(context.Background(), []string{"a", "a"}, 2, func(context.Context, string) (string, error) { return "", nil }); e != ErrConflict {
		t.Fatal(e)
	}
}
