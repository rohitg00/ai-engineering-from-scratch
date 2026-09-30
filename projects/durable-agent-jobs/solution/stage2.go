package main

import "math"

func ClaimJob(j *Job, expected int, now, ttl int64, maxAttempts int) error {
	if j.Version != expected || j.State != "queued" {
		return ErrConflict
	}
	if now < 0 || ttl <= 0 || now > math.MaxInt64-ttl {
		return ErrInvalid
	}
	if j.Attempts >= maxAttempts {
		return ErrLimit
	}
	j.Version++
	j.Attempts++
	j.LeaseUntil = now + ttl
	j.State = "running"
	return nil
}
