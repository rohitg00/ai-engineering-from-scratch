//go:build linux || darwin

package main

import (
	"os"
	"path/filepath"
	"syscall"
)

func withLedgerLock(directory string, run func() error) error {
	file, err := os.OpenFile(filepath.Join(directory, "ledger.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return err
	}
	defer file.Close()
	if err = syscall.Flock(int(file.Fd()), syscall.LOCK_EX); err != nil {
		return err
	}
	defer syscall.Flock(int(file.Fd()), syscall.LOCK_UN)
	return run()
}
