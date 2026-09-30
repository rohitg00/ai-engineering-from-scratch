package main

import "math"

func Acquire(l *Lease, worker string, now, ttl int64) error {
	if l.Shard == "" || worker == "" || now < 0 || ttl <= 0 || now > math.MaxInt64-ttl {
		return ErrInvalid
	}
	if l.Done || (l.Worker != "" && now < l.Until) {
		return ErrConflict
	}
	l.Worker = worker
	l.Until = now + ttl
	l.Version++
	return nil
}
