package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"time"
)

var validID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
var ErrConflict = errors.New("delivery identity already has a different body")

type Delivery struct {
	ID        string
	Timestamp int64
	Signature string
	Body      []byte
}

func ReadDelivery(r *http.Request) (Delivery, error) {
	return Delivery{}, errors.New("TODO stage 1: preserve raw delivery")
}
func Sign(key []byte, id string, timestamp int64, body []byte) string {
	mac := hmac.New(sha256.New, key)
	fmt.Fprintf(mac, "%d.%s.", timestamp, id)
	mac.Write(body)
	return "v1=" + hex.EncodeToString(mac.Sum(nil))
}
func Verify(d Delivery, key []byte, now time.Time, skew time.Duration) error {
	return errors.New("TODO stage 2: verify signature")
}

type Entry struct {
	SchemaVersion int    `json:"schemaVersion"`
	DeliveryID    string `json:"deliveryId"`
	Body          []byte `json:"body"`
	SHA256        string `json:"sha256"`
	AcceptedAt    string `json:"acceptedAt"`
}
type Processing struct {
	SchemaVersion   int             `json:"schemaVersion"`
	DeliveryID      string          `json:"deliveryId"`
	RunID           string          `json:"runId"`
	BusinessEventID string          `json:"businessEventId"`
	BodySHA256      string          `json:"bodySHA256"`
	ProcessedAt     string          `json:"processedAt"`
	Payload         json.RawMessage `json:"payload"`
}

