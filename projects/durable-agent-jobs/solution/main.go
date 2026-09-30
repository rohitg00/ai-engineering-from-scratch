package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func output(value any) error {
	encoder := json.NewEncoder(os.Stdout)
	encoder.SetIndent("", "  ")
	return encoder.Encode(value)
}
func demo(input string) error {
	directory, err := os.MkdirTemp("", "durable-demo-")
	if err != nil {
		return err
	}
	defer os.RemoveAll(directory)
	executable, err := os.Executable()
	if err != nil {
		return err
	}
	run := func(expected int, args ...string) error {
		command := exec.Command(executable, args...)
		raw, err := command.CombinedOutput()
		fmt.Print(string(raw))
		code := 0
		if err != nil {
			if exit, ok := err.(*exec.ExitError); ok {
				code = exit.ExitCode()
			} else {
				return err
			}
		}
		if code != expected {
			return fmt.Errorf("child exit %d expected %d", code, expected)
		}
		return nil
	}
	if err = run(0, "enqueue", "--store", directory, "--input", input); err != nil {
		return err
	}
	if err = run(86, "worker", "--store", directory, "--now-ms", "100", "--lease-ms", "10", "--crash-after", "effect"); err != nil {
		return err
	}
	if err = run(0, "status", "--store", directory); err != nil {
		return err
	}
	if err = run(0, "worker", "--store", directory, "--now-ms", "111", "--lease-ms", "10", "--max-jobs", "100"); err != nil {
		return err
	}
	return run(0, "status", "--store", directory)
}
func runCLI() error {
	if len(os.Args) < 2 {
		return fmt.Errorf("usage: jobs enqueue|worker|status|demo [flags]")
	}
	command := os.Args[1]
	flags := flag.NewFlagSet(command, flag.ContinueOnError)
	directory := flags.String("store", "jobs-data", "persistent local directory")
	input := flags.String("input", "samples/jobs.json", "JSON array of id/text records")
	nowMS := flags.Int64("now-ms", -1, "explicit logical clock for recovery experiments; default uses wall time")
	lease := flags.Int64("lease-ms", 30000, "claim lease milliseconds")
	attempts := flags.Int("max-attempts", 3, "attempt limit")
	maximum := flags.Int("max-jobs", 1, "maximum jobs handled by this worker invocation")
	delay := flags.Int64("delay-ms", 0, "controlled delay after claiming for stale-worker experiments")
	crash := flags.String("crash-after", "", "claim or effect; abrupt exit86")
	if err := flags.Parse(os.Args[2:]); err != nil {
		return err
	}
	if flags.NArg() != 0 || *nowMS < -1 || *delay < 0 || *delay > 60000 {
		return ErrInvalid
	}
	absolute, err := filepath.Abs(*directory)
	if err != nil {
		return err
	}
	switch command {
	case "enqueue":
		var rows []Input
		if err = readJSON(*input, &rows); err != nil {
			return err
		}
		if err = Enqueue(absolute, rows); err != nil {
			return err
		}
		return output(map[string]any{"enqueued_or_already_present": len(rows), "store": absolute})
	case "worker":
		clock := func() int64 { return time.Now().UnixMilli() }
		if *nowMS >= 0 {
			clock = func() int64 { return *nowMS }
		}
		events, err := Work(absolute, WorkOptions{clock, *lease, *attempts, *maximum, time.Duration(*delay) * time.Millisecond, *crash})
		if err != nil {
			return err
		}
		return output(map[string]any{"schema_version": 1, "events": events, "clock": "milliseconds; explicit now-ms uses a logical test clock"})
	case "status":
		value, err := Status(absolute)
		if err != nil {
			return err
		}
		return output(value)
	case "demo":
		return demo(*input)
	default:
		return fmt.Errorf("unknown command %s", command)
	}
}
func main() {
	if err := runCLI(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
