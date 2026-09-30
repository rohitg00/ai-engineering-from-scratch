package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

type GitRecord struct {
	Commit                   Commit
	Body, Migration, Reverts string
}
type GitSnapshot struct {
	From, To, SHA256 string
	Records          []GitRecord
}

func ParseGitExport(raw []byte) ([]GitRecord, error) {
	if len(raw) > 4<<20 {
		return nil, ErrLimit
	}
	if len(bytes.TrimSpace(raw)) == 0 {
		return []GitRecord{}, nil
	}
	parts := strings.Split(string(raw), "\x00")
	if len(parts)%3 != 1 || strings.TrimSpace(parts[len(parts)-1]) != "" {
		return nil, ErrInvalid
	}
	records := []GitRecord{}
	seen := map[string]bool{}
	for i := 0; i < len(parts)-1; i += 3 {
		parsed, err := ParseLog(strings.TrimSpace(parts[i]) + "\t" + parts[i+1])
		if err != nil || len(parsed) != 1 {
			return nil, ErrInvalid
		}
		c := parsed[0]
		if seen[c.Hash] {
			return nil, ErrConflict
		}
		seen[c.Hash] = true
		body := parts[i+2]
		migration := ""
		collecting := false
		for _, line := range strings.Split(body, "\n") {
			if strings.HasPrefix(line, "BREAKING CHANGE:") || strings.HasPrefix(line, "BREAKING-CHANGE:") {
				migration = strings.TrimSpace(strings.SplitN(line, ":", 2)[1])
				collecting = true
			} else if collecting && strings.TrimSpace(line) != "" {
				migration += " " + strings.TrimSpace(line)
			} else {
				collecting = false
			}
		}
		c.Breaking = migration != ""
		target := ""
		match := regexp.MustCompile(`(?m)^This reverts commit ([0-9a-f]{40})\.$`).FindStringSubmatch(body)
		if match != nil {
			target = match[1]
		}
		records = append(records, GitRecord{c, body, migration, target})
	}
	return records, nil
}

type boundedBuffer struct {
	bytes.Buffer
	limit int
}

func (b *boundedBuffer) Write(p []byte) (int, error) {
	if len(p) > b.limit-b.Len() {
		return 0, ErrLimit
	}
	return b.Buffer.Write(p)
}
func gitRead(ctx context.Context, repo string, args ...string) ([]byte, error) {
	command := exec.CommandContext(ctx, "git", append([]string{"--no-pager", "-C", repo}, args...)...)
	out := &boundedBuffer{limit: 4 << 20}
	command.Stdout = out
	command.Stderr = io.Discard
	if err := command.Run(); err != nil {
		return nil, fmt.Errorf("git read failed: %w", err)
	}
	return out.Bytes(), nil
}
func ReadRepository(repo, from, to string) (GitSnapshot, error) {
	var snapshot GitSnapshot
	if repo == "" || from == "" || to == "" {
		return snapshot, ErrInvalid
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	resolve := func(ref string) (string, error) {
		raw, err := gitRead(ctx, repo, "rev-parse", "--verify", "--end-of-options", ref+"^{commit}")
		if err != nil {
			return "", err
		}
		id := strings.TrimSpace(string(raw))
		if !regexp.MustCompile(`^[0-9a-f]{40}$`).MatchString(id) {
			return "", ErrInvalid
		}
		return id, nil
	}
	var err error
	snapshot.From, err = resolve(from)
	if err != nil {
		return snapshot, err
	}
	snapshot.To, err = resolve(to)
	if err != nil {
		return snapshot, err
	}
	raw, err := gitRead(ctx, repo, "log", "--no-show-signature", "--format=%H%x00%s%x00%b%x00", snapshot.From+".."+snapshot.To, "--")
	if err != nil {
		return snapshot, err
	}
	snapshot.Records, err = ParseGitExport(raw)
	sum := sha256.Sum256(raw)
	snapshot.SHA256 = hex.EncodeToString(sum[:])
	return snapshot, err
}
func ReleaseSnapshot(label string, snapshot GitSnapshot, max int) (string, error) {
	commits := make([]Commit, len(snapshot.Records))
	for i, r := range snapshot.Records {
		commits[i] = r.Commit
	}
	output, err := Release(label, commits, max)
	if err != nil {
		return "", err
	}
	escape := strings.NewReplacer("\\", "\\\\", "[", "\\[", "]", "\\]", "<", "&lt;", ">", "&gt;", "*", "\\*", "_", "\\_", "`", "\\`", "\n", " ", "\r", " ")
	output += "\n## Migration and revert review\n"
	found := false
	for _, record := range snapshot.Records {
		if record.Migration != "" {
			output += fmt.Sprintf("- %s: %s\n", record.Commit.Hash, escape.Replace(record.Migration))
			found = true
		}
		if record.Reverts != "" {
			output += fmt.Sprintf("- %s reverts %s. Both records remain visible; review the final behavior.\n", record.Commit.Hash, record.Reverts)
			found = true
		}
	}
	if !found {
		output += "No migration footer or explicit revert reference was supplied. Review breaking subjects manually.\n"
	}
	output += fmt.Sprintf("\nSource range: %s..%s\nExport SHA-256: %s\n", escape.Replace(snapshot.From), escape.Replace(snapshot.To), escape.Replace(snapshot.SHA256))
	return output, nil
}
