// Lesson: Building an MCP Server: Stateless Python and TypeScript (phase 13 / lesson 07)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/07-building-an-mcp-server/docs/en.md
// Run: go run code/main.go --demo

package main

import (
	"bufio"
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
)

const (
	protocolVersion = "2026-07-28"
	versionKey      = "io.modelcontextprotocol/protocolVersion"
	capabilitiesKey = "io.modelcontextprotocol/clientCapabilities"
	clientInfoKey   = "io.modelcontextprotocol/clientInfo"
	serverInfoKey   = "io.modelcontextprotocol/serverInfo"
)

type obj = map[string]any

var supportedVersions = []any{protocolVersion}

func clientInfo() obj { return obj{"name": "lesson-07-client", "version": "1.0.0"} }

func serverInfo() obj { return obj{"name": "notes-lesson-07", "version": "2.0.0"} }

func serverCapabilities() obj {
	return obj{
		"tools":     obj{"listChanged": false},
		"resources": obj{"listChanged": false, "subscribe": false},
		"prompts":   obj{"listChanged": false},
	}
}

type note struct{ title, body, tag string }

func baseNotes() map[string]note {
	return map[string]note{
		"note-1": {"MCP overview", "Stateless requests and JSON-RPC.", "mcp"},
		"note-2": {"Function calling", "Provider envelopes differ.", "api"},
		"note-3": {"Tool schemas", "Atomic tools are easier to route.", "design"},
	}
}

var notes = baseNotes()

