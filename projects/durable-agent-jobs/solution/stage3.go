package main

func Finish(j *Job, expected int, now int64) error {
	if j.Version != expected || j.State != "running" || now < 0 || now >= j.LeaseUntil {
		return ErrConflict
	}
	j.State = "completed"
	j.LeaseUntil = 0
	j.Version++
	return nil
}
func Reclaim(j *Job, now int64) bool {
	if j.State != "running" || now < j.LeaseUntil {
		return false
	}
	j.State = "queued"
	j.LeaseUntil = 0
	j.Version++
	return true
}
