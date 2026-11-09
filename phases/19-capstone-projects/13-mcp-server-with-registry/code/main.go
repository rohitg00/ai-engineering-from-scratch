// Lesson: Stateless MCP Server with Registry and Governance (phase 19 / lesson 13)
// Go port of code/main.py. Go standard library only.
// Source: phases/19-capstone-projects/13-mcp-server-with-registry/docs/en.md
// Run: go run code/main.go

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	protocolVersion = "2026-07-28"
	registrySchema  = "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json"
	publisherDomain = "example.com"
)

var (
	serverNameRe   = regexp.MustCompile(`^[a-zA-Z0-9.-]+/[a-zA-Z0-9._-]+$`)
	domainLabelRe  = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)
	remoteURLRe    = regexp.MustCompile(`^https?://\S+$`)
	versionRangeRe = regexp.MustCompile(`(?i)(?:^[~^<>=]|[*]|(?:^|\.)x(?:$|\.))`)
	emailRe        = regexp.MustCompile(`[\p{L}\p{N}_.+-]+@[\p{L}\p{N}_-]+\.[\p{L}\p{N}_.-]+`)
	ssnRe          = regexp.MustCompile(`\b\d{3}-\d{2}-\d{4}\b`)
)

type kv struct {
	k string
	v any
}

type obj []kv

func (o obj) get(key string) (any, bool) {
	for _, item := range o {
		if item.k == key {
			return item.v, true
		}
	}
	return nil, false
}

func (o obj) has(key string) bool {
	_, ok := o.get(key)
	return ok
}

func pyFloatRepr(x float64) string {
	if math.IsNaN(x) {
		return "NaN"
	}
	if math.IsInf(x, 1) {
		return "Infinity"
	}
	if math.IsInf(x, -1) {
		return "-Infinity"
	}
	if x == math.Trunc(x) && math.Abs(x) < 1e16 {
		return strconv.FormatFloat(x, 'f', 1, 64)
	}
	exp := math.Floor(math.Log10(math.Abs(x)))
	if exp < -4 || exp >= 16 {
		s := strconv.FormatFloat(x, 'e', -1, 64)
		mant, e, _ := strings.Cut(s, "e")
		sign := e[0]
		digits := strings.TrimLeft(e[1:], "0")
		if len(digits) < 2 {
			digits = strings.Repeat("0", 2-len(digits)) + digits
		}
		return mant + "e" + string(sign) + digits
	}
	return strconv.FormatFloat(x, 'f', -1, 64)
}

func jsonString(s string, ensureASCII bool) string {
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
			case r < 0x20:
				fmt.Fprintf(&b, `\u%04x`, r)
			case ensureASCII && r > 0x7e && r > 0xffff:
				r1, r2 := utf16Pair(r)
				fmt.Fprintf(&b, `\u%04x\u%04x`, r1, r2)
			case ensureASCII && r > 0x7e:
				fmt.Fprintf(&b, `\u%04x`, r)
			default:
				b.WriteRune(r)
			}
		}
	}
	b.WriteByte('"')
	return b.String()
}

func utf16Pair(r rune) (rune, rune) {
	r -= 0x10000
	return 0xd800 + (r>>10)&0x3ff, 0xdc00 + r&0x3ff
}

type dumpOpts struct {
	indent      int
	sortKeys    bool
	ensureASCII bool
	compact     bool
}

func dumps(v any, o dumpOpts) string {
	return dumpValue(v, o, 0)
}