func sortedNoteIDs() []string {
	ids := make([]string, 0, len(notes))
	for id := range notes {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

func tools() []any {
	return []any{
		obj{
			"name":        "notes_search",
			"description": "Search note titles and bodies by keyword.",
			"inputSchema": obj{
				"type": "object",
				"properties": obj{
					"query": obj{"type": "string"},
					"limit": obj{"type": "integer", "minimum": 1, "maximum": 50},
				},
				"required": []any{"query"},
			},
			"annotations": obj{"readOnlyHint": true, "idempotentHint": true},
		},
		obj{
			"name":        "notes_create",
			"description": "Create a new note.",
			"inputSchema": obj{
				"type": "object",
				"properties": obj{
					"title": obj{"type": "string"},
					"body":  obj{"type": "string"},
					"tag":   obj{"type": "string"},
				},
				"required": []any{"title", "body"},
			},
			"annotations": obj{"destructiveHint": false, "idempotentHint": false},
		},
		obj{
			"name":        "notes_list",
			"description": "List notes, optionally filtered by tag.",
			"inputSchema": obj{
				"type":       "object",
				"properties": obj{"tag": obj{"type": "string"}},
				"required":   []any{},
			},
			"annotations": obj{"readOnlyHint": true, "idempotentHint": true},
		},
	}
}

func prompts() []any {
	return []any{
		obj{
			"name":        "review_note",
			"description": "Critique a note and propose concrete improvements.",
			"arguments": []any{
				obj{"name": "note_id", "description": "Note identifier", "required": true},
			},
		},
	}
}

type rpcProblem struct {
	code    int
	message string
	data    any
}

func (p *rpcProblem) Error() string { return p.message }

func problem(code int, message string) *rpcProblem {
	return &rpcProblem{code: code, message: message}
}

func requestMeta(version string) obj {
	return obj{versionKey: version, capabilitiesKey: obj{}, clientInfoKey: clientInfo()}
}

func makeRequest(requestID any, method string, params obj, version string) obj {
	bodyParams := obj{}
	for k, v := range params {
		bodyParams[k] = v
	}
	bodyParams["_meta"] = requestMeta(version)
	return obj{"jsonrpc": "2.0", "id": requestID, "method": method, "params": bodyParams}
}

func rpcError(requestID any, code int, message string, data any) obj {
	e := obj{"code": code, "message": message}
	if data != nil {
		e["data"] = data
	}
	return obj{"jsonrpc": "2.0", "id": requestID, "error": e}
}

func complete(payload obj, ttlMS int, cacheScope string) obj {
	result := obj{"resultType": "complete"}
	for k, v := range payload {
		result[k] = v
	}
	result["_meta"] = obj{serverInfoKey: serverInfo()}
	if ttlMS >= 0 {
		result["ttlMs"] = ttlMS
		result["cacheScope"] = cacheScope
	}
	return result
}

func asInt(v any) (int, bool) {
	switch n := v.(type) {
	case int:
		return n, true
	case json.Number:
		i, err := strconv.Atoi(string(n))
		return i, err == nil
	}
	return 0, false
}

func validID(v any) bool {
	if _, ok := v.(string); ok {
		return true
	}
	_, ok := asInt(v)
	return ok
}

func validateRequest(message obj) error {
	if _, ok := message["method"].(string); !ok || message["jsonrpc"] != "2.0" {
		return problem(-32600, "Invalid Request")
	}
	if id, present := message["id"]; present && !validID(id) {
		return problem(-32600, "id must be a string or integer")
	}
	params, ok := message["params"].(obj)
	if !ok {
		return problem(-32602, "params must be an object")
	}
	meta, ok := params["_meta"].(obj)
	if !ok {
		return problem(-32602, "params._meta is required")
	}
	requested, ok := meta[versionKey].(string)
	if !ok {
		return problem(-32602, versionKey+" is required")
	}
	if requested != protocolVersion {
		return &rpcProblem{
			code:    -32022,
			message: "Unsupported protocol version",
			data:    obj{"requested": requested, "supported": append([]any(nil), supportedVersions...)},
		}
	}
	if _, ok := meta[capabilitiesKey].(obj); !ok {
		return problem(-32602, capabilitiesKey+" is required")
	}
	if info, present := meta[clientInfoKey]; present && info != nil {
		m, ok := info.(obj)
		_, nameOK := m["name"].(string)
		_, versionOK := m["version"].(string)
		if !ok || !nameOK || !versionOK {
			return problem(-32602, clientInfoKey+" is malformed")
		}
	}
	return nil
}

func execNotesList(arguments obj) ([]any, error) {
	tagVal := arguments["tag"]
	tag, isStr := tagVal.(string)
	all := tagVal == nil || (isStr && tag == "") || tagVal == false || tagVal == float64(0)
	items := []any{}
	for _, id := range sortedNoteIDs() {
		n := notes[id]
		if all || (isStr && n.tag == tag) {
			items = append(items, obj{"id": id, "title": n.title, "tag": n.tag})
		}
	}
	return []any{obj{"type": "text", "text": pyDumps(items, -1)}}, nil
}

func execNotesSearch(arguments obj) ([]any, error) {
	query, ok := arguments["query"].(string)
	if !ok || query == "" {
		return nil, errors.New("query must be a non-empty string")
	}
	limit := 10
	if raw, present := arguments["limit"]; present {
		n, ok := asInt(raw)
		if !ok || n < 1 || n > 50 {
			return nil, errors.New("limit must be an integer from 1 through 50")
		}
		limit = n
	}
	needle := strings.ToLower(query)
	hits := []any{}
	for _, id := range sortedNoteIDs() {
		n := notes[id]
		if strings.Contains(strings.ToLower(n.title), needle) || strings.Contains(strings.ToLower(n.body), needle) {
			hits = append(hits, obj{"id": id, "title": n.title})
		}
	}
	if len(hits) > limit {
		hits = hits[:limit]
	}
	return []any{obj{"type": "text", "text": pyDumps(hits, -1)}}, nil
}

func execNotesCreate(arguments obj) ([]any, error) {
	title, titleOK := arguments["title"].(string)
	body, bodyOK := arguments["body"].(string)
	if !titleOK || !bodyOK {
		return nil, errors.New("title and body must be strings")
	}
	b := make([]byte, 3)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	noteID := "note-" + hex.EncodeToString(b)
	tag := ""
	if raw, present := arguments["tag"]; present {
		tag = pyStr(raw)
	}
	notes[noteID] = note{title, body, tag}
	return []any{
		obj{"type": "text", "text": "Created " + noteID},
		obj{"type": "resource", "resource": obj{"uri": "notes://" + noteID, "text": body}},
	}, nil
}

var toolExecutors = map[string]func(obj) ([]any, error){
	"notes_create": execNotesCreate,
	"notes_list":   execNotesList,
	"notes_search": execNotesSearch,
}

func byName(items []any) []any {
	out := append([]any(nil), items...)
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].(obj)["name"].(string) < out[j].(obj)["name"].(string)
	})
	return out
}

func handleDiscover(obj) (obj, error) {
	return complete(obj{
		"supportedVersions": append([]any(nil), supportedVersions...),
		"capabilities":      serverCapabilities(),
		"instructions":      "Use tools for note actions, resources for note bodies, and prompts for reviews.",
	}, 3_600_000, "public"), nil
}

func handleToolsList(obj) (obj, error) {
	return complete(obj{"tools": byName(tools())}, 60_000, "public"), nil
}

