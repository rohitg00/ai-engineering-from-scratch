package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"os"
)

func main() {
	repo := flag.String("repo", "", "read-only repository path")
	from := flag.String("from", "", "exclusive starting revision")
	to := flag.String("to", "HEAD", "inclusive ending revision")
	input := flag.String("input", "", "NUL-delimited Git export")
	label := flag.String("label", "v0.2.0", "release label")
	output := flag.String("output", "", "Markdown output path; stdout if omitted")
	receipt := flag.String("receipt", "", "JSON source receipt path")
	flag.Parse()
	var snapshot GitSnapshot
	var err error
	if *repo != "" && *input != "" {
		err = ErrInvalid
	} else if *repo != "" {
		snapshot, err = ReadRepository(*repo, *from, *to)
	} else {
		raw := []byte("abc1234\x00feat(index): cache evidence\x00\x00\ndef5678\x00fix: preserve citation offsets\x00BREAKING CHANGE: Rebuild cached citation offsets before upgrading.\x00\n")
		if *input != "" {
			raw, err = os.ReadFile(*input)
		}
		if err == nil {
			snapshot.Records, err = ParseGitExport(raw)
			sum := sha256.Sum256(raw)
			snapshot.SHA256 = hex.EncodeToString(sum[:])
			snapshot.From = "export"
			snapshot.To = "export"
		}
	}
	var text string
	if err == nil {
		text, err = ReleaseSnapshot(*label, snapshot, 1000)
	}
	if err == nil && *output != "" {
		err = os.WriteFile(*output, []byte(text), 0600)
	} else if err == nil {
		fmt.Print(text)
	}
	if err == nil && *receipt != "" {
		var raw []byte
		raw, err = json.MarshalIndent(snapshot, "", "  ")
		if err == nil {
			err = os.WriteFile(*receipt, raw, 0600)
		}
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "changelog:", err)
		os.Exit(1)
	}
}
