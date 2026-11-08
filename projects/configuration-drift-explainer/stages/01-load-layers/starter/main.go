package main

import (
	"errors"
	"flag"
	"fmt"
	"os"
	"regexp"
	"strings"
)

type Layer struct {
	Name   string         `json:"name"`
	Values map[string]any `json:"values"`
}
type Input struct {
	Layers    []Layer        `json:"layers"`
	Observed  map[string]any `json:"observed"`
	Sensitive []string       `json:"sensitive"`
}
type Source struct {
	Layer string `json:"layer"`
	Value any    `json:"value"`
}
type Effective struct {
	Value   any
	History []Source
}
type Change struct {
	Key      string   `json:"key"`
	Kind     string   `json:"kind"`
	Expected any      `json:"expected"`
	Observed any      `json:"observed"`
	History  []Source `json:"history"`
	Redacted bool     `json:"redacted"`
}
type Report struct {
	SchemaVersion int      `json:"schemaVersion"`
	Drift         bool     `json:"drift"`
	Changes       []Change `json:"changes"`
}

func Load(data []byte) (Input, error) {
	return Input{}, errors.New("TODO stage 1: parse configuration")
}
func validate(values map[string]any) error {
	for k, v := range values {
		if strings.TrimSpace(k) == "" || strings.ContainsAny(k, "\r\n\x00") {
			return errors.New("invalid key")
		}
		switch v.(type) {
		case nil, string, bool, float64:
		default:
			return errors.New("values must be JSON scalars")
		}
	}
	return nil
}
func Resolve(layers []Layer) map[string]Effective { return map[string]Effective{} }

var secret = regexp.MustCompile(`(?i)(password|secret|token|api[_-]?key|credential)`)

func Compare(in Input) Report         { return Report{} }
func Export(in Input) ([]byte, error) { return nil, errors.New("TODO stage 4: export redacted report") }
func main() {
	input := flag.String("input", "fixtures/config.json", "configuration JSON")
	output := flag.String("out", "", "report path (stdout by default)")
	check := flag.Bool("check", false, "exit 2 when drift exists")
	flag.Parse()
	b, err := os.ReadFile(*input)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	in, err := Load(b)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	b, err = Export(in)
	if err == nil && *output != "" {
		err = os.WriteFile(*output, append(b, '\n'), 0600)
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Println(string(b))
	if *check && Compare(in).Drift {
		os.Exit(2)
	}
}
