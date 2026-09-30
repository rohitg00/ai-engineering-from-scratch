package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func TestMigrationFooter(t *testing.T) {
	r, e := ParseGitExport([]byte("abc1234\x00fix: new format\x00BREAKING CHANGE: Rebuild the index.\n\x00\n"))
	if e != nil {
		t.Fatal(e)
	}
	out, e := ReleaseSnapshot("v1", GitSnapshot{Records: r}, 10)
	if e != nil || !strings.Contains(out, "## Breaking changes") || !strings.Contains(out, "Rebuild the index.") {
		t.Fatal(out, e)
	}
}
func TestTruncatedExport(t *testing.T) {
	if _, e := ParseGitExport([]byte("abc1234\x00fix: x\x00body")); e == nil {
		t.Fatal("truncation accepted")
	}
}
func TestRevertPreserved(t *testing.T) {
	target := strings.Repeat("a", 40)
	r, e := ParseGitExport([]byte("bbbbbbb\x00Revert cache\x00This reverts commit " + target + ".\x00"))
	if e != nil || r[0].Reverts != target {
		t.Fatal(r, e)
	}
}
func TestGitInputBound(t *testing.T) {
	if _, e := ParseGitExport(make([]byte, (4<<20)+1)); e != ErrLimit {
		t.Fatal(e)
	}
}
func TestRealReadOnlyRange(t *testing.T) {
	dir := t.TempDir()
	git := func(args ...string) string {
		c := exec.Command("git", append([]string{"-C", dir}, args...)...)
		c.Env = append(os.Environ(), "GIT_CONFIG_NOSYSTEM=1", "GIT_AUTHOR_NAME=Fixture", "GIT_AUTHOR_EMAIL=fixture@example.invalid", "GIT_COMMITTER_NAME=Fixture", "GIT_COMMITTER_EMAIL=fixture@example.invalid")
		out, e := c.CombinedOutput()
		if e != nil {
			t.Fatal(string(out), e)
		}
		return strings.TrimSpace(string(out))
	}
	git("init", "-q")
	os.WriteFile(filepath.Join(dir, "sample"), []byte("a"), 0600)
	git("add", "sample")
	git("-c", "commit.gpgsign=false", "commit", "-qm", "chore: baseline")
	base := git("rev-parse", "HEAD")
	os.WriteFile(filepath.Join(dir, "sample"), []byte("b"), 0600)
	git("add", "sample")
	git("-c", "commit.gpgsign=false", "commit", "-qm", "feat: add artifact", "-m", "BREAKING CHANGE: Rename config.")
	before := git("status", "--porcelain")
	snapshot, e := ReadRepository(dir, base, "HEAD")
	if e != nil || len(snapshot.Records) != 1 || snapshot.Records[0].Migration != "Rename config." {
		t.Fatal(snapshot, e)
	}
	if git("status", "--porcelain") != before {
		t.Fatal("repository modified")
	}
	if _, e := ReadRepository(dir, "--help", "HEAD"); e == nil {
		t.Fatal("option accepted")
	}
}
