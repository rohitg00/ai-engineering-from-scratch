// Lesson: MCP Transports: stdio and Stateless Streamable HTTP (phase 13 / lesson 09)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/09-mcp-transports/docs/en.md
// Run: go run code/main.go

package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	protocolVersion   = "2026-07-28"
	versionKey        = "io.modelcontextprotocol/protocolVersion"
	capabilitiesKey   = "io.modelcontextprotocol/clientCapabilities"
	clientInfoKey     = "io.modelcontextprotocol/clientInfo"
	serverInfoKey     = "io.modelcontextprotocol/serverInfo"
	subscriptionIDKey = "io.modelcontextprotocol/subscriptionId"
	maxRequestBytes   = 1_048_576
	readTimeout       = 5 * time.Second
)

type obj = map[string]any

var supportedVersions = []string{protocolVersion}

var originAllowlist = map[string]bool{
	"http://localhost":       true,
	"http://127.0.0.1":       true,
	"https://client.example": true,
}

var routingHeaders = []string{"MCP-Protocol-Version", "Mcp-Method", "Mcp-Name"}

func clientInfo() obj { return obj{"name": "lesson-09-client", "version": "2.0.0"} }

func serverInfo() obj { return obj{"name": "lesson-09-http", "version": "2.0.0"} }

func serverCapabilities() obj { return obj{"tools": obj{"listChanged": true}} }

func tools() []obj {
	return []obj{
		{
			"name":        "ping",
			"description": "Return pong for a transport health check.",
			"inputSchema": obj{"type": "object", "properties": obj{}, "required": []any{}},
			"annotations": obj{"readOnlyHint": true, "idempotentHint": true},
		},
	}
}

type rpcFault struct {
	code    int
	message string
	data    any
}

func (f *rpcFault) Error() string { return f.message }

