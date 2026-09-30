package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"html"
	"html/template"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
	"unicode"
)

const MaxHTMLBytes = 2_000_000

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

func normalize(text string) string {
	return strings.Join(strings.Fields(html.UnescapeString(text)), " ")
}

func ExtractBlocks(input string, ignorePhrases []string) ([]string, error) {
	if len(input) > MaxHTMLBytes {
		return nil, errors.New("HTML exceeds 2 MB")
	}
	blocks := []string{}
	var buffer strings.Builder
	ignored := map[string]bool{"script": true, "style": true, "nav": true, "footer": true, "noscript": true, "head": true}
	boundaries := map[string]bool{"p": true, "div": true, "section": true, "article": true, "li": true, "tr": true, "h1": true, "h2": true, "h3": true, "h4": true, "h5": true, "h6": true, "br": true, "hr": true}
	skip := ""
	depth := 0
	flush := func() {
		text := normalize(buffer.String())
		buffer.Reset()
		if text == "" {
			return
		}
		for _, phrase := range ignorePhrases {
			if strings.TrimSpace(phrase) != "" && strings.Contains(strings.ToLower(text), strings.ToLower(phrase)) {
				return
			}
		}
		blocks = append(blocks, text)
	}
	for i := 0; i < len(input); {
		if input[i] != '<' {
			if skip == "" {
				buffer.WriteByte(input[i])
			}
			i++
			continue
		}
		if strings.HasPrefix(input[i:], "<!--") {
			end := strings.Index(input[i+4:], "-->")
			if end < 0 {
				return nil, errors.New("Unclosed HTML comment")
			}
			i += end + 7
			continue
		}
		end := i + 1
		quote := byte(0)
		for end < len(input) {
			ch := input[end]
			if quote != 0 {
				if ch == quote {
					quote = 0
				}
			} else if ch == '\'' || ch == '"' {
				quote = ch
			} else if ch == '>' {
				break
			}
			end++
		}
		if end == len(input) {
			return nil, errors.New("Unclosed HTML tag")
		}
		tag := strings.TrimSpace(input[i+1 : end])
		closing := strings.HasPrefix(tag, "/")
		tag = strings.TrimLeft(tag, "/")
		parts := strings.FieldsFunc(tag, func(r rune) bool { return unicode.IsSpace(r) || r == '/' })
		if len(parts) == 0 {
			return nil, errors.New("Empty HTML tag")
		}
		name := strings.ToLower(parts[0])
		i = end + 1
		if skip != "" {
			if name == skip {
				if closing {
					depth--
				} else if !strings.HasSuffix(tag, "/") {
					depth++
				}
				if depth == 0 {
					skip = ""
				}
			}
			continue
		}
		if ignored[name] && !closing {
			flush()
			skip = name
			depth = 1
			if strings.HasSuffix(tag, "/") {
				skip = ""
			}
			continue
		}
		if boundaries[name] {
			flush()
		} else if name == "td" || name == "th" {
			buffer.WriteByte(' ')
		}
	}
	if skip != "" {
		return nil, errors.New("Unclosed ignored HTML region")
	}
	flush()
	if len(blocks) > 10000 {
		return nil, errors.New("Snapshot exceeds 10000 readable blocks")
	}
	return blocks, nil
}

func CanonicalURL(raw string) (string, error) {
	parsed, err := url.Parse(raw)
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Hostname() == "" || parsed.User != nil {
		return "", errors.New("Use an absolute HTTP(S) URL without credentials")
	}
	parsed.Fragment = ""
	parsed.Host = strings.ToLower(parsed.Host)
	if parsed.Path == "" {
		parsed.Path = "/"
	}
	return parsed.String(), nil
}

func NewSnapshot(rawURL, input string, ignores []string) (Snapshot, error) {
	canonical, err := CanonicalURL(rawURL)
	if err != nil {
		return Snapshot{}, err
	}
	blocks, err := ExtractBlocks(input, ignores)
	if err != nil {
		return Snapshot{}, err
	}
	sorted := append([]string{}, blocks...)
	sort.Strings(sorted)
	bytes, _ := json.Marshal(sorted)
	sum := sha256.Sum256(bytes)
	return Snapshot{URL: canonical, Blocks: blocks, Hash: hex.EncodeToString(sum[:])}, nil
}

