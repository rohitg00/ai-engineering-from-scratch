package main

import (
	"regexp"
	"strings"
)

func Classify(c Commit) (Commit, error) {
	r := regexp.MustCompile(`^([a-z]+)(?:\(([a-z0-9_-]+)\))?(!)?: (.+)$`)
	m := r.FindStringSubmatch(c.Subject)
	if m == nil {
		if strings.TrimSpace(c.Subject) == "" {
			return c, ErrInvalid
		}
		c.Kind = "other"
		c.Description = c.Subject
		return c, nil
	}
	c.Kind = m[1]
	c.Scope = m[2]
	c.Breaking = c.Breaking || m[3] == "!"
	c.Description = m[4]
	return c, nil
}