func fault(code int, message string) *rpcFault {
	return &rpcFault{code: code, message: message}
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

func complete(payload obj, ttlMS int, cacheScope string, resultMeta obj) obj {
	metadata := obj{serverInfoKey: serverInfo()}
	for k, v := range resultMeta {
		metadata[k] = v
	}
	result := obj{"resultType": "complete"}
	for k, v := range payload {
		result[k] = v
	}
	result["_meta"] = metadata
	if ttlMS >= 0 {
		result["ttlMs"] = ttlMS
		result["cacheScope"] = cacheScope
	}
	return result
}

func originAllowed(values []string) bool {
	return len(values) == 0 || originAllowlist[values[0]]
}

func printableASCII(s string) bool {
	for _, c := range s {
		if c < 0x20 || c > 0x7E {
			return false
		}
	}
	return true
}

func encodeHeaderValue(value string) string {
	sentinel := strings.HasPrefix(value, "=?base64?") && strings.HasSuffix(value, "?=")
	if printableASCII(value) && value == strings.TrimSpace(value) && !sentinel {
		return value
	}
	return "=?base64?" + base64.StdEncoding.EncodeToString([]byte(value)) + "?="
}

func decodeHeaderValue(value string) (string, error) {
	if strings.HasPrefix(value, "=?base64?") && strings.HasSuffix(value, "?=") {
		raw, err := base64.StdEncoding.DecodeString(value[len("=?base64?") : len(value)-2])
		if err != nil || !utf8.Valid(raw) {
			return "", fault(-32020, "Malformed Base64 MCP header value")
		}
		return string(raw), nil
	}
	if !printableASCII(value) {
		return "", fault(-32020, "Malformed MCP header value")
	}
	return value, nil
}

func bodyName(message obj) (string, bool) {
	params, _ := message["params"].(obj)
	var value any
	switch message["method"] {
	case "resources/read":
		value = params["uri"]
	case "tools/call", "prompts/get":
		value = params["name"]
	default:
		return "", false
	}
	s, ok := value.(string)
	return s, ok
}

func httpHeadersFor(message obj, origin string, extra map[string]string) http.Header {
	meta := message["params"].(obj)["_meta"].(obj)
	h := http.Header{}
	h.Set("Accept", "application/json, text/event-stream")
	h.Set("Content-Type", "application/json")
	h.Set("Origin", origin)
	h.Set("MCP-Protocol-Version", fmt.Sprint(meta[versionKey]))
	h.Set("Mcp-Method", fmt.Sprint(message["method"]))
	if name, ok := bodyName(message); ok {
		h.Set("Mcp-Name", encodeHeaderValue(name))
	}
	for k, v := range extra {
		h.Set(k, v)
	}
	return h
}

func validateRequestStructure(message obj) (string, error) {
	if _, ok := message["method"].(string); !ok || message["jsonrpc"] != "2.0" {
		return "", fault(-32600, "Invalid Request")
	}
	params, ok := message["params"].(obj)
	if !ok {
		return "", fault(-32602, "params must be an object")
	}
	meta, ok := params["_meta"].(obj)
	if !ok {
		return "", fault(-32602, "params._meta is required")
	}
	version, ok := meta[versionKey].(string)
	if !ok {
		return "", fault(-32602, versionKey+" is required")
	}
	if _, ok := meta[capabilitiesKey].(obj); !ok {
		return "", fault(-32602, capabilitiesKey+" is required")
	}
	if info, present := meta[clientInfoKey]; present && info != nil {
		m, ok := info.(obj)
		_, nameOK := m["name"].(string)
		_, versionOK := m["version"].(string)
		if !ok || !nameOK || !versionOK {
			return "", fault(-32602, clientInfoKey+" is malformed")
		}
	}
	return version, nil
}

func validateSupportedVersion(version string) error {
	for _, v := range supportedVersions {
		if v == version {
			return nil
		}
	}
	return &rpcFault{
		code:    -32022,
		message: "Unsupported protocol version",
		data:    obj{"supported": append([]string(nil), supportedVersions...), "requested": version},
	}
}

func validateHTTPHeaders(headers http.Header, message obj, bodyVersion string) error {
	if v := headers.Values("MCP-Protocol-Version"); len(v) == 0 || v[0] != bodyVersion {
		return fault(-32020, "Header mismatch: MCP-Protocol-Version")
	}
	if v := headers.Values("Mcp-Method"); len(v) == 0 || v[0] != message["method"] {
		return fault(-32020, "Header mismatch: Mcp-Method")
	}
	switch message["method"] {
	case "tools/call", "resources/read", "prompts/get":
		expected, ok := bodyName(message)
		v := headers.Values("Mcp-Name")
		if len(v) == 0 || !ok {
			return fault(-32020, "Header mismatch: Mcp-Name")
		}
		decoded, err := decodeHeaderValue(v[0])
		if err != nil {
			return err
		}
		if decoded != expected {
			return fault(-32020, "Header mismatch: Mcp-Name")
		}
	}
	return nil
}

func rejectDuplicateRoutingHeaders(headers http.Header) error {
	for _, name := range routingHeaders {
		if len(headers.Values(name)) > 1 {
			return fault(-32020, "Duplicate routing header: "+name)
		}
	}
	return nil
}

func rejectDuplicateOrigin(headers http.Header) error {
	if len(headers.Values("Origin")) > 1 {
		return fault(-32020, "Duplicate Origin header")
	}
	return nil
}

func dispatch(message obj) obj {
	requestID, ok := message["id"]
	if !ok {
		return nil
	}
	result, err := dispatchResult(message)
	var f *rpcFault
	if errors.As(err, &f) {
		return rpcError(requestID, f.code, f.message, f.data)
	}
	return obj{"jsonrpc": "2.0", "id": requestID, "result": result}
}

func dispatchResult(message obj) (obj, error) {
	version, err := validateRequestStructure(message)
	if err != nil {
		return nil, err
	}
	if err := validateSupportedVersion(version); err != nil {
		return nil, err
	}
	method := message["method"].(string)
	params := message["params"].(obj)
	switch method {
	case "server/discover":
		return complete(obj{
			"supportedVersions": append([]string(nil), supportedVersions...),
			"capabilities":      serverCapabilities(),
			"instructions":      "Call ping for a transport health check.",
		}, 3_600_000, "public", nil), nil
	case "tools/list":
		list := tools()
		sort.Slice(list, func(i, j int) bool { return list[i]["name"].(string) < list[j]["name"].(string) })
		return complete(obj{"tools": list}, 30_000, "public", nil), nil
	case "tools/call":
		args, present := params["arguments"]
		_, argsOK := args.(obj)
		if params["name"] != "ping" || (present && !argsOK) {
			return complete(obj{
				"content": []any{obj{"type": "text", "text": "Unknown or invalid tool"}},
				"isError": true,
			}, -1, "private", nil), nil
		}
		return complete(obj{"content": []any{obj{"type": "text", "text": "pong"}}, "isError": false}, -1, "private", nil), nil
	case "subscriptions/listen":
		if _, ok := params["notifications"].(obj); !ok {
			return nil, fault(-32602, "subscriptions/listen requires notifications")
		}
		return complete(obj{}, -1, "private", nil), nil
	}
	return nil, fault(-32601, "Method not found: "+method)
}

func acceptedFilter(requested obj) obj {
	accepted := obj{}
	for _, key := range []string{"toolsListChanged", "promptsListChanged", "resourcesListChanged"} {
		if requested[key] == true {
			accepted[key] = true
		}
	}
	if resources, ok := requested["resourceSubscriptions"].([]any); ok {
		allStrings := true
		for _, uri := range resources {
			if _, ok := uri.(string); !ok {
				allStrings = false
			}
		}
		if allStrings {
			accepted["resourceSubscriptions"] = append([]any(nil), resources...)
		}
	}
	return accepted
}

func subscriptionMessages(message obj) []obj {
	requestID := message["id"]
	accepted := acceptedFilter(message["params"].(obj)["notifications"].(obj))
	meta := func() obj { return obj{subscriptionIDKey: requestID} }
	messages := []obj{{
		"jsonrpc": "2.0",
		"method":  "notifications/subscriptions/acknowledged",
		"params":  obj{"notifications": accepted, "_meta": meta()},
	}}
	if accepted["toolsListChanged"] == true {
		messages = append(messages, obj{
			"jsonrpc": "2.0",
			"method":  "notifications/tools/list_changed",
			"params":  obj{"_meta": meta()},
		})
	}
	if resources, _ := accepted["resourceSubscriptions"].([]any); len(resources) > 0 {
		messages = append(messages, obj{
			"jsonrpc": "2.0",
			"method":  "notifications/resources/updated",
			"params":  obj{"uri": resources[0], "_meta": meta()},
		})
	}
	return append(messages, obj{"jsonrpc": "2.0", "id": requestID, "result": complete(obj{}, -1, "private", meta())})
}

func compactJSON(v any) []byte {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		panic(err)
	}
	return bytes.TrimRight(buf.Bytes(), "\n")
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func writeJSON(w http.ResponseWriter, status int, payload obj) {
	body := compactJSON(payload)
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Length", strconv.Itoa(len(body)))
	w.WriteHeader(status)
	_, _ = w.Write(body)
}

func writeFault(w http.ResponseWriter, status int, requestID any, err error) {
	var f *rpcFault
	if !errors.As(err, &f) {
		panic(err)
	}
	writeJSON(w, status, rpcError(requestID, f.code, f.message, f.data))
}

func validPathAndOrigin(w http.ResponseWriter, r *http.Request) bool {
	if r.URL.RequestURI() != "/mcp" {
		writeJSON(w, 404, obj{"error": "Not found"})
		return false
	}
	if err := rejectDuplicateOrigin(r.Header); err != nil {
		writeFault(w, 400, nil, err)
		return false
	}
	if !originAllowed(r.Header.Values("Origin")) {
		writeJSON(w, 403, obj{"error": "Origin not allowed"})
		return false
	}
	return true
}

func readBody(w http.ResponseWriter, r *http.Request) (obj, error) {
	if len(r.TransferEncoding) > 0 {
		return nil, errors.New("Transfer-Encoding is not supported")
	}
	raw := r.Header.Get("Content-Length")
	if raw == "" {
		return nil, errors.New("Content-Length is required")
	}
	for _, c := range raw {
		if c < '0' || c > '9' {
			return nil, errors.New("Content-Length must contain ASCII decimal digits")
		}
	}
	length, err := strconv.Atoi(raw)
	if err != nil || length < 1 || length > maxRequestBytes {
		return nil, fmt.Errorf("Content-Length must be from 1 through %d", maxRequestBytes)
	}
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, int64(length)))
	if err != nil {
		return nil, err
	}
	if len(body) != length {
		return nil, errors.New("request body ended before Content-Length bytes arrived")
	}
	var parsed any
	if err := json.Unmarshal(body, &parsed); err != nil {
		return nil, err
	}
	message, ok := parsed.(obj)
	if !ok {
		return nil, errors.New("message must be an object")
	}
	return message, nil
}

