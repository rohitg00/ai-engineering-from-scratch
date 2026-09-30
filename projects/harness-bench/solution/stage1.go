package main

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
)

func Cases(data []byte, max int) ([]Case, error) {
	if len(data) > 1024*1024 {
		return nil, ErrLimit
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.DisallowUnknownFields()
	var cases []Case
	if e := decoder.Decode(&cases); e != nil {
		return nil, e
	}
	var extra any
	if decoder.Decode(&extra) != io.EOF {
		return nil, ErrInvalid
	}
	if max < 0 || len(cases) > max {
		return nil, ErrLimit
	}
	seen := map[string]bool{}
	for _, c := range cases {
		if strings.TrimSpace(c.ID) == "" || strings.TrimSpace(c.Prompt) == "" || strings.TrimSpace(c.Expected) == "" {
			return nil, ErrInvalid
		}
		if seen[c.ID] {
			return nil, ErrConflict
		}
		seen[c.ID] = true
	}
	return cases, nil
}
