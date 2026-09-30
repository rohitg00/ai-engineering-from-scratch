package main

func Submit(l *Lease, worker string, version int, now int64, result string) error {
	if result == "" || len(result) > 1024*1024 || now < 0 {
		return ErrInvalid
	}
	if l.Worker != worker || l.Version != version {
		return ErrConflict
	}
	if l.Done {
		if l.Result == result {
			return nil
		}
		return ErrConflict
	}
	if now >= l.Until {
		return ErrConflict
	}
	l.Result = result
	l.Done = true
	return nil
}