func dumpValue(v any, o dumpOpts, level int) string {
	itemSep, keySep := ", ", ": "
	if o.compact {
		itemSep, keySep = ",", ":"
	}
	switch t := v.(type) {
	case nil:
		return "null"
	case bool:
		if t {
			return "true"
		}
		return "false"
	case int:
		return strconv.Itoa(t)
	case float64:
		return pyFloatRepr(t)
	case string:
		return jsonString(t, o.ensureASCII)
	case []any:
		if len(t) == 0 {
			return "[]"
		}
		items := make([]string, len(t))
		for i, x := range t {
			items[i] = dumpValue(x, o, level+1)
		}
		return wrap("[", "]", items, o, level, itemSep)
	case obj:
		if len(t) == 0 {
			return "{}"
		}
		entries := append(obj(nil), t...)
		if o.sortKeys {
			sort.SliceStable(entries, func(i, j int) bool { return entries[i].k < entries[j].k })
		}
		items := make([]string, len(entries))
		for i, e := range entries {
			items[i] = jsonString(e.k, o.ensureASCII) + keySep + dumpValue(e.v, o, level+1)
		}
		return wrap("{", "}", items, o, level, itemSep)
	}
	panic(fmt.Sprintf("unsupported value %T", v))
}

func wrap(open, close string, items []string, o dumpOpts, level int, itemSep string) string {
	if o.indent < 0 {
		return open + strings.Join(items, itemSep) + close
	}
	pad := "\n" + strings.Repeat(" ", o.indent*(level+1))
	return open + pad + strings.Join(items, ","+pad) + "\n" + strings.Repeat(" ", o.indent*level) + close
}

func pyDumps(v any) string {
	return dumps(v, dumpOpts{indent: -1, ensureASCII: true})
}

func pyDumpsIndent(v any) string {
	return dumps(v, dumpOpts{indent: 2, ensureASCII: true})
}

