package main

import (
	"testing"
	"time"
)

var key = []byte("authored-heldout-fixture-key")

func delivery() Delivery {
	d := Delivery{ID: "heldout", Timestamp: 1770000000, Body: []byte(`{"x":1}`)}
	d.Signature = Sign(key, d.ID, d.Timestamp, d.Body)
	return d
}
func TestValidSignature(t *testing.T) {
	if e := Verify(delivery(), key, time.Unix(1770000000, 0), 5*time.Minute); e != nil {
		t.Fatal(e)
	}
}
func TestAlteredByte(t *testing.T) {
	d := delivery()
	d.Body = append(d.Body, ' ')
	if Verify(d, key, time.Unix(d.Timestamp, 0), 5*time.Minute) == nil {
		t.Fatal("tamper")
	}
}
func TestIdentityBound(t *testing.T) {
	d := delivery()
	d.ID = "different"
	if Verify(d, key, time.Unix(d.Timestamp, 0), 5*time.Minute) == nil {
		t.Fatal("ID not signed")
	}
}
func TestStale(t *testing.T) {
	d := delivery()
	if Verify(d, key, time.Unix(d.Timestamp+301, 0), 5*time.Minute) == nil {
		t.Fatal("stale")
	}
}
func TestInclusiveBoundary(t *testing.T) {
	d := delivery()
	if e := Verify(d, key, time.Unix(d.Timestamp+300, 0), 5*time.Minute); e != nil {
		t.Fatal(e)
	}
}
func TestFutureAndShortKey(t *testing.T) {
	d := delivery()
	if Verify(d, key, time.Unix(d.Timestamp-301, 0), 5*time.Minute) == nil || Verify(d, []byte("short"), time.Unix(d.Timestamp, 0), 5*time.Minute) == nil {
		t.Fatal("invalid verification parameters")
	}
}
