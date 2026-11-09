// Lesson: Stateless MCP Gateways and Registry Admission (phase 13 / lesson 17)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/17-mcp-gateways-and-registries/docs/en.md
// Run: go run code/main.go

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf16"
)

const (
	protocolVersion        = "2026-07-28"
	protocolMeta           = "io.modelcontextprotocol/protocolVersion"
	clientCapabilitiesMeta = "io.modelcontextprotocol/clientCapabilities"
	clientInfoMeta         = "io.modelcontextprotocol/clientInfo"
	serverInfoMeta         = "io.modelcontextprotocol/serverInfo"
	subscriptionIDMeta     = "io.modelcontextprotocol/subscriptionId"
)

type object struct {
	keys   []string
	values map[string]any
}

func obj(pairs ...any) *object {
	o := &object{values: map[string]any{}}
	for i := 0; i+1 < len(pairs); i += 2 {
		o.set(pairs[i].(string), pairs[i+1])
	}
	return o
}

func (o *object) set(key string, value any) {
	if _, ok := o.values[key]; !ok {
		o.keys = append(o.keys, key)
	}
	o.values[key] = value
}

func (o *object) get(key string) any {
	if o == nil {
		return nil
	}
	return o.values[key]
}

func (o *object) has(key string) bool {
	if o == nil {
		return false
	}
	_, ok := o.values[key]
	return ok
}

func (o *object) setDefault(key string, value any) any {
	if !o.has(key) {
		o.set(key, value)
	}
	return o.values[key]
}

func (o *object) copy() *object {
	c := obj()
	for _, k := range o.keys {
		c.set(k, o.values[k])
	}
	return c
}

func deepCopy(v any) any {
	switch x := v.(type) {
	case *object:
		c := obj()
		for _, k := range x.keys {
			c.set(k, deepCopy(x.values[k]))
		}
		return c
	case []any:
		c := make([]any, len(x))
		for i, item := range x {
			c[i] = deepCopy(item)
		}
		return c
	}
	return v
}

func asObject(v any) (*object, bool) {
	o, ok := v.(*object)
	return o, ok && o != nil
}

func truthy(v any) bool {
	switch x := v.(type) {
	case nil:
		return false
	case bool:
		return x
	case string:
		return x != ""
	case int:
		return x != 0
	case float64:
		return x != 0
	case []any:
		return len(x) > 0
	case *object:
		return len(x.keys) > 0
	}
	return true
}

var namedMethods = map[string]bool{
	"tools/call":     true,
	"resources/read": true,
	"prompts/get":    true,
	"tasks/get":      true,
	"tasks/update":   true,
	"tasks/cancel":   true,
}

type user struct{ id, role string }

var users = map[string]user{
	"bearer-alice": {"alice", "developer"},
	"bearer-bob":   {"bob", "auditor"},
}

var rbac = map[string]map[string]bool{
	"alice": {"notes.search": true, "notes.create": true, "issues.list": true, "issues.open": true},
	"bob":   {"notes.search": true, "issues.list": true},
}

func registryRecord(name, description, identifier string) *object {
	return obj(
		"$schema", "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
		"name", name,
		"description", description,
		"version", "1.0.0",
		"packages", []any{obj(
			"registryType", "npm",
			"identifier", identifier,
			"version", "1.0.0",
			"transport", obj("type", "stdio"),
		)},
	)
}

var registryServerJSON = map[string]*object{
	"notes":  registryRecord("com.example/notes", "Example notes MCP server.", "@example/notes-mcp"),
	"issues": registryRecord("com.example/issues", "Example issues MCP server.", "@example/issues-mcp"),
}

func admissionState(name string) *object {
	return obj(
		"registryName", name,
		"registryVersion", "1.0.0",
		"publisher", obj("namespace", "com.example", "status", "verified"),
		"provenance", obj("source", "registry.modelcontextprotocol.io", "recordId", name+"@1.0.0"),
		"admission", obj("status", "approved", "reviewedBy", "gateway-policy"),
	)
}

