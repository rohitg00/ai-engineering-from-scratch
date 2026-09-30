//go:build !linux && !darwin

package main

import "fmt"

func withLedgerLock(_ string, _ func() error) error {
	return fmt.Errorf("the composed ledger requires Linux or macOS advisory file locks")
}
