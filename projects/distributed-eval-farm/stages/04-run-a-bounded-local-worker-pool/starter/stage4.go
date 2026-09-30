package main

import (
	"context"
)

func Parallel(ctx context.Context, ids []string, workers int, run func(context.Context, string) (string, error)) ([]Item, error) {
	panic("Stage 4: implement Parallel")
}
