package main

import "hash/fnv"

func Partition(ids []string, shards int) ([][]string, error) {
	if shards < 1 || shards > 1024 {
		return nil, ErrInvalid
	}
	out := make([][]string, shards)
	seen := map[string]bool{}
	for _, id := range ids {
		if id == "" {
			return nil, ErrInvalid
		}
		if seen[id] {
			return nil, ErrConflict
		}
		seen[id] = true
		h := fnv.New32a()
		h.Write([]byte(id))
		index := int(h.Sum32() % uint32(shards))
		out[index] = append(out[index], id)
	}
	return out, nil
}
