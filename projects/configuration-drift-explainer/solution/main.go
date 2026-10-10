package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"reflect"
	"regexp"
	"sort"
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
	var in Input
	if len(data) > 1<<20 {
		return in, errors.New("input exceeds one MiB")
	}
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(&in); err != nil {
		return in, err
	}
	var tail any
	if d.Decode(&tail) != io.EOF {
		return in, errors.New("trailing JSON")
	}
	if in.Layers == nil || in.Observed == nil {
		return in, errors.New("layers and observed are required")
	}
	seen := map[string]bool{}
	for _, l := range in.Layers {
		if strings.TrimSpace(l.Name) == "" || seen[l.Name] || l.Values == nil {
			return in, errors.New("invalid or duplicate layer")
		}
		seen[l.Name] = true
		if err := validate(l.Values); err != nil {
			return in, err
		}
	}
	if err := validate(in.Observed); err != nil {
		return in, err
	}
	for _, k := range in.Sensitive {
		if strings.TrimSpace(k) == "" {
			return in, errors.New("blank sensitive key")
		}
	}
	return in, nil
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
func Resolve(layers []Layer) map[string]Effective {
	out := map[string]Effective{}
	for _, l := range layers {
		for k, v := range l.Values {
			e := out[k]
			e.Value = v
			e.History = append(e.History, Source{l.Name, v})
			out[k] = e
		}
	}
	return out
}

var secret = regexp.MustCompile(`(?i)(password|secret|token|api[_-]?key|credential)`)

func Compare(in Input) Report {
	effective := Resolve(in.Layers)
	keys := map[string]bool{}
	sensitive := map[string]bool{}
	for _, k := range in.Sensitive {
		sensitive[k] = true
	}
	for k := range effective {
		keys[k] = true
	}
	for k := range in.Observed {
		keys[k] = true
	}
	order := []string{}
	for k := range keys {
		order = append(order, k)
	}
	sort.Strings(order)
	out := Report{SchemaVersion: 1, Changes: []Change{}}
	for _, k := range order {
		e, expected := effective[k]
		actual, observed := in.Observed[k]
		kind := "equal"
		if !expected {
			kind = "unexpected"
		} else if !observed {
			kind = "missing"
		} else if !reflect.DeepEqual(e.Value, actual) {
			kind = "changed"
		}
		if kind != "equal" {
			out.Drift = true
		}
		c := Change{Key: k, Kind: kind, Expected: e.Value, Observed: actual, History: append([]Source{}, e.History...), Redacted: secret.MatchString(k) || sensitive[k]}
		if c.Redacted {
			if expected {
				c.Expected = "[REDACTED]"
			}
			if observed {
				c.Observed = "[REDACTED]"
			}
			for i := range c.History {
				c.History[i].Value = "[REDACTED]"
			}
		}
		out.Changes = append(out.Changes, c)
	}
	return out
}
func Export(in Input) ([]byte, error) { return json.MarshalIndent(Compare(in), "", "  ") }
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
