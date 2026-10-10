package main

import (
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"time"
)

type Metadata struct {
	UID             string            `json:"uid"`
	Name            string            `json:"name"`
	Namespace       string            `json:"namespace"`
	ResourceVersion string            `json:"resourceVersion"`
	Creation        string            `json:"creationTimestamp"`
	Annotations     map[string]string `json:"annotations"`
	Owners          []struct {
		UID string `json:"uid"`
	} `json:"ownerReferences"`
}
type ObjectRef struct {
	UID             string `json:"uid"`
	Kind            string `json:"kind"`
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	ResourceVersion string `json:"resourceVersion"`
}
type Event struct {
	Metadata  Metadata  `json:"metadata"`
	Object    ObjectRef `json:"involvedObject"`
	Reason    string    `json:"reason"`
	Type      string    `json:"type"`
	Count     int       `json:"count"`
	First     string    `json:"firstTimestamp"`
	Last      string    `json:"lastTimestamp"`
	EventTime string    `json:"eventTime"`
	Series    *struct {
		Count int    `json:"count"`
		Last  string `json:"lastObservedTime"`
	} `json:"series"`
}
type Workload struct {
	Metadata Metadata `json:"metadata"`
	Kind     string   `json:"kind"`
}
type Bundle struct {
	ObservedAt string `json:"observedAt"`
	Events     struct {
		Items []Event `json:"items"`
	} `json:"events"`
	Workloads struct {
		Items []Workload `json:"items"`
	} `json:"workloads"`
}
type Row struct {
	Object        ObjectRef `json:"object"`
	Reason        string    `json:"reason"`
	Type          string    `json:"type"`
	Count         int       `json:"count"`
	First         string    `json:"firstOccurrence"`
	Last          string    `json:"lastOccurrence"`
	ObservedAt    string    `json:"observedAt"`
	EventUIDs     []string  `json:"eventUIDs"`
	Revision      string    `json:"revision,omitempty"`
	Investigation string    `json:"investigation"`
}
type Pack struct {
	SchemaVersion int      `json:"schemaVersion"`
	ObservedAt    string   `json:"observedAt"`
	Rows          []Row    `json:"rows"`
	Redactions    []string `json:"redactions"`
}

func stamp(s string) (time.Time, error)              { return time.Parse(time.RFC3339Nano, s) }
func Parse(data []byte) (Bundle, error)              { return Bundle{}, errors.New("TODO stage 1: parse snapshots") }
func Group(b Bundle) ([]Row, error)                  { return nil, errors.New("TODO stage 2: group events") }
func before(a, b string) bool                        { x, _ := stamp(a); y, _ := stamp(b); return x.Before(y) }
func Connect(rows []Row, workloads []Workload) []Row { return nil }
func Export(b Bundle) (Pack, error)                  { return Pack{}, errors.New("TODO stage 4: export pack") }
func main() {
	input := flag.String("input", "fixtures/rollout.json", "exported snapshot bundle")
	out := flag.String("out", "/tmp/aiefs-kubernetes-context.json", "context pack")
	flag.Parse()
	data, e := os.ReadFile(*input)
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	b, e := Parse(data)
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	pack, e := Export(b)
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	data, e = json.MarshalIndent(pack, "", "  ")
	if e == nil {
		e = os.WriteFile(*out, append(data, '\n'), 0600)
	}
	if e != nil {
		fmt.Fprintln(os.Stderr, e)
		os.Exit(1)
	}
	fmt.Println(string(data))
}