func handlePost(w http.ResponseWriter, r *http.Request) {
	mediaType := strings.ToLower(strings.TrimSpace(strings.SplitN(r.Header.Get("Content-Type"), ";", 2)[0]))
	if mediaType != "application/json" {
		writeJSON(w, 415, obj{"error": "Content-Type must be application/json"})
		return
	}
	accept := r.Header.Get("Accept")
	if !strings.Contains(accept, "application/json") || !strings.Contains(accept, "text/event-stream") {
		writeJSON(w, 406, obj{"error": "Accept must include JSON and SSE"})
		return
	}
	message, err := readBody(w, r)
	if err != nil {
		writeJSON(w, 400, rpcError(nil, -32700, "Parse error", obj{"detail": err.Error()}))
		return
	}
	requestID := message["id"]
	bodyVersion, err := validateRequestStructure(message)
	if err == nil {
		err = rejectDuplicateRoutingHeaders(r.Header)
	}
	if err == nil {
		err = validateHTTPHeaders(r.Header, message, bodyVersion)
	}
	if err == nil {
		err = validateSupportedVersion(bodyVersion)
	}
	if err != nil {
		writeFault(w, 400, requestID, err)
		return
	}
	if _, ok := message["id"]; !ok {
		w.WriteHeader(202)
		return
	}
	if message["method"] == "subscriptions/listen" {
		if _, ok := message["params"].(obj)["notifications"].(obj); !ok {
			writeFault(w, 400, requestID, fault(-32602, "subscriptions/listen requires notifications"))
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("X-Accel-Buffering", "no")
		w.WriteHeader(200)
		for _, payload := range subscriptionMessages(message) {
			_, _ = fmt.Fprintf(w, "data: %s\n\n", compactJSON(payload))
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
		return
	}
	response := dispatch(message)
	status := 200
	if e, ok := response["error"].(obj); ok && e["code"] == -32601 {
		status = 404
	}
	writeJSON(w, status, response)
}

func handler(w http.ResponseWriter, r *http.Request) {
	sw := &statusWriter{ResponseWriter: w, status: 200}
	defer func() {
		fmt.Fprintf(os.Stderr, "[mcp-http] \"%s %s %s\" %d -\n", r.Method, r.URL.RequestURI(), r.Proto, sw.status)
	}()
	if r.Method != http.MethodPost && r.Method != http.MethodGet && r.Method != http.MethodDelete {
		http.Error(sw, fmt.Sprintf("Unsupported method ('%s')", r.Method), 501)
		return
	}
	if !validPathAndOrigin(sw, r) {
		return
	}
	if r.Method != http.MethodPost {
		body := compactJSON(obj{"error": "Method not allowed"})
		sw.Header().Set("Allow", "POST")
		sw.Header().Set("Content-Type", "application/json")
		sw.Header().Set("Content-Length", strconv.Itoa(len(body)))
		sw.WriteHeader(405)
		_, _ = sw.Write(body)
		return
	}
	handlePost(sw, r)
}

func serve(addr string) (*http.Server, string) {
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		panic(err)
	}
	srv := &http.Server{Handler: http.HandlerFunc(handler), ReadTimeout: readTimeout}
	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()
	return srv, ln.Addr().String()
}

var client = &http.Client{Timeout: 3 * time.Second}

func post(url string, message obj, headers http.Header) (int, http.Header, any) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(compactJSON(message)))
	if err != nil {
		panic(err)
	}
	req.Header = headers
	resp, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}
	mediaType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if mediaType != "application/json" {
		return resp.StatusCode, resp.Header, string(body)
	}
	var payload any
	if err := json.Unmarshal(body, &payload); err != nil {
		panic(err)
	}
	return resp.StatusCode, resp.Header, payload
}