func handleToolsCall(params obj) (obj, error) {
	name, nameOK := params["name"].(string)
	arguments := obj{}
	if raw, present := params["arguments"]; present {
		m, ok := raw.(obj)
		if !ok {
			nameOK = false
		}
		arguments = m
	}
	if !nameOK {
		return nil, problem(-32602, "tools/call requires string name and object arguments")
	}
	executor, ok := toolExecutors[name]
	if !ok {
		return complete(obj{"content": []any{obj{"type": "text", "text": "Unknown tool: " + name}}, "isError": true}, -1, "private"), nil
	}
	content, err := executor(arguments)
	if err != nil {
		return complete(obj{"content": []any{obj{"type": "text", "text": err.Error()}}, "isError": true}, -1, "private"), nil
	}
	return complete(obj{"content": content, "isError": false}, -1, "private"), nil
}

func handleResourcesList(obj) (obj, error) {
	resources := []any{}
	for _, id := range sortedNoteIDs() {
		resources = append(resources, obj{"uri": "notes://" + id, "name": notes[id].title, "mimeType": "text/markdown"})
	}
	return complete(obj{"resources": resources}, 10_000, "private"), nil
}

func handleResourcesRead(params obj) (obj, error) {
	uri, ok := params["uri"].(string)
	if !ok || !strings.HasPrefix(uri, "notes://") {
		return nil, problem(-32602, "resources/read requires a notes:// URI")
	}
	n, ok := notes[strings.TrimPrefix(uri, "notes://")]
	if !ok {
		return nil, &rpcProblem{code: -32602, message: "Resource not found", data: obj{"uri": uri}}
	}
	text := fmt.Sprintf("# %s\n\n%s\n\ntag: %s", n.title, n.body, n.tag)
	return complete(obj{"contents": []any{obj{"uri": uri, "mimeType": "text/markdown", "text": text}}}, 5_000, "private"), nil
}

func handlePromptsList(obj) (obj, error) {
	return complete(obj{"prompts": byName(prompts())}, 60_000, "public"), nil
}

func handlePromptsGet(params obj) (obj, error) {
	if params["name"] != "review_note" {
		return nil, problem(-32602, "Unknown prompt")
	}
	arguments := obj{}
	if raw, present := params["arguments"]; present {
		m, ok := raw.(obj)
		if !ok {
			return nil, problem(-32602, "prompt arguments must be an object")
		}
		arguments = m
	}
	noteID, ok := arguments["note_id"].(string)
	n, exists := notes[noteID]
	if !ok || !exists {
		return nil, problem(-32602, "note_id must name an existing note")
	}
	return complete(obj{
		"description": "Review the note and propose concrete improvements.",
		"messages": []any{obj{
			"role":    "user",
			"content": obj{"type": "text", "text": "Review this note and propose improvements:\n\n" + n.body},
		}},
	}, -1, "private"), nil
}

var handlers = map[string]func(obj) (obj, error){
	"prompts/get":     handlePromptsGet,
	"prompts/list":    handlePromptsList,
	"resources/list":  handleResourcesList,
	"resources/read":  handleResourcesRead,
	"server/discover": handleDiscover,
	"tools/call":      handleToolsCall,
	"tools/list":      handleToolsList,
}

func dispatch(message obj) obj {
	requestID, present := message["id"]
	if !present {
		return nil
	}
	var errorID any
	if validID(requestID) {
		errorID = requestID
	}
	result, err := func() (res obj, err error) {
		defer func() {
			if r := recover(); r != nil {
				err = fmt.Errorf("%v", r)
			}
		}()
		if err := validateRequest(message); err != nil {
			return nil, err
		}
		method := message["method"].(string)
		handler, ok := handlers[method]
		if !ok {
			return nil, problem(-32601, "Method not found: "+method)
		}
		return handler(message["params"].(obj))
	}()
	if err != nil {
		var p *rpcProblem
		if errors.As(err, &p) {
			return rpcError(errorID, p.code, p.message, p.data)
		}
		return rpcError(errorID, -32603, "Internal error", obj{"detail": err.Error()})
	}
	return obj{"jsonrpc": "2.0", "id": requestID, "result": result}
}

func pyStr(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case bool:
		if x {
			return "True"
		}
		return "False"
	case nil:
		return "None"
	}
	return pyDumps(v, -1)
}

