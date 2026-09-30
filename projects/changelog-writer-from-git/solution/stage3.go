package main

import "sort"

func Group(commits []Commit) (map[string][]Commit, error) {
	out := map[string][]Commit{}
	for _, raw := range commits {
		c, e := Classify(raw)
		if e != nil {
			return nil, e
		}
		group := "Other"
		if c.Breaking {
			group = "Breaking changes"
		} else if c.Kind == "feat" {
			group = "Features"
		} else if c.Kind == "fix" {
			group = "Fixes"
		}
		out[group] = append(out[group], c)
	}
	for key := range out {
		sort.Slice(out[key], func(i, j int) bool { return out[key][i].Hash < out[key][j].Hash })
	}
	return out, nil
}
