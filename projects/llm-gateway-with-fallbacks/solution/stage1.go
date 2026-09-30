package main

import (
	"net/url"
	"strings"
)

func Endpoints(values []string) ([]string, error) {
	out := []string{}
	seen := map[string]bool{}
	for _, raw := range values {
		u, e := url.Parse(raw)
		if e != nil || u.Hostname() == "" || u.User != nil || u.Fragment != "" || u.RawQuery != "" {
			return nil, ErrInvalid
		}
		local := u.Hostname() == "localhost" || u.Hostname() == "127.0.0.1" || u.Hostname() == "::1"
		if u.Scheme != "https" && !(u.Scheme == "http" && local) {
			return nil, ErrInvalid
		}
		if strings.ContainsAny(raw, "\r\n") {
			return nil, ErrInvalid
		}
		if !seen[raw] {
			seen[raw] = true
			out = append(out, raw)
		}
	}
	if len(out) == 0 {
		return nil, ErrInvalid
	}
	return out, nil
}