func pyQuote(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch r {
		case '"':
			b.WriteString(`\"`)
		case '\\':
			b.WriteString(`\\`)
		case '\n':
			b.WriteString(`\n`)
		case '\r':
			b.WriteString(`\r`)
		case '\t':
			b.WriteString(`\t`)
		case '\b':
			b.WriteString(`\b`)
		case '\f':
			b.WriteString(`\f`)
		default:
			switch {
			case r < 0x20 || (r > 0x7e && r < 0x10000):
				fmt.Fprintf(&b, `\u%04x`, r)
			case r >= 0x10000:
				hi, lo := utf16.EncodeRune(r)
				fmt.Fprintf(&b, `\u%04x\u%04x`, hi, lo)
			default:
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func pyDumps(v any, indent int) string {
	var b strings.Builder
	writeJSON(&b, v, indent, 0, ", ", ": ")
	return b.String()
}

func compactDumps(v any) string {
	var b strings.Builder
	writeJSON(&b, v, -1, 0, ",", ":")
	return b.String()
}

func writeJSON(b *strings.Builder, v any, indent, depth int, itemSep, keySep string) {
	newline := func(d int) {
		b.WriteByte('\n')
		b.WriteString(strings.Repeat(" ", indent*d))
	}
	sep := itemSep
	if indent >= 0 {
		sep = ","
	}
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		b.WriteString(strconv.FormatBool(x))
	case int:
		b.WriteString(strconv.Itoa(x))
	case json.Number:
		b.WriteString(string(x))
	case float64:
		if x == math.Trunc(x) && math.Abs(x) < 1e16 {
			b.WriteString(strconv.FormatFloat(x, 'f', 1, 64))
		} else {
			b.WriteString(strconv.FormatFloat(x, 'g', -1, 64))
		}
	case string:
		b.WriteString(pyQuote(x))
	case []any:
		if len(x) == 0 {
			b.WriteString("[]")
			return
		}
		b.WriteByte('[')
		for i, item := range x {
			if i > 0 {
				b.WriteString(sep)
			}
			if indent >= 0 {
				newline(depth + 1)
			}
			writeJSON(b, item, indent, depth+1, itemSep, keySep)
		}
		if indent >= 0 {
			newline(depth)
		}
		b.WriteByte(']')
	case obj:
		if len(x) == 0 {
			b.WriteString("{}")
			return
		}
		keys := make([]string, 0, len(x))
		for k := range x {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteString(sep)
			}
			if indent >= 0 {
				newline(depth + 1)
			}
			b.WriteString(pyQuote(k))
			b.WriteString(keySep)
			writeJSON(b, x[k], indent, depth+1, itemSep, keySep)
		}
		if indent >= 0 {
			newline(depth)
		}
		b.WriteByte('}')
	default:
		panic(fmt.Sprintf("unsupported JSON value %T", v))
	}
}

func serveStdio() {
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 64*1024), 16*1024*1024)
	out := bufio.NewWriter(os.Stdout)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var parsed any
		dec := json.NewDecoder(bytes.NewReader([]byte(line)))
		dec.UseNumber()
		err := dec.Decode(&parsed)
		if err == nil && dec.More() {
			err = errors.New("Extra data")
		}
		var response obj
		if err != nil {
			response = rpcError(nil, -32700, "Parse error", obj{"detail": err.Error()})
		} else if message, ok := parsed.(obj); ok {
			response = dispatch(message)
		} else {
			response = rpcError(nil, -32600, "Invalid Request", nil)
		}
		if response != nil {
			fmt.Fprintln(out, compactDumps(response))
			if err := out.Flush(); err != nil {
				panic(err)
			}
		}
	}
	if err := scanner.Err(); err != nil {
		panic(err)
	}
}

func demo() {
	scenarios := []obj{
		makeRequest(1, "server/discover", nil, protocolVersion),
		makeRequest(2, "tools/list", nil, protocolVersion),
		makeRequest(3, "resources/list", nil, protocolVersion),
		makeRequest(4, "prompts/list", nil, protocolVersion),
		makeRequest(5, "tools/call", obj{"name": "notes_search", "arguments": obj{"query": "MCP"}}, protocolVersion),
		makeRequest(6, "resources/read", obj{"uri": "notes://note-1"}, protocolVersion),
		makeRequest(7, "prompts/get", obj{"name": "review_note", "arguments": obj{"note_id": "note-1"}}, protocolVersion),
		makeRequest(8, "tools/list", nil, "2027-01-01"),
	}
	fmt.Println("MCP 2026-07-28 stateless notes server")
	for _, message := range scenarios {
		response := dispatch(message)
		fmt.Printf("\n%s id=%v\n", message["method"], message["id"])
		text := []rune(pyDumps(response, 2))
		if len(text) > 700 {
			text = text[:700]
		}
		fmt.Println(string(text))
	}
}

func main() {
	for _, a := range os.Args[1:] {
		if a == "--demo" {
			demo()
			return
		}
	}
	serveStdio()
}
