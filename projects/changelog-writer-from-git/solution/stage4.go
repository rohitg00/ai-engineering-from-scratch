package main

import (
	"fmt"
	"regexp"
	"strings"
)

func Release(label string, commits []Commit, max int) (string, error) {
	if !regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$`).MatchString(label) {
		return "", ErrInvalid
	}
	if max < 0 || len(commits) > max {
		return "", ErrLimit
	}
	groups, e := Group(commits)
	if e != nil {
		return "", e
	}
	escape := strings.NewReplacer("\\", "\\\\", "[", "\\[", "]", "\\]", "<", "&lt;", ">", "&gt;", "*", "\\*", "_", "\\_", "`", "\\`", "\n", " ", "\r", " ")
	out := "# " + label + "\n"
	for _, key := range []string{"Breaking changes", "Features", "Fixes", "Other"} {
		if len(groups[key]) == 0 {
			continue
		}
		out += "\n## " + key + "\n"
		for _, c := range groups[key] {
			out += fmt.Sprintf("- %s (%s)\n", escape.Replace(c.Description), c.Hash)
		}
	}
	return out, nil
}