var verifiedAdmissionState = map[string]*object{
	"notes":  admissionState("com.example/notes"),
	"issues": admissionState("com.example/issues"),
}

type protocolError struct {
	code    int
	message string
	data    *object
}

func (e *protocolError) Error() string { return e.message }

func perr(code int, message string, data *object) *protocolError {
	return &protocolError{code: code, message: message, data: data}
}

var errInvalidParams = errors.New("invalid params")

func requestMeta(clientName string) *object {
	return obj(
		protocolMeta, protocolVersion,
		clientCapabilitiesMeta, obj(),
		clientInfoMeta, obj("name", clientName, "version", "1.0.0"),
	)
}

func requestName(method string, params *object) any {
	switch method {
	case "tasks/get", "tasks/update", "tasks/cancel":
		return params.get("taskId")
	}
	if name := params.get("name"); truthy(name) {
		return name
	}
	return params.get("uri")
}

func makeRequest(method string, requestID any, params *object, clientName string) (*object, map[string]string) {
	wireParams := obj()
	if params != nil {
		wireParams = params.copy()
	}
	wireParams.set("_meta", requestMeta(clientName))
	body := obj("jsonrpc", "2.0", "id", requestID, "method", method, "params", wireParams)
	headers := map[string]string{"MCP-Protocol-Version": protocolVersion, "Mcp-Method": method}
	if namedMethods[method] {
		name := requestName(method, wireParams)
		if !truthy(name) {
			name = ""
		}
		headers["Mcp-Name"] = pyStr(name)
	}
	return body, headers
}

func descriptorDigest(tool *object) string {
	var b strings.Builder
	writeJSON(&b, tool, true, ",", ":")
	sum := sha256.Sum256([]byte(b.String()))
	return hex.EncodeToString(sum[:])
}

func registryRecordIsAdmissible(record, admission *object, namespace string) bool {
	packages, ok := record.get("packages").([]any)
	shapesValid := ok && len(packages) > 0
	for _, p := range packages {
		pkg, ok := asObject(p)
		if !ok {
			shapesValid = false
			break
		}
		_, a := pkg.get("registryType").(string)
		_, b := pkg.get("identifier").(string)
		_, c := pkg.get("version").(string)
		transport, d := asObject(pkg.get("transport"))
		if !a || !b || !c || !d || transport.get("type") != "stdio" {
			shapesValid = false
			break
		}
	}
	sub := func(key, field string) any {
		o, _ := asObject(admission.get(key))
		return o.get(field)
	}
	name, nameOK := record.get("name").(string)
	_, descOK := record.get("description").(string)
	return nameOK &&
		strings.HasPrefix(name, namespace) &&
		descOK &&
		record.get("version") == admission.get("registryVersion") &&
		record.get("name") == admission.get("registryName") &&
		shapesValid &&
		sub("publisher", "namespace") == "com.example" &&
		sub("publisher", "status") == "verified" &&
		sub("provenance", "source") == "registry.modelcontextprotocol.io" &&
		sub("admission", "status") == "approved"
}

