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

func exampleCases() []EvalCase {
	return []EvalCase{{"case-a", "question a", "yes", "YES"}, {"case-b", "question b", "no", "yes"}, {"case-c", "question c", "GET", " get "}, {"case-d", "question d", "no", "no"}}
}
func TestTwoActualWorkersPersistMeasuredReceipts(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, exampleCases())
	raw := callCLI(t, binary, 0, "run", "--store", dir, "--input", file, "--workers", "2", "--shards", "4")
	var status struct {
		Complete  bool `json:"complete"`
		Correct   int  `json:"correct"`
		Evaluated int  `json:"evaluated"`
		Processes int  `json:"worker_processes"`
	}
	if err := json.Unmarshal(raw, &status); err != nil {
		t.Fatal(err, string(raw))
	}
	if !status.Complete || status.Correct != 3 || status.Evaluated != 4 || status.Processes < 2 {
		t.Fatal(status)
	}
	farm, err := loadFarm(dir)
	if err != nil {
		t.Fatal(err)
	}
	owners := map[string]bool{}
	for _, s := range farm.Shards {
		if !s.Lease.Done || s.Lease.Version != 1 {
			t.Fatal(s)
		}
		owners[s.Lease.Worker] = true
	}
	if len(owners) != 2 {
		t.Fatal(owners)
	}
	rerun := callCLI(t, binary, 0, "run", "--store", dir, "--input", file, "--workers", "2", "--shards", "4")
	if !bytes.Contains(rerun, []byte(`"worker_events": []`)) {
		t.Fatal("finished shards executed twice", string(rerun))
	}
}
func TestFarmProcessCrashAndLeaseRecovery(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, exampleCases()[:1])
	callCLI(t, binary, 0, "init", "--store", dir, "--input", file, "--shards", "1")
	callCLI(t, binary, 86, "worker", "--store", dir, "--worker-id", "old", "--now-ms", "100", "--lease-ms", "10", "--crash-after-claim")
	before, err := loadFarm(dir)
	if err != nil || before.Shards[0].Lease.Done || before.Shards[0].Lease.Version != 1 {
		t.Fatal(before, err)
	}
	callCLI(t, binary, 0, "worker", "--store", dir, "--worker-id", "new", "--now-ms", "110", "--lease-ms", "10")
	after, err := loadFarm(dir)
	if err != nil || !after.Shards[0].Lease.Done || after.Shards[0].Lease.Version != 2 || after.Shards[0].Lease.Worker != "new" {
		t.Fatal(after, err)
	}
}
func TestFarmStaleProcessCannotReplaceReceipt(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, exampleCases()[:1])
	callCLI(t, binary, 0, "init", "--store", dir, "--input", file, "--shards", "1")
	old := exec.Command(binary, "worker", "--store", dir, "--worker-id", "old", "--now-ms", "100", "--lease-ms", "10", "--delay-ms", "500")
	var output bytes.Buffer
	old.Stdout = &output
	old.Stderr = &output
	if err := old.Start(); err != nil {
		t.Fatal(err)
	}
	defer old.Process.Kill()
	waitClaim(t, func() bool { farm, err := loadFarm(dir); return err == nil && farm.Shards[0].Lease.Version == 1 })
	callCLI(t, binary, 0, "worker", "--store", dir, "--worker-id", "new", "--now-ms", "111", "--lease-ms", "10")
	before, _ := os.ReadFile(filepath.Join(dir, "farm.json"))
	if err := old.Wait(); err == nil || !bytes.Contains(output.Bytes(), []byte("completion fenced")) {
		t.Fatal(err, output.String())
	}
	after, _ := os.ReadFile(filepath.Join(dir, "farm.json"))
	if !bytes.Equal(before, after) {
		t.Fatal("stale worker changed receipt")
	}
}
func TestChangedDatasetCannotResumeExistingFarm(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	cases := exampleCases()
	file := inputFile(t, cases)
	callCLI(t, binary, 0, "init", "--store", dir, "--input", file)
	before, _ := os.ReadFile(filepath.Join(dir, "farm.json"))
	cases[0].Response = "changed"
	file = inputFile(t, cases)
	callCLI(t, binary, 1, "run", "--store", dir, "--input", file)
	after, _ := os.ReadFile(filepath.Join(dir, "farm.json"))
	if !bytes.Equal(before, after) {
		t.Fatal("changed dataset overwrote run")
	}
}
func TestCorruptFarmFailsWithoutReset(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := filepath.Join(dir, "farm.json")
	raw := []byte(`{"schema_version":1`)
	os.WriteFile(file, raw, 0600)
	callCLI(t, binary, 1, "run", "--store", dir, "--input", inputFile(t, exampleCases()))
	after, _ := os.ReadFile(file)
	if !bytes.Equal(raw, after) {
		t.Fatal("corrupt run overwritten")
	}
}
func TestUnexpiredFarmReturnsPendingWithoutStealing(t *testing.T) {
	binary := cliBinary(t)
	dir := t.TempDir()
	file := inputFile(t, exampleCases()[:1])
	callCLI(t, binary, 0, "init", "--store", dir, "--input", file, "--shards", "1")
	callCLI(t, binary, 86, "worker", "--store", dir, "--now-ms", "100", "--lease-ms", "10", "--crash-after-claim")
	raw := callCLI(t, binary, 1, "run", "--store", dir, "--input", file, "--shards", "1", "--now-ms", "109")
	if !bytes.Contains(raw, []byte(`"complete": false`)) {
		t.Fatal(string(raw))
	}
	farm, _ := loadFarm(dir)
	if farm.Shards[0].Lease.Version != 1 {
		t.Fatal("stole live lease", farm)
	}
}
