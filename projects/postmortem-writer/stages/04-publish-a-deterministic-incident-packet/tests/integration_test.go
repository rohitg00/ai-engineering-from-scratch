package main

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"
)

var eventFixture = []byte("\n{\"id\":\"e1\",\"second\":12,\"kind\":\"alert\",\"message\":\"latency high <script>\"}\n")

func reviewFixture(state, hash, quote string) []byte {
	return []byte(fmt.Sprintf(`{"sourceSHA256":%q,"impact":"Unknown","claims":[{"text":"Latency rose","evidence":["e1"],"quotes":{"e1":%q},"state":%q,"reviewer":"operator"}],"actions":[{"task":"Investigate","owner":"team-a","state":"open"}]}`, hash, quote, state))
}
func TestPhysicalLineLocator(t *testing.T) {
	rows, e := ImportJSONL(eventFixture)
	if e != nil || rows[0].Line != 2 {
		t.Fatal(rows, e)
	}
}
func TestFabricatedQuote(t *testing.T) {
	if _, e := BuildPacket(eventFixture, reviewFixture("pending", "", "database failed")); e == nil {
		t.Fatal("unsupported quote accepted")
	}
}
func TestApprovalNeedsVersion(t *testing.T) {
	if _, e := BuildPacket(eventFixture, reviewFixture("approved", "", "latency high")); e == nil {
		t.Fatal("unbound approval accepted")
	}
}
func TestStaleReview(t *testing.T) {
	if _, e := BuildPacket(eventFixture, reviewFixture("approved", strings.Repeat("a", 64), "latency high")); e == nil {
		t.Fatal("stale approved source")
	}
}
func TestApprovedReceipt(t *testing.T) {
	hash := fmt.Sprintf("%x", sha256.Sum256(eventFixture))
	packet, e := BuildPacket(eventFixture, reviewFixture("approved", hash, "latency high"))
	if e != nil || packet.Pending != 0 || packet.SourceSHA256 != hash {
		t.Fatal(packet, e)
	}
}
func TestHTMLQuotedAndLinked(t *testing.T) {
	packet, e := BuildPacket(eventFixture, reviewFixture("pending", "", "latency high"))
	if e != nil {
		t.Fatal(e)
	}
	page, e := RenderPacket(packet)
	if e != nil || strings.Contains(page, "<script>") || !strings.Contains(page, "input line 2") || !strings.Contains(page, `href="#event-e1"`) {
		t.Fatal(page, e)
	}
}
func TestUnknownRecordField(t *testing.T) {
	if _, e := ImportJSONL([]byte(`{"id":"a","second":0,"kind":"a","message":"x","hidden":"y"}`)); e == nil {
		t.Fatal("unknown field")
	}
}
func TestMissingTime(t *testing.T) {
	if _, e := ImportJSONL([]byte(`{"id":"a","kind":"a","message":"x"}`)); e == nil {
		t.Fatal("missing second became zero")
	}
}
func TestTextPacketPreservesReviewMetadata(t *testing.T) {
	hash := fmt.Sprintf("%x", sha256.Sum256(eventFixture))
	pending, e := BuildPacket(eventFixture, reviewFixture("pending", "", "latency high"))
	if e != nil {
		t.Fatal(e)
	}
	approved, e := BuildPacket(eventFixture, reviewFixture("approved", hash, "latency high"))
	if e != nil {
		t.Fatal(e)
	}
	if pending.Text == approved.Text {
		t.Fatal("review state was lost")
	}
	for _, part := range []string{hash, `IMPACT "Unknown"`, `owner="team-a"`, `state=approved`, `reviewer="operator"`, `line=2`, `text="latency high"`} {
		if !strings.Contains(approved.Text, part) {
			t.Fatalf("missing %q in %s", part, approved.Text)
		}
	}
}