func pyStrRepr(s string) string {
	quote := "'"
	if strings.Contains(s, "'") && !strings.Contains(s, `"`) {
		quote = `"`
	}
	var b strings.Builder
	b.WriteString(quote)
	for _, r := range s {
		switch {
		case r == '\\':
			b.WriteString(`\\`)
		case string(r) == quote:
			b.WriteString(`\` + quote)
		case r == '\n':
			b.WriteString(`\n`)
		case r == '\r':
			b.WriteString(`\r`)
		case r == '\t':
			b.WriteString(`\t`)
		case r < 0x20 || r == 0x7f:
			fmt.Fprintf(&b, `\x%02x`, r)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteString(quote)
	return b.String()
}

func pyRepr(v any) string {
	switch t := v.(type) {
	case nil:
		return "None"
	case bool:
		if t {
			return "True"
		}
		return "False"
	case int:
		return strconv.Itoa(t)
	case float64:
		r := pyFloatRepr(t)
		switch r {
		case "NaN":
			return "nan"
		case "Infinity":
			return "inf"
		case "-Infinity":
			return "-inf"
		}
		return r
	case string:
		return pyStrRepr(t)
	case []any:
		items := make([]string, len(t))
		for i, x := range t {
			items[i] = pyRepr(x)
		}
		return "[" + strings.Join(items, ", ") + "]"
	case obj:
		items := make([]string, len(t))
		for i, e := range t {
			items[i] = pyStrRepr(e.k) + ": " + pyRepr(e.v)
		}
		return "{" + strings.Join(items, ", ") + "}"
	}
	panic(fmt.Sprintf("unsupported value %T", v))
}

func parseJSON(text string) (any, error) {
	dec := json.NewDecoder(strings.NewReader(text))
	dec.UseNumber()
	v, err := parseValue(dec)
	if err != nil {
		return nil, err
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return nil, errors.New("trailing data")
	}
	return v, nil
}

func parseValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, err
	}
	switch t := tok.(type) {
	case json.Delim:
		if t == '[' {
			out := []any{}
			for dec.More() {
				v, err := parseValue(dec)
				if err != nil {
					return nil, err
				}
				out = append(out, v)
			}
			_, err := dec.Token()
			return out, err
		}
		out := obj{}
		for dec.More() {
			keyTok, err := dec.Token()
			if err != nil {
				return nil, err
			}
			v, err := parseValue(dec)
			if err != nil {
				return nil, err
			}
			out = append(out, kv{keyTok.(string), v})
		}
		_, err := dec.Token()
		return out, err
	case json.Number:
		if i, err := strconv.Atoi(t.String()); err == nil {
			return i, nil
		}
		f, err := t.Float64()
		return f, err
	default:
		return t, nil
	}
}

func requestMeta() obj {
	return obj{
		{"io.modelcontextprotocol/protocolVersion", protocolVersion},
		{"io.modelcontextprotocol/clientCapabilities", obj{}},
		{"io.modelcontextprotocol/clientInfo", obj{{"name", "registry-capstone-client"}, {"version", "1.0.0"}}},
	}
}

func errorResult(code int, message string, data obj) obj {
	detail := obj{{"code", code}, {"message", message}}
	if data != nil {
		detail = append(detail, kv{"data", data})
	}
	return obj{{"error", detail}}
}

func validateMeta(meta any) obj {
	m, ok := meta.(obj)
	if !ok {
		return errorResult(-32602, "params._meta must be an object", nil)
	}
	requested, ok := m.get("io.modelcontextprotocol/protocolVersion")
	reqStr, isStr := requested.(string)
	if !ok || !isStr {
		return errorResult(-32602, "protocolVersion must be a string", nil)
	}
	if reqStr != protocolVersion {
		return errorResult(-32022, "Unsupported protocol version", obj{{"supported", []any{protocolVersion}}, {"requested", reqStr}})
	}
	caps, _ := m.get("io.modelcontextprotocol/clientCapabilities")
	if _, ok := caps.(obj); !ok {
		return errorResult(-32602, "clientCapabilities must be an object", nil)
	}
	return nil
}

type ToolSchema struct {
	Name          string
	RequiredScope string
	Destructive   bool
	Description   string
	InputSchema   obj
}

type Handler func(args obj) (obj, error)

type MCPServer struct {
	Name          string
	Title         string
	Description   string
	Version       string
	URL           string
	TrustedIssuer string
	Tools         map[string]ToolSchema
	Handlers      map[string]Handler
}

func newServer(name, title, description, version, url, issuer string) *MCPServer {
	return &MCPServer{
		Name: name, Title: title, Description: description, Version: version, URL: url, TrustedIssuer: issuer,
		Tools: map[string]ToolSchema{}, Handlers: map[string]Handler{},
	}
}

func (s *MCPServer) serverInfo() obj {
	return obj{{"name", s.Name}, {"version", s.Version}}
}

func (s *MCPServer) Register(schema ToolSchema, handler Handler) error {
	if _, ok := s.Tools[schema.Name]; ok {
		return fmt.Errorf("duplicate tool: %s", schema.Name)
	}
	s.Tools[schema.Name] = schema
	s.Handlers[schema.Name] = handler
	return nil
}

func (s *MCPServer) result(fields ...kv) obj {
	out := obj{{"resultType", "complete"}}
	out = append(out, fields...)
	return append(out, kv{"_meta", obj{{"io.modelcontextprotocol/serverInfo", s.serverInfo()}}})
}

func (s *MCPServer) Discover(meta obj) obj {
	if invalid := validateMeta(meta); invalid != nil {
		return invalid
	}
	return s.result(
		kv{"supportedVersions", []any{protocolVersion}},
		kv{"capabilities", obj{{"tools", obj{{"listChanged", false}}}}},
		kv{"ttlMs", 3_600_000},
		kv{"cacheScope", "public"},
	)
}

func (s *MCPServer) ToolsList(meta obj) obj {
	if invalid := validateMeta(meta); invalid != nil {
		return invalid
	}
	names := make([]string, 0, len(s.Tools))
	for name := range s.Tools {
		names = append(names, name)
	}
	sort.Strings(names)
	tools := []any{}
	for _, name := range names {
		tool := s.Tools[name]
		tools = append(tools, obj{
			{"name", tool.Name},
			{"description", tool.Description},
			{"inputSchema", tool.InputSchema},
			{"annotations", obj{{"readOnlyHint", !tool.Destructive}, {"destructiveHint", tool.Destructive}}},
		})
	}
	return s.result(kv{"tools", tools}, kv{"ttlMs", 60_000}, kv{"cacheScope", "private"})
}

func (s *MCPServer) RegistryDocument() obj {
	return obj{
		{"$schema", registrySchema},
		{"name", s.Name},
		{"title", s.Title},
		{"description", s.Description},
		{"version", s.Version},
		{"remotes", []any{obj{{"type", "streamable-http"}, {"url", s.URL}}}},
	}
}

type Token struct {
	User      string
	Issuer    string
	Audience  string
	Scopes    map[string]bool
	ExpiresAt float64
}

func (t Token) HasScope(scope string) bool {
	return t.Scopes[scope]
}

func (t Token) IsExpired(now float64) bool {
	return now >= t.ExpiresAt
}

func argumentsDigest(args obj) string {
	normalized := dumps(args, dumpOpts{indent: -1, sortKeys: true, compact: true})
	sum := sha256.Sum256([]byte(normalized))
	return hex.EncodeToString(sum[:])
}

type ApprovalRecord struct {
	Actor           string
	Tool            string
	ArgumentsDigest string
	Target          string
	ExpiresAt       float64
}

func approvalForAction(actor, tool string, args obj, target string, expiresAt float64) ApprovalRecord {
	return ApprovalRecord{actor, tool, argumentsDigest(args), target, expiresAt}
}

func (a ApprovalRecord) Authorize(actor, tool string, args obj, target string, now float64) (bool, string) {
	if a.Actor != actor {
		return false, "approval actor does not match token subject"
	}
	if a.Tool != tool {
		return false, "approval tool does not match requested tool"
	}
	if a.Target != target {
		return false, "approval target does not match this server"
	}
	if a.ArgumentsDigest != argumentsDigest(args) {
		return false, "approval arguments do not match requested action"
	}
	if now >= a.ExpiresAt {
		return false, "approval has expired"
	}
	return true, "ok"
}

func policyDecide(server *MCPServer, tool string, token Token, args obj, now float64, approval *ApprovalRecord) (bool, string) {
	if token.Issuer != server.TrustedIssuer {
		return false, "token issuer is not trusted by this server"
	}
	if token.Audience != server.URL {
		return false, "token audience does not match this server"
	}
	if token.IsExpired(now) {
		return false, "token has expired"
	}
	schema, ok := server.Tools[tool]
	if !ok {
		return false, "no such tool: " + tool
	}
	if !token.HasScope(schema.RequiredScope) {
		return false, "missing scope: " + schema.RequiredScope
	}
	if utf8.RuneCountInString(pyDumps(args)) > 8192 {
		return false, "payload too large"
	}
	if schema.Destructive {
		if approval == nil {
			return false, "destructive tool requires an action-bound approval"
		}
		if approved, reason := approval.Authorize(token.User, tool, args, server.URL, now); !approved {
			return false, reason
		}
	}
	return true, "ok"
}

func redact(payload obj) obj {
	text := pyDumps(payload)
	text = emailRe.ReplaceAllString(text, "[email]")
	text = ssnRe.ReplaceAllString(text, "[ssn]")
	v, err := parseJSON(text)
	if err != nil {
		panic(err)
	}
	return v.(obj)
}

type AuditEntry struct {
	Ts               float64
	User             string
	Issuer           string
	Tool             string
	Outcome          string
	ArgsRedacted     obj
	ResponseRedacted obj
}

func (e AuditEntry) asDict() obj {
	return obj{
		{"ts", e.Ts},
		{"user", e.User},
		{"issuer", e.Issuer},
		{"tool", e.Tool},
		{"outcome", e.Outcome},
		{"args_redacted", e.ArgsRedacted},
		{"response_redacted", e.ResponseRedacted},
	}
}

func nowSeconds() float64 {
	return float64(time.Now().UnixNano()) / 1e9
}

func dispatch(server *MCPServer, token Token, tool string, args obj, meta obj, audit *[]AuditEntry, approval *ApprovalRecord) obj {
	if invalid := validateMeta(meta); invalid != nil {
		return invalid
	}
	now := nowSeconds()
	allowed, reason := policyDecide(server, tool, token, args, now, approval)
	if !allowed {
		*audit = append(*audit, AuditEntry{now, token.User, token.Issuer, tool, "denied:" + reason, redact(args), obj{}})
		return errorResult(-32000, reason, nil)
	}
	response, err := server.Handlers[tool](args)
	if err != nil {
		*audit = append(*audit, AuditEntry{now, token.User, token.Issuer, tool, "handler_error", redact(args), obj{}})
		return server.result(kv{"content", []any{obj{{"type", "text"}, {"text", err.Error()}}}}, kv{"isError", true})
	}
	*audit = append(*audit, AuditEntry{now, token.User, token.Issuer, tool, "allowed", redact(args), redact(response)})
	return server.result(
		kv{"content", []any{obj{{"type", "text"}, {"text", pyDumps(response)}}}},
		kv{"structuredContent", response},
		kv{"isError", false},
	)
}

func strLenBetween(v any, lo, hi int) bool {
	s, ok := v.(string)
	if !ok {
		return false
	}
	n := utf8.RuneCountInString(s)
	return n >= lo && n <= hi
}

func validateRegistryDocument(document any) []string {
	doc, ok := document.(obj)
	if !ok {
		return []string{"server.json must be an object"}
	}
	issues := []string{}
	for _, key := range []string{"name", "description", "version"} {
		if !doc.has(key) {
			issues = append(issues, "missing "+key)
		}
	}
	if schemaURI, ok := doc.get("$schema"); ok && schemaURI != registrySchema {
		issues = append(issues, "unsupported registry schema")
	}
	if name, ok := doc.get("name"); ok {
		s, _ := name.(string)
		if !strLenBetween(name, 3, 200) || !serverNameRe.MatchString(s) {
			issues = append(issues, "name must match namespace/server and be 3-200 characters")
		}
	}
	if description, ok := doc.get("description"); ok && !strLenBetween(description, 1, 100) {
		issues = append(issues, "description must be a 1-100 character string")
	}
	if title, ok := doc.get("title"); ok && !strLenBetween(title, 1, 100) {
		issues = append(issues, "title must be a 1-100 character string")
	}
	if version, ok := doc.get("version"); ok {
		s, _ := version.(string)
		if !strLenBetween(version, 1, 255) || versionRangeRe.MatchString(s) || strings.EqualFold(s, "latest") {
			issues = append(issues, "version must be one concrete 1-255 character version")
		}
	}
	remotesVal, _ := doc.get("remotes")
	remotes, ok := remotesVal.([]any)
	if !ok || len(remotes) == 0 {
		issues = append(issues, "remote profile requires a non-empty remotes list")
		return issues
	}
	for index, remoteVal := range remotes {
		remote, ok := remoteVal.(obj)
		if !ok {
			issues = append(issues, fmt.Sprintf("remotes[%d] must be an object", index))
			continue
		}
		if typ, _ := remote.get("type"); typ != "streamable-http" && typ != "sse" {
			issues = append(issues, fmt.Sprintf("remotes[%d].type must be streamable-http or sse", index))
		}
		remoteURL, _ := remote.get("url")
		if s, ok := remoteURL.(string); !ok || !remoteURLRe.MatchString(s) {
			issues = append(issues, fmt.Sprintf("remotes[%d].url must be an http(s) URL template", index))
		}
	}
	return issues
}

func reverseDNSNamespace(domain string) (string, error) {
	normalized := strings.TrimRight(strings.ToLower(domain), ".")
	labels := strings.Split(normalized, ".")
	if len(labels) < 2 {
		return "", errors.New("publisher domain must be a valid multi-label DNS name")
	}
	for _, label := range labels {
		if !domainLabelRe.MatchString(label) {
			return "", errors.New("publisher domain must be a valid multi-label DNS name")
		}
	}
	for i, j := 0, len(labels)-1; i < j; i, j = i+1, j-1 {
		labels[i], labels[j] = labels[j], labels[i]
	}
	return strings.Join(labels, "."), nil
}

func validatePublisherNamespace(document any, verifiedDomain string) ([]string, error) {
	doc, ok := document.(obj)
	if !ok {
		return nil, nil
	}
	nameVal, _ := doc.get("name")
	name, ok := nameVal.(string)
	if !ok {
		return nil, nil
	}
	namespace, _, _ := strings.Cut(name, "/")
	expected, err := reverseDNSNamespace(verifiedDomain)
	if err != nil {
		return nil, err
	}
	if namespace != expected && !strings.HasPrefix(namespace, expected+".") {
		return []string{fmt.Sprintf("name namespace must be %s or its child for verified domain %s", expected, verifiedDomain)}, nil
	}
	return nil, nil
}

func validateRuntimeAlignment(document obj, discovery any) []string {
	disc, ok := discovery.(obj)
	if !ok {
		return []string{"server/discover result must be an object"}
	}
	metaVal, _ := disc.get("_meta")
	var serverInfo obj
	if meta, ok := metaVal.(obj); ok {
		si, _ := meta.get("io.modelcontextprotocol/serverInfo")
		serverInfo, _ = si.(obj)
	}
	if serverInfo == nil {
		return []string{"server/discover must include serverInfo for registry drift checks"}
	}
	issues := []string{}
	siName, _ := serverInfo.get("name")
	docName, _ := document.get("name")
	if siName != docName {
		issues = append(issues, "runtime serverInfo.name does not match server.json name")
	}
	siVersion, _ := serverInfo.get("version")
	docVersion, _ := document.get("version")
	if siVersion != docVersion {
		issues = append(issues, "runtime serverInfo.version does not match server.json version")
	}
	return issues
}

type Registry struct {
	PublisherDomain  string
	Entries          map[string]obj
	RuntimeDiscovery map[string]obj
}

func newRegistry() *Registry {
	return &Registry{PublisherDomain: publisherDomain, Entries: map[string]obj{}, RuntimeDiscovery: map[string]obj{}}
}

func (r *Registry) Register(server *MCPServer) error {
	document := server.RegistryDocument()
	issues := validateRegistryDocument(document)
	nsIssues, err := validatePublisherNamespace(document, r.PublisherDomain)
	if err != nil {
		return err
	}
	issues = append(issues, nsIssues...)
	if len(issues) > 0 {
		return errors.New(strings.Join(issues, "; "))
	}
	discovery := server.Discover(requestMeta())
	if discovery.has("error") {
		return errors.New("runtime discovery failed")
	}
	if alignment := validateRuntimeAlignment(document, discovery); len(alignment) > 0 {
		return errors.New(strings.Join(alignment, "; "))
	}
	r.Entries[server.Name] = document
	r.RuntimeDiscovery[server.Name] = discovery
	return nil
}

func (r *Registry) Search(query string) []string {
	needle := strings.ToLower(query)
	out := []string{}
	for name, entry := range r.Entries {
		title, _ := entry.get("title")
		description, _ := entry.get("description")
		if strings.Contains(strings.ToLower(name), needle) ||
			strings.Contains(strings.ToLower(title.(string)), needle) ||
			strings.Contains(strings.ToLower(description.(string)), needle) {
			out = append(out, name)
		}
	}
	sort.Strings(out)
	return out
}

func stringArg(args obj, key string) (string, error) {
	v, ok := args.get(key)
	if !ok {
		return "", fmt.Errorf("'%s'", key)
	}
	s, _ := v.(string)
	return s, nil
}

func objectSchema(prop string) obj {
	return obj{
		{"type", "object"},
		{"properties", obj{{prop, obj{{"type", "string"}}}}},
		{"required", []any{prop}},
		{"additionalProperties", false},
	}
}

func mustRegister(server *MCPServer, schema ToolSchema, handler Handler) {
	if err := server.Register(schema, handler); err != nil {
		panic(err)
	}
}

func buildReadonlyServer() *MCPServer {
	server := newServer(
		"com.example/internal-readonly",
		"Internal Read-Only Tools",
		"Read-only incident and data lookup tools.",
		"1.0.0",
		"https://mcp.internal.example.com/readonly",
		"https://auth.internal.example.com",
	)
	mustRegister(server,
		ToolSchema{"postgres.readonly", "postgres:query:readonly", false, "Run an approved read-only query.", objectSchema("sql")},
		func(args obj) (obj, error) {
			sql, err := stringArg(args, "sql")
			if err != nil {
				return nil, err
			}
			return obj{{"rows", []any{[]any{1}}}, {"sql", sql}}, nil
		},
	)
	mustRegister(server,
		ToolSchema{"s3.list", "s3:list", false, "List objects in one approved bucket.", objectSchema("bucket")},
		func(args obj) (obj, error) {
			bucket, err := stringArg(args, "bucket")
			if err != nil {
				return nil, err
			}
			return obj{{"bucket", bucket}, {"objects", []any{"a/b.txt"}}}, nil
		},
	)
	return server
}

func buildDestructiveServer() *MCPServer {
	server := newServer(
		"com.example/internal-destructive",
		"Internal Destructive Tools",
		"State-changing tools behind explicit approval.",
		"1.0.0",
		"https://mcp.internal.example.com/destructive",
		"https://auth.internal.example.com",
	)
	mustRegister(server,
		ToolSchema{"jira.create", "jira:write", true, "Create one Jira issue after explicit approval.", objectSchema("title")},
		func(args obj) (obj, error) {
			title, err := stringArg(args, "title")
			if err != nil {
				return nil, err
			}
			return obj{{"id", "PROJ-99"}, {"title", title}, {"created", true}}, nil
		},
	)
	return server
}

func main() {
	readonly := buildReadonlyServer()
	destructive := buildDestructiveServer()
	registry := newRegistry()
	for _, server := range []*MCPServer{readonly, destructive} {
		if err := registry.Register(server); err != nil {
			panic(err)
		}
	}
	audit := []AuditEntry{}

	readonlyToken := Token{"u42", readonly.TrustedIssuer, readonly.URL, map[string]bool{"postgres:query:readonly": true, "s3:list": true}, nowSeconds() + 3_600}
	approvedToken := Token{"u42", destructive.TrustedIssuer, destructive.URL, map[string]bool{"jira:write": true}, nowSeconds() + 3_600}
	approvedArgs := obj{{"title", "new bug"}}
	approval := approvalForAction(approvedToken.User, "jira.create", approvedArgs, destructive.URL, nowSeconds()+900)

	fmt.Println("=== registry metadata and runtime discovery ===")
	fmt.Println(pyDumpsIndent(registry.Entries[readonly.Name]))
	fmt.Println(pyDumpsIndent(registry.RuntimeDiscovery[readonly.Name]))
	fmt.Println("tools:", pyDumpsIndent(readonly.ToolsList(requestMeta())))

	fmt.Println("\n=== policy-gated calls ===")
	fmt.Println(pyRepr(dispatch(readonly, readonlyToken, "postgres.readonly", obj{{"sql", "SELECT 1"}}, requestMeta(), &audit, nil)))
	fmt.Println(pyRepr(dispatch(destructive, approvedToken, "jira.create", approvedArgs, requestMeta(), &audit, &approval)))

	fmt.Println("\n=== audit log ===")
	for _, entry := range audit {
		fmt.Println(dumps(entry.asDict(), dumpOpts{indent: -1, sortKeys: true, ensureASCII: true}))
	}
}
