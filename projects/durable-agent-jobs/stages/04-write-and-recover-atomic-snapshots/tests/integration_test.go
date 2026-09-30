package main

import (
	"bytes"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"
)

func cliBinary(t *testing.T) string {
	t.Helper()
	binary := filepath.Join(t.TempDir(), "program")
	cmd := exec.Command("go", "build", "-o", binary, ".")
	cmd.Dir = os.Getenv("PROJECT_WORKSPACE")
	if raw, err := cmd.CombinedOutput(); err != nil {
		t.Fatalf("build selected workspace: %v %s", err, raw)
	}
	return binary
}
func callCLI(t *testing.T, binary string, want int, args ...string) []byte {
	t.Helper()
	raw, err := exec.Command(binary, args...).CombinedOutput()
	code := 0
	if err != nil {
		if exit, ok := err.(*exec.ExitError); ok {
			code = exit.ExitCode()
		} else {
			t.Fatal(err)
		}
	}
	if code != want {
		t.Fatalf("%v exit%d want%d: %s", args, code, want, raw)
	}
	return raw
}
func inputFile(t *testing.T, value any) string {
	t.Helper()
	raw, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(t.TempDir(), "input.json")
	if err = os.WriteFile(file, raw, 0600); err != nil {
		t.Fatal(err)
	}
	return file
}
func waitClaim(t *testing.T, read func() bool) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		if read() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("worker did not persist its claim")
}

func TestProcessCrashAfterClaimRecovers(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, []Input{{"report-one", "alpha beta"}})
	callCLI(t, binary, 0, "enqueue", "--store", dir, "--input", file)
	callCLI(t, binary, 86, "worker", "--store", dir, "--now-ms", "100", "--lease-ms", "10", "--crash-after", "claim")
	jobs, err := Load(filepath.Join(dir, "jobs.json"))
	if err != nil || len(jobs) != 1 || jobs[0].State != "running" || jobs[0].Version != 1 {
		t.Fatal(jobs, err)
	}
	if _, err = os.Stat(filepath.Join(dir, "effects", "report-one.json")); !os.IsNotExist(err) {
		t.Fatal("effect ran before crash", err)
	}
	callCLI(t, binary, 0, "worker", "--store", dir, "--now-ms", "111", "--lease-ms", "10")
	jobs, err = Load(filepath.Join(dir, "jobs.json"))
	if err != nil || jobs[0].State != "completed" || jobs[0].Version != 4 || jobs[0].Attempts != 2 {
		t.Fatal(jobs, err)
	}
}
func TestProcessCrashAfterEffectReusesReceipt(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, []Input{{"report-one", "alpha beta"}})
	callCLI(t, binary, 0, "enqueue", "--store", dir, "--input", file)
	callCLI(t, binary, 86, "worker", "--store", dir, "--now-ms", "100", "--lease-ms", "10", "--crash-after", "effect")
	effect := filepath.Join(dir, "effects", "report-one.json")
	before, err := os.ReadFile(effect)
	if err != nil {
		t.Fatal(err)
	}
	raw := callCLI(t, binary, 0, "worker", "--store", dir, "--now-ms", "111", "--lease-ms", "10")
	after, _ := os.ReadFile(effect)
	if !bytes.Equal(before, after) || !bytes.Contains(raw, []byte(`"reused_effect": true`)) {
		t.Fatal(string(raw), string(before), string(after))
	}
	entries, _ := os.ReadDir(filepath.Join(dir, "effects"))
	if len(entries) != 1 {
		t.Fatal("duplicate effects", entries)
	}
}
func TestStaleProcessCannotCompleteNewLease(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, []Input{{"report-one", "alpha beta"}})
	callCLI(t, binary, 0, "enqueue", "--store", dir, "--input", file)
	var output bytes.Buffer
	old := exec.Command(binary, "worker", "--store", dir, "--now-ms", "100", "--lease-ms", "10", "--delay-ms", "500")
	old.Stdout = &output
	old.Stderr = &output
	if err := old.Start(); err != nil {
		t.Fatal(err)
	}
	defer old.Process.Kill()
	waitClaim(t, func() bool {
		jobs, err := Load(filepath.Join(dir, "jobs.json"))
		return err == nil && jobs[0].State == "running"
	})
	callCLI(t, binary, 0, "worker", "--store", dir, "--now-ms", "111", "--lease-ms", "10")
	if err := old.Wait(); err == nil || !bytes.Contains(output.Bytes(), []byte("completion for report-one v1 rejected")) {
		t.Fatal(err, output.String())
	}
	jobs, _ := Load(filepath.Join(dir, "jobs.json"))
	if jobs[0].Version != 4 || jobs[0].State != "completed" {
		t.Fatal(jobs)
	}
}
func TestTwoWorkerProcessesClaimDistinctJobs(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, []Input{{"report-one", "one"}, {"report-two", "two"}})
	callCLI(t, binary, 0, "enqueue", "--store", dir, "--input", file)
	a := exec.Command(binary, "worker", "--store", dir, "--delay-ms", "50")
	b := exec.Command(binary, "worker", "--store", dir, "--delay-ms", "50")
	var ao, bo bytes.Buffer
	a.Stdout = &ao
	a.Stderr = &ao
	b.Stdout = &bo
	b.Stderr = &bo
	if err := a.Start(); err != nil {
		t.Fatal(err)
	}
	defer a.Process.Kill()
	if err := b.Start(); err != nil {
		t.Fatal(err)
	}
	defer b.Process.Kill()
	if err := a.Wait(); err != nil {
		t.Fatal(err, ao.String())
	}
	if err := b.Wait(); err != nil {
		t.Fatal(err, bo.String())
	}
	jobs, err := Load(filepath.Join(dir, "jobs.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, j := range jobs {
		if j.State != "completed" || j.Attempts != 1 {
			t.Fatal(j)
		}
	}
	entries, _ := os.ReadDir(filepath.Join(dir, "effects"))
	if len(entries) != 2 {
		t.Fatal(entries)
	}
}
func TestIdentityConflictPreservesInput(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	first := inputFile(t, []Input{{"report-one", "original"}})
	changed := inputFile(t, []Input{{"report-one", "replacement"}})
	callCLI(t, binary, 0, "enqueue", "--store", dir, "--input", first)
	callCLI(t, binary, 1, "enqueue", "--store", dir, "--input", changed)
	var value Input
	if err := readJSON(filepath.Join(dir, "inputs", "report-one.json"), &value); err != nil || value.Text != "original" {
		t.Fatal(value, err)
	}
	callCLI(t, binary, 0, "enqueue", "--store", dir, "--input", first)
	jobs, _ := Load(filepath.Join(dir, "jobs.json"))
	if len(jobs) != 1 {
		t.Fatal(jobs)
	}
}
func TestCorruptLedgerIsNotOverwrittenByCLI(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := filepath.Join(dir, "jobs.json")
	raw := []byte(`[{"broken"`)
	os.WriteFile(file, raw, 0600)
	callCLI(t, binary, 1, "worker", "--store", dir)
	after, _ := os.ReadFile(file)
	if !bytes.Equal(raw, after) {
		t.Fatal("corrupt evidence overwritten")
	}
}
