package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"sort"
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

func stamp(s string) (time.Time, error) { return time.Parse(time.RFC3339Nano, s) }
func Parse(data []byte) (Bundle, error) {
	var b Bundle
	if len(data) > 1<<20 {
		return b, errors.New("bundle exceeds one MiB")
	}
	d := json.NewDecoder(bytes.NewReader(data))
	if err := d.Decode(&b); err != nil {
		return b, err
	}
	var tail any
	if d.Decode(&tail) != io.EOF {
		return b, errors.New("trailing JSON")
	}
	if _, err := stamp(b.ObservedAt); err != nil {
		return b, errors.New("observedAt must be RFC3339")
	}
	if b.Events.Items == nil || b.Workloads.Items == nil {
		return b, errors.New("both items arrays required")
	}
	for i := range b.Events.Items {
		e := &b.Events.Items[i]
		if e.Metadata.UID == "" || e.Object.UID == "" || e.Reason == "" || e.Object.Name == "" {
			return b, errors.New("event UID, object UID, name and reason required")
		}
		if e.First == "" {
			e.First = e.EventTime
		}
		if e.First == "" {
			e.First = e.Metadata.Creation
		}
		if e.Last == "" {
			e.Last = e.First
		}
		if e.Count == 0 {
			e.Count = 1
		}
		if e.Series != nil {
			e.Count = e.Series.Count
			e.Last = e.Series.Last
		}
		a, x := stamp(e.First)
		z, y := stamp(e.Last)
		if x != nil || y != nil || z.Before(a) || e.Count < 1 {
			return b, errors.New("invalid occurrence range or count")
		}
	}
	seen := map[string]bool{}
	for _, w := range b.Workloads.Items {
		if w.Metadata.UID == "" || seen[w.Metadata.UID] {
			return b, errors.New("invalid or duplicate workload UID")
		}
		seen[w.Metadata.UID] = true
	}
	return b, nil
}
func Group(b Bundle) ([]Row, error) {
	unique := map[string]Event{}
	for _, e := range b.Events.Items {
		if old, ok := unique[e.Metadata.UID]; ok {
			if old.Object.UID != e.Object.UID || old.Reason != e.Reason || old.Type != e.Type {
				return nil, errors.New("event UID changed identity")
			}
			if e.Count < old.Count {
				e.Count = old.Count
			}
			if before(old.First, e.First) {
				e.First = old.First
			}
			if before(e.Last, old.Last) {
				e.Last = old.Last
			}
		}
		unique[e.Metadata.UID] = e
	}
	groups := map[string]Row{}
	uids := make([]string, 0, len(unique))
	for uid := range unique {
		uids = append(uids, uid)
	}
	sort.Strings(uids)
	for _, uid := range uids {
		e := unique[uid]
		key := e.Object.UID + "\x00" + e.Reason + "\x00" + e.Type
		r, ok := groups[key]
		if !ok {
			r = Row{Object: e.Object, Reason: e.Reason, Type: e.Type, First: e.First, Last: e.Last, ObservedAt: b.ObservedAt, EventUIDs: []string{}}
		}
		r.Count += e.Count
		if before(e.First, r.First) {
			r.First = e.First
		}
		if before(r.Last, e.Last) {
			r.Last = e.Last
		}
		r.EventUIDs = append(r.EventUIDs, uid)
		groups[key] = r
	}
	out := []Row{}
	for _, r := range groups {
		sort.Strings(r.EventUIDs)
		out = append(out, r)
	}
	sort.Slice(out, func(i, j int) bool {
		if before(out[i].First, out[j].First) {
			return true
		}
		if before(out[j].First, out[i].First) {
			return false
		}
		return out[i].Object.UID+"\x00"+out[i].Reason+"\x00"+out[i].Type < out[j].Object.UID+"\x00"+out[j].Reason+"\x00"+out[j].Type
	})
	return out, nil
}
func before(a, b string) bool { x, _ := stamp(a); y, _ := stamp(b); return x.Before(y) }
func Connect(rows []Row, workloads []Workload) []Row {
	byUID := map[string]Workload{}
	for _, w := range workloads {
		byUID[w.Metadata.UID] = w
	}
	out := append([]Row{}, rows...)
	for i := range out {
		r := &out[i]
		queue := []string{r.Object.UID}
		seen := map[string]bool{}
		revisions := map[string]bool{}
		for len(queue) > 0 {
			uid := queue[0]
			queue = queue[1:]
			if seen[uid] {
				continue
			}
			seen[uid] = true
			if w, ok := byUID[uid]; ok {
				if rev := w.Metadata.Annotations["deployment.kubernetes.io/revision"]; rev != "" {
					revisions[rev] = true
				}
				for _, o := range w.Metadata.Owners {
					queue = append(queue, o.UID)
				}
			}
		}
		if len(revisions) == 1 {
			for rev := range revisions {
				r.Revision = rev
			}
		}
		r.Investigation = "Inspect the referenced object and its controller events"
		if r.Reason == "Failed" || r.Reason == "BackOff" {
			r.Investigation = "Inspect image references, pull credentials and container state; event reason alone does not prove cause"
		}
	}
	return out
}
func Export(b Bundle) (Pack, error) {
	rows, e := Group(b)
	if e != nil {
		return Pack{}, e
	}
	return Pack{1, b.ObservedAt, Connect(rows, b.Workloads.Items), []string{"event messages omitted", "workload spec, status, labels and unrelated annotations omitted"}}, nil
}
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
