package main

import "context"
import "net/http"

type Snapshot struct {
	URL    string   `json:"url"`
	Blocks []string `json:"blocks"`
	Hash   string   `json:"hash"`
}
type Change struct {
	Text  string `json:"text"`
	Count int    `json:"count"`
}
type Brief struct {
	Before    Snapshot `json:"before"`
	After     Snapshot `json:"after"`
	Added     []Change `json:"added"`
	Removed   []Change `json:"removed"`
	Unchanged int      `json:"unchanged"`
}

const MaxHTMLBytes = 2000000

func ExtractBlocks(input string, ignores []string) ([]string, error) {
	panic("Implement stage 1: extract readable blocks")
}
func CanonicalURL(raw string) (string, error) { panic("Implement stage 2") }
func NewSnapshot(rawURL, input string, ignores []string) (Snapshot, error) {
	panic("Implement stage 2")
}
func Compare(before, after Snapshot) (Brief, error) { panic("Implement stage 2") }
func FetchHTML(ctx context.Context, rawURL string, client *http.Client) (string, error) {
	panic("Implement stage 3")
}
func SaveSnapshot(path string, snapshot Snapshot) error { panic("Implement stage 3") }
func LoadSnapshot(path string) (Snapshot, error)        { panic("Implement stage 3") }
func ExportBrief(brief Brief, directory string) error   { panic("Implement stage 4") }
func main()                                             { panic("Implement stage 4 CLI") }