func digest(data []byte) string { sum := sha256.Sum256(data); return hex.EncodeToString(sum[:]) }
func entryPath(dir, id string) string {
	return filepath.Join(dir, "deliveries", digest([]byte(id))+".json")
}
func durableCreate(path string, data []byte) (bool, error) {
	dir := filepath.Dir(path)
	if e := os.MkdirAll(dir, 0700); e != nil {
		return false, e
	}
	for current := dir; ; current = filepath.Dir(current) {
		folder, e := os.Open(current)
		if e != nil {
			return false, e
		}
		e = folder.Sync()
		folder.Close()
		if e != nil {
			return false, e
		}
		if filepath.Dir(current) == current {
			break
		}
	}
	f, e := os.CreateTemp(dir, ".pending-")
	if e != nil {
		return false, e
	}
	tmp := f.Name()
	defer os.Remove(tmp)
	if _, e = f.Write(data); e == nil {
		e = f.Sync()
	}
	closeErr := f.Close()
	if e != nil {
		return false, e
	}
	if closeErr != nil {
		return false, closeErr
	}
	if e = os.Link(tmp, path); e != nil {
		if errors.Is(e, os.ErrExist) {
			folder, openErr := os.Open(dir)
			if openErr != nil {
				return false, openErr
			}
			defer folder.Close()
			return false, folder.Sync()
		}
		return false, e
	}
	folder, e := os.Open(dir)
	if e != nil {
		return true, e
	}
	defer folder.Close()
	if e = folder.Sync(); e != nil {
		return true, e
	}
	return true, nil
}
func LoadEntry(dir, id string) (Entry, error) {
	var x Entry
	if !validID.MatchString(id) {
		return x, errors.New("invalid delivery ID")
	}
	b, e := os.ReadFile(entryPath(dir, id))
	if e != nil {
		return x, e
	}
	if e = json.Unmarshal(b, &x); e != nil {
		return x, e
	}
	if x.SchemaVersion != 1 || x.DeliveryID != id || x.SHA256 != digest(x.Body) {
		return x, errors.New("corrupt inbox record")
	}
	return x, nil
}
func Accept(dir, id string, body []byte, now time.Time) (Entry, bool, error) {
	return Entry{}, false, errors.New("TODO stage 3: durable inbox")
}
func Replay(dir, id, run string, now time.Time) (Processing, bool, error) {
	return Processing{}, false, errors.New("TODO stage 4: replay receipt")
}
func Receiver(dir string, key []byte, now func() time.Time) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		d, e := ReadDelivery(r)
		if e != nil {
			http.Error(w, e.Error(), 400)
			return
		}
		if e = Verify(d, key, now(), 5*time.Minute); e != nil {
			http.Error(w, e.Error(), 401)
			return
		}
		entry, created, e := Accept(dir, d.ID, d.Body, now())
		if e != nil {
			status := 500
			if errors.Is(e, ErrConflict) {
				status = 409
			}
			http.Error(w, e.Error(), status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		status := 200
		if created {
			status = 202
		}
		w.WriteHeader(status)
		json.NewEncoder(w).Encode(map[string]any{"schemaVersion": 1, "deliveryId": entry.DeliveryID, "sha256": entry.SHA256, "newDelivery": created})
	})
}
func Demo() error {
	dir, e := os.MkdirTemp("", "aiefs-webhook-")
	if e != nil {
		return e
	}
	defer os.RemoveAll(dir)
	key := bytes.Repeat([]byte("authored-fixture-"), 2)
	now := time.Unix(1770000000, 0)
	server := httptest.NewServer(Receiver(dir, key, func() time.Time { return now }))
	defer server.Close()
	body := []byte(`{"eventId":"business-42","data":{"task":"review uploaded report"}}`)
	signature := Sign(key, "delivery-1", now.Unix(), body)
	statuses := []int{}
	for _, raw := range [][]byte{body, body, append(append([]byte{}, body...), ' ')} {
		req, _ := http.NewRequest("POST", server.URL, bytes.NewReader(raw))
		req.Header.Set("X-Delivery-ID", "delivery-1")
		req.Header.Set("X-Timestamp", strconv.FormatInt(now.Unix(), 10))
		req.Header.Set("X-Signature", signature)
		resp, e := server.Client().Do(req)
		if e != nil {
			return e
		}
		statuses = append(statuses, resp.StatusCode)
		io.Copy(io.Discard, resp.Body)
		resp.Body.Close()
	}
	entry, e := LoadEntry(dir, "delivery-1")
	if e != nil {
		return e
	}
	p, created, e := Replay(dir, "delivery-1", "review-1", now)
	if e != nil {
		return e
	}
	_, again, e := Replay(dir, "delivery-1", "review-1", now)
	if e != nil {
		return e
	}
	result := map[string]any{"statuses": statuses, "persistedDelivery": entry.DeliveryID, "processing": p, "firstReplayCreated": created, "sameRunCreatedAgain": again}
	b, _ := json.MarshalIndent(result, "", "  ")
	fmt.Println(string(b))
	return nil
}
func main() {
	mode := flag.String("mode", "demo", "demo|serve|replay|inspect|sign")
	dir := flag.String("dir", "", "durable inbox directory")
	id := flag.String("id", "", "delivery ID")
	run := flag.String("run", "", "explicit replay run ID")
	file := flag.String("body", "", "raw payload file for signing")
	stamp := flag.Int64("timestamp", 0, "timestamp seconds for signing")
	addr := flag.String("listen", "127.0.0.1:0", "receiver address")
	seconds := flag.Int("seconds", 60, "finite receiver lifetime")
	keyEnv := flag.String("key-env", "WEBHOOK_SECRET", "environment variable containing shared secret")
	flag.Parse()
	var err error
	var result any
	switch *mode {
	case "demo":
		err = Demo()
	case "replay":
		if *dir == "" {
			err = errors.New("--dir required")
			break
		}
		var p Processing
		p, _, err = Replay(*dir, *id, *run, time.Now())
		result = p
	case "inspect":
		if *dir == "" {
			err = errors.New("--dir required")
			break
		}
		result, err = LoadEntry(*dir, *id)
	case "sign":
		key := []byte(os.Getenv(*keyEnv))
		if len(key) < 16 || !validID.MatchString(*id) {
			err = errors.New("valid ID and key environment variable required")
			break
		}
		var body []byte
		body, err = os.ReadFile(*file)
		if err == nil {
			result = map[string]string{"X-Delivery-ID": *id, "X-Timestamp": strconv.FormatInt(*stamp, 10), "X-Signature": Sign(key, *id, *stamp, body)}
		}
	case "serve":
		key := []byte(os.Getenv(*keyEnv))
		if *dir == "" || len(key) < 16 || *seconds < 1 || *seconds > 600 {
			err = errors.New("--dir, 16-byte key env and seconds 1..600 required")
			break
		}
		var ln net.Listener
		ln, err = net.Listen("tcp", *addr)
		if err != nil {
			break
		}
		server := &http.Server{Handler: Receiver(*dir, key, time.Now), ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 5 * time.Second, WriteTimeout: 5 * time.Second}
		fmt.Println("http://" + ln.Addr().String())
		time.AfterFunc(time.Duration(*seconds)*time.Second, func() { server.Close() })
		err = server.Serve(ln)
		if err == http.ErrServerClosed {
			err = nil
		}
	default:
		err = errors.New("unknown mode")
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if result != nil {
		b, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(b))
	}
}