func validateWire(body *object, headers map[string]string) (*object, error) {
	if body.get("jsonrpc") != "2.0" {
		return nil, perr(-32600, "Invalid Request", nil)
	}
	method, methodOK := body.get("method").(string)
	params, paramsOK := asObject(body.get("params"))
	if !methodOK || !paramsOK {
		return nil, perr(-32600, "Invalid Request", nil)
	}
	meta, ok := asObject(params.get("_meta"))
	if !ok {
		return nil, perr(-32602, "params._meta is required", nil)
	}
	requested, ok := meta.get(protocolMeta).(string)
	if !ok {
		return nil, perr(-32602, "protocolVersion must be a string", nil)
	}
	if _, ok := asObject(meta.get(clientCapabilitiesMeta)); !ok {
		return nil, perr(-32602, "clientCapabilities is required", nil)
	}
	if v, ok := headers["MCP-Protocol-Version"]; !ok || v != requested {
		return nil, perr(-32020, "MCP-Protocol-Version header mismatch", nil)
	}
	if v, ok := headers["Mcp-Method"]; !ok || v != method {
		return nil, perr(-32020, "Mcp-Method header mismatch", nil)
	}
	if namedMethods[method] {
		expected := requestName(method, params)
		v, ok := headers["Mcp-Name"]
		if (!ok && expected != nil) || (ok && v != expected) {
			return nil, perr(-32020, "Mcp-Name header mismatch", nil)
		}
	}
	if requested != protocolVersion {
		return nil, perr(-32022, "Unsupported protocol version",
			obj("supported", []any{protocolVersion}, "requested", requested))
	}
	return params, nil
}

func success(serverName string, requestID any, result *object) *object {
	result = result.copy()
	result.setDefault("resultType", "complete")
	meta := result.setDefault("_meta", obj()).(*object)
	meta.set(serverInfoMeta, obj("name", serverName, "version", "2.0.0"))
	return obj("jsonrpc", "2.0", "id", requestID, "result", result)
}

func sortByName(tools []any) []any {
	out := append([]any(nil), tools...)
	sort.SliceStable(out, func(i, j int) bool {
		return out[i].(*object).get("name").(string) < out[j].(*object).get("name").(string)
	})
	return out
}

type backendServer struct {
	name  string
	tools []any
}

func newBackend(name string, tools []any) *backendServer {
	return &backendServer{name: name, tools: deepCopy(tools).([]any)}
}

func (s *backendServer) findTool(name any) *object {
	for _, item := range s.tools {
		if t := item.(*object); t.get("name") == name {
			return t
		}
	}
	return nil
}

func (s *backendServer) handle(body *object, headers map[string]string) (*object, error) {
	params, err := validateWire(body, headers)
	if err != nil {
		return nil, err
	}
	var result *object
	switch body.get("method") {
	case "server/discover":
		result = obj(
			"supportedVersions", []any{protocolVersion},
			"capabilities", obj("tools", obj("listChanged", true)),
			"ttlMs", 60_000,
			"cacheScope", "public",
		)
	case "tools/list":
		result = obj("tools", sortByName(s.tools), "ttlMs", 30_000, "cacheScope", "public")
	case "tools/call":
		tool := s.findTool(params.get("name"))
		if tool == nil {
			return nil, perr(-32601, "Tool not found", nil)
		}
		result = obj(
			"content", []any{obj("type", "text", "text", fmt.Sprintf("%s.%s completed", s.name, tool.get("name")))},
			"isError", false,
		)
	default:
		return nil, perr(-32601, "Method not found", nil)
	}
	return success(s.name, body.get("id"), result), nil
}

type tokenBucket struct {
	capacity        float64
	refillPerSecond float64
	tokens          float64
	updatedAt       time.Time
}

func newTokenBucket() *tokenBucket {
	return &tokenBucket{capacity: 5, refillPerSecond: 1.0, tokens: 5.0, updatedAt: time.Now()}
}