func Compare(before, after Snapshot) (Brief, error) {
	if before.URL != after.URL {
		return Brief{}, errors.New("Snapshots must refer to the same canonical URL")
	}
	left, right := map[string]int{}, map[string]int{}
	for _, text := range before.Blocks {
		left[text]++
	}
	for _, text := range after.Blocks {
		right[text]++
	}
	keys := map[string]bool{}
	for key := range left {
		keys[key] = true
	}
	for key := range right {
		keys[key] = true
	}
	result := Brief{Before: before, After: after, Added: []Change{}, Removed: []Change{}}
	for key := range keys {
		common := left[key]
		if right[key] < common {
			common = right[key]
		}
		result.Unchanged += common
		if right[key] > left[key] {
			result.Added = append(result.Added, Change{key, right[key] - left[key]})
		}
		if left[key] > right[key] {
			result.Removed = append(result.Removed, Change{key, left[key] - right[key]})
		}
	}
	sort.Slice(result.Added, func(i, j int) bool { return result.Added[i].Text < result.Added[j].Text })
	sort.Slice(result.Removed, func(i, j int) bool { return result.Removed[i].Text < result.Removed[j].Text })
	return result, nil
}

func FetchHTML(ctx context.Context, rawURL string, client *http.Client) (string, error) {
	canonical, err := CanonicalURL(rawURL)
	if err != nil {
		return "", err
	}
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}
	bounded := *client
	bounded.CheckRedirect = func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return errors.New("At most three HTTP requests per fetch")
		}
		if _, err := CanonicalURL(req.URL.String()); err != nil {
			return err
		}
		if req.URL.Host != via[0].URL.Host {
			return errors.New("Cross-host redirect requires a new explicit URL")
		}
		if via[0].URL.Scheme == "https" && req.URL.Scheme != "https" {
			return errors.New("HTTPS fetch cannot redirect to HTTP")
		}
		return nil
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, canonical, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "web-change-brief/1.0")
	response, err := bounded.Do(req)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP status %d", response.StatusCode)
	}
	media := strings.ToLower(strings.Split(response.Header.Get("Content-Type"), ";")[0])
	if media != "text/html" && media != "application/xhtml+xml" {
		return "", errors.New("Expected HTML Content-Type")
	}
	data, err := io.ReadAll(io.LimitReader(response.Body, MaxHTMLBytes+1))
	if err != nil {
		return "", err
	}
	if len(data) > MaxHTMLBytes {
		return "", errors.New("HTML exceeds 2 MB")
	}
	return string(data), nil
}

func SaveSnapshot(path string, snapshot Snapshot) error {
	data, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return err
	}
	if err = os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	file, err := os.CreateTemp(filepath.Dir(path), ".snapshot-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if _, err = file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(name, path)
}

func LoadSnapshot(path string) (Snapshot, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Snapshot{}, err
	}
	if len(data) > 4*MaxHTMLBytes {
		return Snapshot{}, errors.New("Baseline too large")
	}
	var snapshot Snapshot
	if err = json.Unmarshal(data, &snapshot); err != nil {
		return snapshot, err
	}
	canonical, err := CanonicalURL(snapshot.URL)
	if err != nil || canonical != snapshot.URL {
		return Snapshot{}, errors.New("Baseline has invalid URL")
	}
	sorted := append([]string{}, snapshot.Blocks...)
	sort.Strings(sorted)
	bytes, _ := json.Marshal(sorted)
	sum := sha256.Sum256(bytes)
	if snapshot.Hash != hex.EncodeToString(sum[:]) {
		return Snapshot{}, errors.New("Baseline checksum mismatch")
	}
	return snapshot, nil
}