func headerOrNone(h http.Header, name string) string {
	if v := h.Values(name); len(v) > 0 {
		return v[0]
	}
	return "None"
}

func pyBool(b bool) string {
	if b {
		return "True"
	}
	return "False"
}

func dig(v any, path ...any) any {
	for _, p := range path {
		switch k := p.(type) {
		case string:
			v = v.(obj)[k]
		case int:
			v = v.([]any)[k]
		}
	}
	return v
}

func probe() {
	srv, addr := serve("127.0.0.1:0")
	url := "http://" + addr + "/mcp"
	fmt.Println("MCP 2026-07-28 Streamable HTTP probe")

	discover := makeRequest(1, "server/discover", nil, protocolVersion)
	status, _, _ := post(url, discover, httpHeadersFor(discover, "http://evil.example", nil))
	fmt.Printf("  invalid Origin: HTTP %d\n", status)

	status, headers, payload := post(url, discover, httpHeadersFor(discover, "http://localhost", nil))
	fmt.Printf("  discovery: HTTP %d, version=%v, session-header=%s\n",
		status, dig(payload, "result", "supportedVersions", 0), headerOrNone(headers, "Mcp-Session-Id"))

	listing := makeRequest(2, "tools/list", nil, protocolVersion)
	removed := map[string]string{"Mcp-Session-Id": "ignored", "Last-Event-ID": "ignored"}
	status, headers, payload = post(url, listing, httpHeadersFor(listing, "http://localhost", removed))
	fmt.Printf("  removed headers ignored: HTTP %d, tool=%v, echo=%s\n",
		status, dig(payload, "result", "tools", 0, "name"), headerOrNone(headers, "Mcp-Session-Id"))

	mismatched := httpHeadersFor(listing, "http://localhost", nil)
	mismatched.Set("Mcp-Method", "tools/call")
	status, _, payload = post(url, listing, mismatched)
	fmt.Printf("  header mismatch: HTTP %d, code=%v\n", status, dig(payload, "error", "code"))

	future := makeRequest(3, "tools/list", nil, "2027-01-01")
	status, _, payload = post(url, future, httpHeadersFor(future, "http://localhost", nil))
	fmt.Printf("  unsupported version: HTTP %d, code=%v\n", status, dig(payload, "error", "code"))

	notification := makeRequest(4, "tools/list", nil, protocolVersion)
	delete(notification, "id")
	status, _, payload = post(url, notification, httpHeadersFor(notification, "http://localhost", nil))
	fmt.Printf("  accepted notification: HTTP %d, empty-body=%s\n", status, pyBool(payload == ""))

	for _, method := range []string{"GET", "DELETE"} {
		req, err := http.NewRequest(method, url, nil)
		if err != nil {
			panic(err)
		}
		req.Header.Set("Origin", "http://localhost")
		resp, err := client.Do(req)
		if err != nil {
			panic(err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode >= 400 {
			fmt.Printf("  %s: HTTP %d\n", method, resp.StatusCode)
		}
	}

	listen := makeRequest("listen-1", "subscriptions/listen", obj{"notifications": obj{"toolsListChanged": true}}, protocolVersion)
	status, _, stream := post(url, listen, httpHeadersFor(listen, "http://localhost", nil))
	text, _ := stream.(string)
	fmt.Printf("  subscriptions/listen: HTTP %d, SSE=%s, tagged=%s\n", status,
		pyBool(strings.Contains(text, "notifications/subscriptions/acknowledged")),
		pyBool(strings.Contains(text, subscriptionIDKey)))

	if err := srv.Close(); err != nil {
		panic(err)
	}
}

func main() {
	serveMode := false
	for _, a := range os.Args[1:] {
		if a == "--serve" {
			serveMode = true
		}
	}
	if !serveMode {
		probe()
		return
	}
	srv, _ := serve("127.0.0.1:8017")
	fmt.Println("MCP 2026-07-28 endpoint: http://127.0.0.1:8017/mcp")
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt)
	<-stop
	if err := srv.Close(); err != nil {
		panic(err)
	}
}