func (b *tokenBucket) consume(now time.Time) bool {
	elapsed := math.Max(0, now.Sub(b.updatedAt).Seconds())
	b.tokens = math.Min(b.capacity, b.tokens+elapsed*b.refillPerSecond)
	b.updatedAt = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

type gateway struct {
	backendOrder        []string
	backends            map[string]*backendServer
	pins                map[string]string
	buckets             map[string]*tokenBucket
	audit               []any
	forwardedRequestIDs []string
}

func inputSchema(props *object, required ...any) *object {
	s := obj("type", "object", "properties", props)
	if required != nil {
		s.set("required", required)
	}
	return s
}

func newGateway() *gateway {
	g := &gateway{
		backendOrder: []string{"notes", "issues"},
		backends: map[string]*backendServer{
			"notes": newBackend("notes", []any{
				obj("name", "search", "description", "Search approved notes.",
					"inputSchema", inputSchema(obj("query", obj("type", "string")), "query")),
				obj("name", "create", "description", "Create a note.",
					"inputSchema", inputSchema(obj("title", obj("type", "string")), "title")),
			}),
			"issues": newBackend("issues", []any{
				obj("name", "list", "description", "List tracked issues.",
					"inputSchema", inputSchema(obj())),
				obj("name", "open", "description", "Open an issue.",
					"inputSchema", inputSchema(obj("id", obj("type", "string")), "id")),
			}),
		},
		pins:    map[string]string{},
		buckets: map[string]*tokenBucket{},
	}
	for _, serverName := range g.backendOrder {
		for _, item := range g.backends[serverName].tools {
			tool := item.(*object)
			g.pins[fmt.Sprintf("%s.%s", serverName, tool.get("name"))] = descriptorDigest(tool)
		}
	}
	return g
}

func errorResponse(requestID any, e *protocolError) *object {
	payload := obj("code", e.code, "message", e.message)
	if e.data != nil {
		payload.set("data", e.data)
	}
	return obj("jsonrpc", "2.0", "id", requestID, "error", payload)
}

func errorStatus(e *protocolError) int {
	if e.code == -32601 {
		return 404
	}
	return 400
}

func (g *gateway) isPinned(canonical string, tool *object) bool {
	expected, ok := g.pins[canonical]
	return ok && expected == descriptorDigest(tool)
}

func (g *gateway) visibleTools(userID string) []any {
	var visible []any
	for _, serverName := range g.backendOrder {
		if !registryRecordIsAdmissible(registryServerJSON[serverName], verifiedAdmissionState[serverName], "com.example/") {
			continue
		}
		for _, item := range g.backends[serverName].tools {
			tool := item.(*object)
			canonical := fmt.Sprintf("%s.%s", serverName, tool.get("name"))
			if rbac[userID][canonical] && g.isPinned(canonical, tool) {
				entry := tool.copy()
				entry.set("name", canonical)
				visible = append(visible, entry)
			}
		}
	}
	if visible == nil {
		visible = []any{}
	}
	return sortByName(visible)
}

func (g *gateway) forward(canonical string, arguments any) (*object, error) {
	serverName, toolName, _ := strings.Cut(canonical, ".")
	backend := g.backends[serverName]
	forwardedID := fmt.Sprintf("gw-%d", len(g.forwardedRequestIDs)+1)
	g.forwardedRequestIDs = append(g.forwardedRequestIDs, forwardedID)
	body, headers := makeRequest("tools/call", forwardedID, obj("name", toolName, "arguments", arguments), "enterprise-gateway")
	resp, err := backend.handle(body, headers)
	if err != nil {
		return nil, err
	}
	return resp.get("result").(*object), nil
}

func (g *gateway) record(principal, tool, decision string) {
	g.audit = append(g.audit, obj("principal", principal, "tool", tool, "decision", decision))
}

func (g *gateway) handle(bearer string, body *object, headers map[string]string, httpMethod, accept string) (int, *object) {
	if httpMethod != "POST" {
		return 405, nil
	}
	isNotification := !body.has("id")
	u, ok := users[bearer]
	if !ok {
		if isNotification {
			return 401, nil
		}
		return 401, errorResponse(body.get("id"), perr(-32001, "Unauthenticated", nil))
	}
	status, resp, err := g.route(u, body, headers, accept, isNotification)
	if err == nil {
		return status, resp
	}
	var pe *protocolError
	if errors.As(err, &pe) {
		status := errorStatus(pe)
		if pe.code == -32003 {
			status = 403
		}
		if isNotification {
			return status, nil
		}
		return status, errorResponse(body.get("id"), pe)
	}
	if isNotification {
		return 400, nil
	}
	return 400, errorResponse(body.get("id"), perr(-32602, "Invalid params", nil))
}

func (g *gateway) route(u user, body *object, headers map[string]string, accept string, isNotification bool) (int, *object, error) {
	params, err := validateWire(body, headers)
	if err != nil {
		return 0, nil, err
	}
	var result *object
	switch body.get("method") {
	case "server/discover":
		result = obj(
			"supportedVersions", []any{protocolVersion},
			"capabilities", obj("tools", obj("listChanged", true)),
			"ttlMs", 30_000,
			"cacheScope", "private",
		)
	case "tools/list":
		result = obj("tools", g.visibleTools(u.id), "ttlMs", 10_000, "cacheScope", "private")
	case "tools/call":
		canonical := ""
		if params.has("name") {
			canonical = pyStr(params.get("name"))
		}
		if !rbac[u.id][canonical] {
			g.record(u.id, canonical, "deny")
			return 0, nil, perr(-32003, "Forbidden", obj("tool", canonical))
		}
		bucket, ok := g.buckets[u.id]
		if !ok {
			bucket = newTokenBucket()
			g.buckets[u.id] = bucket
		}
		if !bucket.consume(time.Now()) {
			g.record(u.id, canonical, "rate_limit")
			if isNotification {
				return 429, nil, nil
			}
			return 429, errorResponse(body.get("id"), perr(-32029, "Rate limited", nil)), nil
		}
		serverName, toolName, found := strings.Cut(canonical, ".")
		backend, known := g.backends[serverName]
		if !found || !known {
			return 0, nil, errInvalidParams
		}
		tool := backend.findTool(toolName)
		if tool == nil || !g.isPinned(canonical, tool) {
			g.record(u.id, canonical, "pin_mismatch")
			if isNotification {
				return 409, nil, nil
			}
			return 409, errorResponse(body.get("id"), perr(-32010, "Descriptor changed", obj("tool", canonical))), nil
		}
		arguments := params.get("arguments")
		if !params.has("arguments") {
			arguments = obj()
		}
		backendResult, err := g.forward(canonical, arguments)
		if err != nil {
			return 0, nil, err
		}
		result = obj()
		for _, k := range backendResult.keys {
			if k != "_meta" {
				result.set(k, backendResult.get(k))
			}
		}
		g.record(u.id, canonical, "allow")
	case "subscriptions/listen":
		if !strings.Contains(accept, "text/event-stream") {
			if isNotification {
				return 406, nil, nil
			}
			return 406, errorResponse(body.get("id"), perr(-32602, "subscriptions/listen requires an SSE response", nil)), nil
		}
		requested := any(obj())
		if params.has("notifications") {
			requested = params.get("notifications")
		}
		req, ok := asObject(requested)
		if !ok {
			return 0, nil, perr(-32602, "notifications must be an object", nil)
		}
		honored := obj()
		if req.get("toolsListChanged") == true {
			honored.set("toolsListChanged", true)
		}
		if isNotification {
			return 202, nil, nil
		}
		return 200, obj(
			"contentType", "text/event-stream",
			"events", []any{obj(
				"jsonrpc", "2.0",
				"method", "notifications/subscriptions/acknowledged",
				"params", obj("_meta", obj(subscriptionIDMeta, body.get("id")), "notifications", honored),
			)},
		), nil
	default:
		return 0, nil, perr(-32601, "Method not found", nil)
	}
	if isNotification {
		return 202, nil, nil
	}
	return 200, success("enterprise-gateway", body.get("id"), result), nil
}

func quote(s string, q byte, ascii bool) string {
	var b strings.Builder
	b.WriteByte(q)
	for _, r := range s {
		switch {
		case r == rune(q) || r == '\\':
			b.WriteByte('\\')
			b.WriteRune(r)
		case r == '\n':
			b.WriteString(`\n`)
		case r == '\r':
			b.WriteString(`\r`)
		case r == '\t':
			b.WriteString(`\t`)
		case q == '"' && r == '\b':
			b.WriteString(`\b`)
		case q == '"' && r == '\f':
			b.WriteString(`\f`)
		case r < 0x20 || r == 0x7f:
			if q == '"' {
				fmt.Fprintf(&b, `\u%04x`, r)
			} else {
				fmt.Fprintf(&b, `\x%02x`, r)
			}
		case ascii && r >= 0x10000:
			hi, lo := utf16.EncodeRune(r)
			fmt.Fprintf(&b, `\u%04x\u%04x`, hi, lo)
		case ascii && r > 0x7e:
			fmt.Fprintf(&b, `\u%04x`, r)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte(q)
	return b.String()
}

func writeJSON(b *strings.Builder, v any, sortKeys bool, itemSep, keySep string) {
	switch x := v.(type) {
	case nil:
		b.WriteString("null")
	case bool:
		b.WriteString(strconv.FormatBool(x))
	case int:
		b.WriteString(strconv.Itoa(x))
	case string:
		b.WriteString(quote(x, '"', true))
	case []any:
		b.WriteByte('[')
		for i, item := range x {
			if i > 0 {
				b.WriteString(itemSep)
			}
			writeJSON(b, item, sortKeys, itemSep, keySep)
		}
		b.WriteByte(']')
	case *object:
		keys := append([]string(nil), x.keys...)
		if sortKeys {
			sort.Strings(keys)
		}
		b.WriteByte('{')
		for i, k := range keys {
			if i > 0 {
				b.WriteString(itemSep)
			}
			b.WriteString(quote(k, '"', true))
			b.WriteString(keySep)
			writeJSON(b, x.values[k], sortKeys, itemSep, keySep)
		}
		b.WriteByte('}')
	default:
		panic(fmt.Sprintf("unsupported JSON value %T", v))
	}
}

func pyDumps(v any) string {
	if o, ok := v.(*object); ok && o == nil {
		return "null"
	}
	var b strings.Builder
	writeJSON(&b, v, false, ", ", ": ")
	return b.String()
}

func pyRepr(v any) string {
	switch x := v.(type) {
	case string:
		q := byte('\'')
		if strings.Contains(x, "'") && !strings.Contains(x, `"`) {
			q = '"'
		}
		return quote(x, q, false)
	case []any:
		parts := make([]string, len(x))
		for i, item := range x {
			parts[i] = pyRepr(item)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case []string:
		parts := make([]string, len(x))
		for i, item := range x {
			parts[i] = pyRepr(item)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	case *object:
		parts := make([]string, len(x.keys))
		for i, k := range x.keys {
			parts[i] = pyRepr(k) + ": " + pyRepr(x.values[k])
		}
		return "{" + strings.Join(parts, ", ") + "}"
	case bool:
		if x {
			return "True"
		}
		return "False"
	case nil:
		return "None"
	}
	return fmt.Sprint(v)
}

func pyStr(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	return pyRepr(v)
}

func main() {
	g := newGateway()
	steps := []struct {
		method string
		params *object
	}{
		{"server/discover", obj()},
		{"tools/list", obj()},
		{"tools/call", obj("name", "notes.search", "arguments", obj("query", "stateless"))},
		{"subscriptions/listen", obj("notifications", obj("toolsListChanged", true))},
	}
	for i, step := range steps {
		body, headers := makeRequest(step.method, i+1, step.params, "gateway-client")
		status, response := g.handle("bearer-alice", body, headers, "POST", "application/json, text/event-stream")
		text := []rune(pyDumps(response))
		if len(text) > 260 {
			text = text[:260]
		}
		fmt.Println(status, step.method, string(text))
	}
	fmt.Println("forwarded request ids:", pyRepr(g.forwardedRequestIDs))
	fmt.Println("audit:", pyRepr(g.audit))
}
