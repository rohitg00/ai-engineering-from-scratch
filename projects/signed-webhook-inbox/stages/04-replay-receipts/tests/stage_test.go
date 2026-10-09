package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"testing"
	"time"
)

func seed(t *testing.T) string {
	dir := t.TempDir()
	_, _, e := Accept(dir, "d1", []byte(`{"eventId":"business-9","data":{"count":7}}`), time.Now())
	if e != nil {
		t.Fatal(e)
	}
	return dir
}
func TestReplayArtifact(t *testing.T) {
	p, new, e := Replay(seed(t), "d1", "run1", time.Now())
	if e != nil || !new || p.BusinessEventID != "business-9" || string(p.Payload) != `{"count":7}` {
		t.Fatal(p, e)
	}
}
func TestSameRunOnce(t *testing.T) {
	dir := seed(t)
	a, _, _ := Replay(dir, "d1", "r1", time.Unix(1, 0))
	b, new, e := Replay(dir, "d1", "r1", time.Unix(2, 0))
	if e != nil || new || a.ProcessedAt != b.ProcessedAt {
		t.Fatal(a, b, e)
	}
}
func TestExplicitNewRun(t *testing.T) {
	dir := seed(t)
	Replay(dir, "d1", "r1", time.Now())
	if _, new, e := Replay(dir, "d1", "r2", time.Now()); e != nil || !new {
		t.Fatal(new, e)
	}
}
func TestUnacceptedCannotReplay(t *testing.T) {
	if _, _, e := Replay(t.TempDir(), "missing", "r1", time.Now()); e == nil {
		t.Fatal("invented delivery")
	}
}
func TestProcessorRejectsOpaqueBody(t *testing.T) {
	dir := t.TempDir()
	Accept(dir, "d1", []byte("opaque"), time.Now())
	if _, _, e := Replay(dir, "d1", "r1", time.Now()); e == nil {
		t.Fatal("invalid business payload")
	}
}
func TestWireOriginalRetryTamper(t *testing.T) {
	dir := t.TempDir()
	key := []byte("authored-wire-fixture-key")
	now := time.Unix(1770000000, 0)
	s := httptest.NewServer(Receiver(dir, key, func() time.Time { return now }))
	defer s.Close()
	body := []byte(`{"eventId":"wire","data":{}}`)
	sig := Sign(key, "wire-1", now.Unix(), body)
	for i, want := range []int{202, 200, 401} {
		raw := body
		if i == 2 {
			raw = append(append([]byte{}, body...), ' ')
		}
		r, _ := http.NewRequest("POST", s.URL, bytes.NewReader(raw))
		r.Header.Set("X-Delivery-ID", "wire-1")
		r.Header.Set("X-Timestamp", strconv.FormatInt(now.Unix(), 10))
		r.Header.Set("X-Signature", sig)
		res, e := s.Client().Do(r)
		if e != nil {
			t.Fatal(e)
		}
		io.Copy(io.Discard, res.Body)
		res.Body.Close()
		if res.StatusCode != want {
			t.Fatal(i, res.StatusCode, want)
		}
	}
}

func TestTamperedReceiptPayload(t *testing.T) {
	dir := seed(t)
	p, _, _ := Replay(dir, "d1", "r1", time.Now())
	p.Payload = json.RawMessage(`{"count":99}`)
	b, _ := json.Marshal(p)
	path := filepath.Join(dir, "processed", digest([]byte("d1\x00r1"))+".json")
	if e := os.WriteFile(path, b, 0600); e != nil {
		t.Fatal(e)
	}
	if _, _, e := Replay(dir, "d1", "r1", time.Now()); e == nil {
		t.Fatal("tampered payload accepted")
	}
}

func TestRepeatStringPayloadDoesNotAliasSource(t *testing.T) {
	dir := t.TempDir()
	raw := []byte(`{"eventId":"business-42","data":{"task":"review uploaded report"}}`)
	if _, _, e := Accept(dir, "d1", raw, time.Now()); e != nil {
		t.Fatal(e)
	}
	first, _, e := Replay(dir, "d1", "r1", time.Now())
	if e != nil {
		t.Fatal(e)
	}
	second, created, e := Replay(dir, "d1", "r1", time.Now())
	if e != nil || created || first.BusinessEventID != second.BusinessEventID {
		t.Fatal(second, created, e)
	}
}