func ExportBrief(brief Brief, directory string) error {
	if err := os.MkdirAll(directory, 0755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(brief, "", "  ")
	if err != nil {
		return err
	}
	if err = os.WriteFile(filepath.Join(directory, "changes.json"), data, 0644); err != nil {
		return err
	}
	page := `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Web change brief</title><style>body{font:18px system-ui;max-width:850px;margin:3rem auto;padding:0 1rem}li{padding:.5rem;overflow-wrap:anywhere}.add{background:#e9f4ec}.remove{background:#fff0ec}code{overflow-wrap:anywhere}</style><h1>Web change brief</h1><p>Source: <a href="{{.After.URL}}">{{.After.URL}}</a></p><p>Exact readable text changes. Navigation, scripts, styles and footer blocks are excluded. Block order changes do not count as text changes.</p><h2>Added</h2><ul class="add">{{range .Added}}<li>{{.Text}} ({{.Count}} occurrence)</li>{{else}}<li>No added text.</li>{{end}}</ul><h2>Removed</h2><ul class="remove">{{range .Removed}}<li>{{.Text}} ({{.Count}} occurrence)</li>{{else}}<li>No removed text.</li>{{end}}</ul><p>Unchanged blocks: {{.Unchanged}}</p><p>Before: <code>{{.Before.Hash}}</code></p><p>After: <code>{{.After.Hash}}</code></p></html>`
	tmpl, err := template.New("brief").Parse(page)
	if err != nil {
		return err
	}
	file, err := os.Create(filepath.Join(directory, "index.html"))
	if err != nil {
		return err
	}
	defer file.Close()
	return tmpl.Execute(file, brief)
}

func run() error {
	beforePath := flag.String("before", "fixtures/before.html", "Saved HTML baseline")
	afterPath := flag.String("after", "fixtures/after.html", "Saved new HTML")
	rawURL := flag.String("url", "https://example.invalid/makerspace", "Source URL for saved files")
	fetchURL := flag.String("fetch", "", "Explicit live URL; requires --baseline with a previous saved snapshot")
	baseline := flag.String("baseline", "", "Existing JSON snapshot for fetch mode")
	out := flag.String("out", "web-change-output", "Report directory")
	accept := flag.Bool("accept", false, "Explicitly replace baseline after a successful fetch and report")
	ignore := flag.String("ignore", "", "Optional comma-separated phrases to omit (record your filter policy)")
	flag.Parse()
	ignores := []string{}
	if *ignore != "" {
		ignores = strings.Split(*ignore, ",")
	}
	var before, after Snapshot
	var err error
	if *fetchURL != "" {
		if *baseline == "" {
			return errors.New("Live fetch requires --baseline JSON; create one with the saved-file mode first")
		}
		before, err = LoadSnapshot(*baseline)
		if err != nil {
			return err
		}
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		input, fetchErr := FetchHTML(ctx, *fetchURL, nil)
		if fetchErr != nil {
			return fetchErr
		}
		after, err = NewSnapshot(*fetchURL, input, ignores)
		if err != nil {
			return err
		}
	} else {
		left, readErr := os.ReadFile(*beforePath)
		if readErr != nil {
			return readErr
		}
		right, readErr := os.ReadFile(*afterPath)
		if readErr != nil {
			return readErr
		}
		before, err = NewSnapshot(*rawURL, string(left), ignores)
		if err != nil {
			return err
		}
		after, err = NewSnapshot(*rawURL, string(right), ignores)
		if err != nil {
			return err
		}
	}
	brief, err := Compare(before, after)
	if err != nil {
		return err
	}
	if err = ExportBrief(brief, *out); err != nil {
		return err
	}
	if err = SaveSnapshot(filepath.Join(*out, "baseline.json"), after); err != nil {
		return err
	}
	if *accept && *baseline != "" {
		if err = SaveSnapshot(*baseline, after); err != nil {
			return err
		}
	}
	fmt.Printf("Readable blocks: %d before, %d after\n", len(before.Blocks), len(after.Blocks))
	for _, change := range brief.Removed {
		fmt.Printf("Removed (%d): %s\n", change.Count, change.Text)
	}
	for _, change := range brief.Added {
		fmt.Printf("Added (%d): %s\n", change.Count, change.Text)
	}
	fmt.Printf("Unchanged: %d | Report: %s\n", brief.Unchanged, filepath.Join(*out, "index.html"))
	return nil
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
