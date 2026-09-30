package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func example() Brief {
	return Brief{Before: Snapshot{URL: "https://example.invalid/", Hash: "before"}, After: Snapshot{URL: "https://example.invalid/", Hash: "after"}, Added: []Change{{"Open Friday", 2}}, Removed: []Change{{"Open Thursday", 1}}, Unchanged: 3}
}
func TestExportCreatesHTMLAndJSON(t *testing.T) {
	dir := t.TempDir()
	if e := ExportBrief(example(), dir); e != nil {
		t.Fatal(e)
	}
	for _, name := range []string{"index.html", "changes.json"} {
		if _, e := os.Stat(filepath.Join(dir, name)); e != nil {
			t.Fatal(e)
		}
	}
}
func TestJSONPreservesExactCountsAndSource(t *testing.T) {
	dir := t.TempDir()
	ExportBrief(example(), dir)
	data, _ := os.ReadFile(filepath.Join(dir, "changes.json"))
	var report Brief
	if e := json.Unmarshal(data, &report); e != nil {
		t.Fatal(e)
	}
	if report.Added[0].Count != 2 || report.Removed[0].Text != "Open Thursday" || report.Unchanged != 3 || report.After.URL != "https://example.invalid/" {
		t.Fatal(report)
	}
}
func TestUntrustedTextIsEscaped(t *testing.T) {
	dir := t.TempDir()
	r := example()
	r.Added = []Change{{"<script>alert(1)</script>", 1}}
	ExportBrief(r, dir)
	data, _ := os.ReadFile(filepath.Join(dir, "index.html"))
	if strings.Contains(string(data), "<script>") || !strings.Contains(string(data), "&lt;script&gt;") {
		t.Fatal(string(data))
	}
}
func TestNoChangesHasExplicitEmptyMessage(t *testing.T) {
	dir := t.TempDir()
	r := example()
	r.Added = nil
	r.Removed = nil
	ExportBrief(r, dir)
	data, _ := os.ReadFile(filepath.Join(dir, "index.html"))
	if !strings.Contains(string(data), "No added text.") || !strings.Contains(string(data), "No removed text.") {
		t.Fatal(string(data))
	}
}
func TestInvalidOutputDirectoryPropagatesError(t *testing.T) {
	path := filepath.Join(t.TempDir(), "file")
	os.WriteFile(path, []byte("x"), 0644)
	if e := ExportBrief(example(), path); e == nil {
		t.Fatal("file accepted as output directory")
	}
}
func TestTemplateIncludesBothHashesAndSourceLink(t *testing.T) {
	dir := t.TempDir()
	ExportBrief(example(), dir)
	data, _ := os.ReadFile(filepath.Join(dir, "index.html"))
	for _, text := range []string{"before", "after", `href="https://example.invalid/"`, "Unchanged blocks: 3"} {
		if !strings.Contains(string(data), text) {
			t.Fatal(text)
		}
	}
}
