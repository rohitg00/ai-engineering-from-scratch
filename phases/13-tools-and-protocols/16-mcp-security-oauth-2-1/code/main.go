// Lesson: MCP Security: OAuth 2.1 Authorization (phase 13 / lesson 16)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/16-mcp-security-oauth-2-1/docs/en.md
// Run: go run code/main.go

package main

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	protocolVersion        = "2026-07-28"
	protocolMeta           = "io.modelcontextprotocol/protocolVersion"
	clientCapabilitiesMeta = "io.modelcontextprotocol/clientCapabilities"
	clientInfoMeta         = "io.modelcontextprotocol/clientInfo"
	serverInfoMeta         = "io.modelcontextprotocol/serverInfo"
	resourceURI            = "https://notes.example.com/mcp"
	resourceMetadataURI    = "https://notes.example.com/.well-known/oauth-protected-resource/mcp"
	issuerURI              = "https://auth.example.com"
	clientMetadataURL      = "https://client.example.com/oauth/metadata.json"
	base64SentinelPrefix   = "=?base64?"
	base64SentinelSuffix   = "?="
)

var forbiddenCIMDSecretFields = []string{"client_secret", "client_secret_expires_at", "private_key", "private_key_jwk", "private_key_pem"}

var privateJWKFields = []string{"d", "p", "q", "dp", "dq", "qi", "oth", "k"}

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

func (o *object) pop(key string) {
	if !o.has(key) {
		return
	}
	delete(o.values, key)
	for i, k := range o.keys {
		if k == key {
			o.keys = append(o.keys[:i], o.keys[i+1:]...)
			break
		}
	}
}

func (o *object) copy() *object {
	c := obj()
	for _, k := range o.keys {
		c.set(k, o.values[k])
	}
	return c
}

func asObject(v any) (*object, bool) {
	o, ok := v.(*object)
	return o, ok && o != nil
}

func serverInfo() *object { return obj("name", "notes-server", "version", "2.0.0") }

func toolDescriptors() []any {
	return []any{
		obj("name", "notes.create", "description", "Create a note.",
			"inputSchema", obj("type", "object", "properties", obj("title", obj("type", "string")), "required", []any{"title"})),
		obj("name", "notes.delete", "description", "Delete a note by identifier.",
			"inputSchema", obj("type", "object", "properties", obj("id", obj("type", "string")), "required", []any{"id"})),
		obj("name", "notes.list", "description", "List notes visible to the principal.",
			"inputSchema", obj("type", "object", "properties", obj())),
	}
}

type token struct {
	value     string
	issuer    string
	audience  string
	subject   string
	clientID  string
	scopes    map[string]bool
	expiresAt time.Time
}

type protocolError struct {
	code       int
	message    string
	data       *object
	httpStatus int
	headers    map[string]string
}

func (e *protocolError) Error() string { return e.message }

func perr(code int, message string, data *object, status int, headers map[string]string) *protocolError {
	if status == 0 {
		status = 400
	}
	return &protocolError{code: code, message: message, data: data, httpStatus: status, headers: headers}
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b
}

func tokenHex(n int) string { return hex.EncodeToString(randomBytes(n)) }

func s256(verifier string) string {
	digest := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(digest[:])
}

func pkcePair() (string, string) {
	verifier := base64.RawURLEncoding.EncodeToString(randomBytes(32))
	return verifier, s256(verifier)
}

func requestMeta() *object {
	return obj(
		protocolMeta, protocolVersion,
		clientCapabilitiesMeta, obj(),
		clientInfoMeta, obj("name", "oauth-lesson-client", "version", "1.0.0"),
	)
}

func printable(value string) bool {
	for _, c := range value {
		if c < 0x20 || c > 0x7e {
			return false
		}
	}
	return true
}

func encodeMCPHeaderValue(value string) string {
	sentinel := strings.HasPrefix(value, base64SentinelPrefix) && strings.HasSuffix(value, base64SentinelSuffix)
	if printable(value) && value == strings.TrimSpace(value) && !sentinel {
		return value
	}
	return base64SentinelPrefix + base64.StdEncoding.EncodeToString([]byte(value)) + base64SentinelSuffix
}

func decodeMCPHeaderValue(value string, present bool) (string, error) {
	if !present {
		return "", perr(-32020, "Mcp-Name header is missing or malformed", nil, 0, nil)
	}
	if strings.HasPrefix(value, base64SentinelPrefix) && strings.HasSuffix(value, base64SentinelSuffix) {
		payload := value[len(base64SentinelPrefix) : len(value)-len(base64SentinelSuffix)]
		raw, err := base64.StdEncoding.DecodeString(payload)
		if err != nil || !utf8.Valid(raw) {
			return "", perr(-32020, "Mcp-Name header has invalid Base64 encoding", nil, 0, nil)
		}
		return string(raw), nil
	}
	if !printable(value) || value != strings.TrimSpace(value) {
		return "", perr(-32020, "Mcp-Name header is not safely encoded", nil, 0, nil)
	}
	return value, nil
}

func makeMCPRequest(requestID int, tool string) (*object, map[string]string) {
	params := obj("name", tool, "arguments", obj(), "_meta", requestMeta())
	body := obj("jsonrpc", "2.0", "id", requestID, "method", "tools/call", "params", params)
	headers := map[string]string{
		"MCP-Protocol-Version": protocolVersion,
		"Mcp-Method":           "tools/call",
		"Mcp-Name":             encodeMCPHeaderValue(tool),
	}
	return body, headers
}

func makeSimpleRequest(method string, requestID int) (*object, map[string]string) {
	body := obj("jsonrpc", "2.0", "id", requestID, "method", method, "params", obj("_meta", requestMeta()))
	return body, map[string]string{"MCP-Protocol-Version": protocolVersion, "Mcp-Method": method}
}

type pendingCode struct {
	clientID    string
	redirectURI string
	subject     string
	scopes      map[string]bool
	challenge   string
	resource    string
	expiresAt   time.Time
}

type authorizationServer struct {
	issuer       string
	supportsCIMD bool
	supportsDCR  bool
	clients      map[string]*object
	pendingCodes map[string]pendingCode
	mu           sync.Mutex
}

func newAuthorizationServer() *authorizationServer {
	return &authorizationServer{
		issuer:       issuerURI,
		supportsCIMD: true,
		supportsDCR:  true,
		clients:      map[string]*object{},
		pendingCodes: map[string]pendingCode{},
	}
}

func (a *authorizationServer) metadata() *object {
	m := obj(
		"issuer", a.issuer,
		"authorization_endpoint", a.issuer+"/authorize",
		"token_endpoint", a.issuer+"/token",
		"code_challenge_methods_supported", []any{"S256"},
		"authorization_response_iss_parameter_supported", true,
		"client_id_metadata_document_supported", a.supportsCIMD,
	)
	if a.supportsDCR {
		m.set("registration_endpoint", a.issuer+"/register")
	}
	return m
}

const redirectError = "redirect_uris entries must be non-empty absolute URIs without fragments"

func validateApplication(metadata *object, requireApplicationType bool) error {
	applicationType, present := metadata.get("application_type"), metadata.has("application_type")
	validType := applicationType == "native" || applicationType == "web"
	if requireApplicationType && !validType {
		return errors.New("application_type must be native or web")
	}
	if present && applicationType != nil && !validType {
		return errors.New("application_type must be native or web")
	}
	redirectURIs, ok := metadata.get("redirect_uris").([]any)
	if !ok || len(redirectURIs) == 0 {
		return errors.New("redirect_uris is required")
	}
	var parsedRedirects []*url.URL
	for _, item := range redirectURIs {
		redirectURI, ok := item.(string)
		if !ok || redirectURI == "" || redirectURI != strings.TrimSpace(redirectURI) || strings.IndexFunc(redirectURI, unicode.IsSpace) >= 0 {
			return errors.New(redirectError)
		}
		parsed, err := url.Parse(redirectURI)
		if err != nil {
			return errors.New(redirectError)
		}
		web := parsed.Scheme == "http" || parsed.Scheme == "https"
		if parsed.Scheme == "" || parsed.Fragment != "" || (web && (parsed.Host == "" || parsed.Hostname() == "")) {
			return errors.New(redirectError)
		}
		parsedRedirects = append(parsedRedirects, parsed)
	}
	if applicationType == "web" {
		for _, parsed := range parsedRedirects {
			host := strings.ToLower(parsed.Hostname())
			if parsed.Scheme != "https" || host == "localhost" || host == "127.0.0.1" {
				return errors.New("web redirect URIs must use remote HTTPS")
			}
		}
	}
	return nil
}

func (a *authorizationServer) enrollCIMD(metadataURL string, document *object) (string, error) {
	if !a.supportsCIMD {
		return "", errors.New("CIMD is not supported")
	}
	parsed, err := url.Parse(metadataURL)
	if err != nil {
		return "", errors.New("CIMD client_id must be an HTTPS URL with a path")
	}
	if parsed.Scheme != "https" || (parsed.Host == "" && parsed.User == nil) || parsed.Path == "" || parsed.Path == "/" {
		return "", errors.New("CIMD client_id must be an HTTPS URL with a path")
	}
	if parsed.User != nil {
		return "", errors.New("CIMD client_id must not contain userinfo")
	}
	if parsed.Fragment != "" {
		return "", errors.New("CIMD client_id must not contain a fragment")
	}
	for _, segment := range strings.Split(parsed.Path, "/") {
		if segment == "." || segment == ".." {
			return "", errors.New("CIMD client_id must not contain dot path segments")
		}
	}
	if document.get("client_id") != metadataURL {
		return "", errors.New("CIMD client_id must equal its metadata URL")
	}
	if name, ok := document.get("client_name").(string); !ok || name == "" {
		return "", errors.New("client_name is required")
	}
	authMethod := document.get("token_endpoint_auth_method")
	method, isString := authMethod.(string)
	if authMethod != nil && !isString {
		return "", errors.New("token_endpoint_auth_method must be a string")
	}
	if isString && strings.HasPrefix(method, "client_secret") {
		return "", errors.New("CIMD must not use shared-secret client authentication")
	}
	for _, field := range forbiddenCIMDSecretFields {
		if document.has(field) {
			return "", errors.New("CIMD must not contain client secrets or private keys")
		}
	}
	if jwks, ok := asObject(document.get("jwks")); ok {
		keys := []any{}
		if jwks.has("keys") {
			keys, _ = jwks.get("keys").([]any)
		}
		for _, key := range keys {
			if k, ok := asObject(key); ok {
				for _, field := range privateJWKFields {
					if k.has(field) {
						return "", errors.New("CIMD jwks must contain public keys only")
					}
				}
			}
		}
	}
	if err := validateApplication(document, false); err != nil {
		return "", err
	}
	client := document.copy()
	client.set("enrollment", "cimd")
	a.clients[metadataURL] = client
	return metadataURL, nil
}

func (a *authorizationServer) dynamicRegister(metadata *object) (string, error) {
	if !a.supportsDCR {
		return "", errors.New("DCR is not supported")
	}
	if err := validateApplication(metadata, true); err != nil {
		return "", err
	}
	clientID := "dcr_" + tokenHex(6)
	client := metadata.copy()
	client.set("enrollment", "dcr-compatibility")
	a.clients[clientID] = client
	return clientID, nil
}

func (a *authorizationServer) authorize(clientID, redirectURI, subject string, scopes map[string]bool, challenge, resource string) (map[string]string, error) {
	client, ok := a.clients[clientID]
	registered := false
	if ok {
		for _, uri := range client.get("redirect_uris").([]any) {
			if uri == redirectURI {
				registered = true
			}
		}
	}
	if !registered {
		return nil, errors.New("unknown client or redirect URI")
	}
	code := "code_" + tokenHex(8)
	copied := map[string]bool{}
	for s := range scopes {
		copied[s] = true
	}
	a.mu.Lock()
	a.pendingCodes[code] = pendingCode{clientID, redirectURI, subject, copied, challenge, resource, time.Now().Add(300 * time.Second)}
	a.mu.Unlock()
	return map[string]string{"code": code, "iss": a.issuer}, nil
}

func (a *authorizationServer) exchange(code, clientID, verifier, redirectURI, resource string) (*token, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	record, ok := a.pendingCodes[code]
	if !ok {
		return nil, errors.New("invalid authorization code")
	}
	if !record.expiresAt.After(time.Now()) {
		delete(a.pendingCodes, code)
		return nil, errors.New("invalid authorization code")
	}
	if record.clientID != clientID {
		return nil, errors.New("client_id mismatch")
	}
	if record.redirectURI != redirectURI {
		return nil, errors.New("redirect_uri mismatch")
	}
	if record.resource != resource {
		return nil, errors.New("resource mismatch")
	}
	if subtle.ConstantTimeCompare([]byte(s256(verifier)), []byte(record.challenge)) != 1 {
		return nil, errors.New("PKCE mismatch")
	}
	delete(a.pendingCodes, code)
	return &token{
		value:     "tok_" + tokenHex(12),
		issuer:    a.issuer,
		audience:  resource,
		subject:   record.subject,
		clientID:  record.clientID,
		scopes:    record.scopes,
		expiresAt: time.Now().Add(3600 * time.Second),
	}, nil
}

type resourceServer struct {
	resource   string
	issuer     string
	scopeOrder []string
	scopes     map[string]string
}

func newResourceServer() *resourceServer {
	return &resourceServer{
		resource:   resourceURI,
		issuer:     issuerURI,
		scopeOrder: []string{"notes.list", "notes.create", "notes.delete"},
		scopes:     map[string]string{"notes.list": "notes:read", "notes.create": "notes:write", "notes.delete": "notes:delete"},
	}
}

func (r *resourceServer) protectedResourceMetadata() *object {
	unique := map[string]bool{}
	for _, v := range r.scopes {
		unique[v] = true
	}
	supported := make([]string, 0, len(unique))
	for v := range unique {
		supported = append(supported, v)
	}
	sort.Strings(supported)
	list := make([]any, len(supported))
	for i, v := range supported {
		list[i] = v
	}
	return obj("resource", r.resource, "authorization_servers", []any{r.issuer}, "scopes_supported", list)
}

func success(requestID any, result *object) *object {
	payload := result.copy()
	if !payload.has("resultType") {
		payload.set("resultType", "complete")
	}
	if !payload.has("_meta") {
		payload.set("_meta", obj())
	}
	payload.get("_meta").(*object).set(serverInfoMeta, serverInfo())
	return obj("jsonrpc", "2.0", "id", requestID, "result", payload)
}

func errorResponse(requestID any, e *protocolError) *object {
	payload := obj("code", e.code, "message", e.message)
	if e.data != nil {
		payload.set("data", e.data)
	}
	return obj("jsonrpc", "2.0", "id", requestID, "error", payload)
}

func validateWire(body *object, headers map[string]string) (*object, error) {
	if body.get("jsonrpc") != "2.0" {
		return nil, perr(-32600, "Invalid Request", nil, 0, nil)
	}
	method, methodOK := body.get("method").(string)
	params, paramsOK := asObject(body.get("params"))
	if !methodOK || !paramsOK {
		return nil, perr(-32600, "Invalid Request", nil, 0, nil)
	}
	meta, ok := asObject(params.get("_meta"))
	if !ok {
		return nil, perr(-32602, "params._meta must be an object", nil, 0, nil)
	}
	requested, ok := meta.get(protocolMeta).(string)
	if !ok {
		return nil, perr(-32602, "protocolVersion must be a string", nil, 0, nil)
	}
	if _, ok := asObject(meta.get(clientCapabilitiesMeta)); !ok {
		return nil, perr(-32602, "clientCapabilities must be an object", nil, 0, nil)
	}
	if v, ok := headers["MCP-Protocol-Version"]; !ok || v != requested {
		return nil, perr(-32020, "MCP-Protocol-Version header mismatch", nil, 0, nil)
	}
	if v, ok := headers["Mcp-Method"]; !ok || v != method {
		return nil, perr(-32020, "Mcp-Method header mismatch", nil, 0, nil)
	}
	if method == "tools/call" || method == "resources/read" || method == "prompts/get" {
		expected := params.get("name")
		switch v := expected.(type) {
		case nil:
			expected = params.get("uri")
		case string:
			if v == "" {
				expected = params.get("uri")
			}
		case bool:
			if !v {
				expected = params.get("uri")
			}
		case float64:
			if v == 0 {
				expected = params.get("uri")
			}
		}
		header, present := headers["Mcp-Name"]
		supplied, err := decodeMCPHeaderValue(header, present)
		if err != nil {
			return nil, err
		}
		if supplied != expected {
			return nil, perr(-32020, "Mcp-Name header mismatch", nil, 0, nil)
		}
	}
	if requested != protocolVersion {
		return nil, perr(-32022, "Unsupported protocol version", obj("supported", []any{protocolVersion}, "requested", requested), 0, nil)
	}
	return params, nil
}

func (r *resourceServer) handle(body *object, headers map[string]string, tok *token, httpMethod string) (int, *object, map[string]string) {
	isNotification := !body.has("id")
	result, err := r.route(body, headers, tok, httpMethod)
	if err != nil {
		var pe *protocolError
		if !errors.As(err, &pe) {
			panic(err)
		}
		responseHeaders := map[string]string{}
		for k, v := range pe.headers {
			responseHeaders[k] = v
		}
		if isNotification {
			return pe.httpStatus, nil, responseHeaders
		}
		return pe.httpStatus, errorResponse(body.get("id"), pe), responseHeaders
	}
	if isNotification {
		return 202, nil, map[string]string{}
	}
	return 200, success(body.get("id"), result), map[string]string{}
}

func (r *resourceServer) route(body *object, headers map[string]string, tok *token, httpMethod string) (*object, error) {
	if httpMethod != "POST" {
		return nil, perr(-32600, "HTTP method not allowed", nil, 405, nil)
	}
	params, err := validateWire(body, headers)
	if err != nil {
		return nil, err
	}
	switch body.get("method") {
	case "server/discover":
		return obj(
			"supportedVersions", []any{protocolVersion},
			"capabilities", obj("tools", obj("listChanged", false)),
			"ttlMs", 60_000,
			"cacheScope", "public",
		), nil
	case "tools/list":
		tools := toolDescriptors()
		sort.SliceStable(tools, func(i, j int) bool {
			return tools[i].(*object).get("name").(string) < tools[j].(*object).get("name").(string)
		})
		return obj("tools", tools, "ttlMs", 60_000, "cacheScope", "public"), nil
	case "tools/call":
		challengeBase := fmt.Sprintf(`Bearer resource_metadata="%s"`, resourceMetadataURI)
		challengeHeaders := map[string]string{"WWW-Authenticate": challengeBase}
		if tok == nil || tok.expiresAt.Before(time.Now()) || tok.issuer != r.issuer || tok.audience != r.resource {
			return nil, perr(-32001, "Unauthorized", obj("reason", "invalid_token"), 401, challengeHeaders)
		}
		name, _ := params.get("name").(string)
		required, ok := r.scopes[name]
		if !ok {
			return nil, perr(-32602, "Unknown tool", obj("name", params.get("name")), 404, nil)
		}
		if !tok.scopes[required] {
			challenge := fmt.Sprintf(`%s, error="insufficient_scope", scope="%s"`, challengeBase, required)
			return nil, perr(-32003, "Insufficient scope", obj("requiredScope", required), 403, map[string]string{"WWW-Authenticate": challenge})
		}
		return obj(
			"content", []any{obj("type", "text", "text", fmt.Sprintf("%s allowed for %s", name, tok.subject))},
			"isError", false,
		), nil
	}
	return nil, perr(-32601, "Method not found", nil, 404, nil)
}

type client struct {
	subject                string
	applicationType        string
	redirectURI            string
	clientIDsByIssuer      map[string]string
	tokensByIssuerResource map[[2]string]*token
	nextRequestID          int
}

func newClient(subject, applicationType string) *client {
	redirect := "https://client.example.com/callback"
	if applicationType == "native" {
		redirect = "http://127.0.0.1:8765/callback"
	}
	return &client{
		subject:                subject,
		applicationType:        applicationType,
		redirectURI:            redirect,
		clientIDsByIssuer:      map[string]string{},
		tokensByIssuerResource: map[[2]string]*token{},
		nextRequestID:          1,
	}
}

func (c *client) clientDocument() *object {
	return obj(
		"client_id", clientMetadataURL,
		"client_name", "OAuth lesson client",
		"application_type", c.applicationType,
		"redirect_uris", []any{c.redirectURI},
		"grant_types", []any{"authorization_code"},
		"response_types", []any{"code"},
	)
}

func (c *client) enroll(auth *authorizationServer) (string, error) {
	metadata := auth.metadata()
	if metadata.get("issuer") != auth.issuer {
		return "", errors.New("authorization metadata issuer mismatch")
	}
	var clientID string
	var err error
	switch {
	case metadata.get("client_id_metadata_document_supported") == true:
		clientID, err = auth.enrollCIMD(clientMetadataURL, c.clientDocument())
	case metadata.has("registration_endpoint") && metadata.get("registration_endpoint") != "":
		fallback := c.clientDocument()
		fallback.pop("client_id")
		clientID, err = auth.dynamicRegister(fallback)
	default:
		err = errors.New("authorization server offers no supported client enrollment")
	}
	if err != nil {
		return "", err
	}
	c.clientIDsByIssuer[auth.issuer] = clientID
	return clientID, nil
}

func (c *client) authorize(auth *authorizationServer, resource string, scopes map[string]bool) (*token, error) {
	clientID, ok := c.clientIDsByIssuer[auth.issuer]
	if !ok {
		var err error
		if clientID, err = c.enroll(auth); err != nil {
			return nil, err
		}
	}
	verifier, challenge := pkcePair()
	response, err := auth.authorize(clientID, c.redirectURI, c.subject, scopes, challenge, resource)
	if err != nil {
		return nil, err
	}
	if response["iss"] != auth.issuer {
		return nil, errors.New("authorization response issuer mismatch")
	}
	tok, err := auth.exchange(response["code"], clientID, verifier, c.redirectURI, resource)
	if err != nil {
		return nil, err
	}
	c.tokensByIssuerResource[[2]string{auth.issuer, resource}] = tok
	return tok, nil
}

func (c *client) callWithStepUp(tool string, server *resourceServer, auth *authorizationServer) (int, *object, map[string]string, error) {
	if server.issuer != auth.issuer {
		return 0, nil, nil, errors.New("protected resource selected a different issuer")
	}
	tok, ok := c.tokensByIssuerResource[[2]string{auth.issuer, server.resource}]
	if !ok {
		var err error
		if tok, err = c.authorize(auth, server.resource, map[string]bool{"notes:read": true}); err != nil {
			return 0, nil, nil, err
		}
	}
	body, headers := makeMCPRequest(c.nextRequestID, tool)
	c.nextRequestID++
	status, response, responseHeaders := server.handle(body, headers, tok, "POST")
	if errObj, ok := asObject(response.get("error")); status == 403 && ok && errObj.get("code") == -32003 {
		challenge := responseHeaders["WWW-Authenticate"]
		_, after, _ := strings.Cut(challenge, `scope="`)
		required, _, _ := strings.Cut(after, `"`)
		scopes := map[string]bool{required: true}
		for s := range tok.scopes {
			scopes[s] = true
		}
		var err error
		if tok, err = c.authorize(auth, server.resource, scopes); err != nil {
			return 0, nil, nil, err
		}
		body, headers = makeMCPRequest(c.nextRequestID, tool)
		c.nextRequestID++
		status, response, responseHeaders = server.handle(body, headers, tok, "POST")
	}
	return status, response, responseHeaders, nil
}

func pyRepr(v any) string {
	switch x := v.(type) {
	case nil:
		return "None"
	case bool:
		if x {
			return "True"
		}
		return "False"
	case string:
		q := "'"
		if strings.Contains(x, "'") && !strings.Contains(x, `"`) {
			q = `"`
		}
		escaped := strings.ReplaceAll(x, `\`, `\\`)
		if q == "'" {
			escaped = strings.ReplaceAll(escaped, "'", `\'`)
		}
		return q + escaped + q
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
		if x == nil {
			return "None"
		}
		parts := make([]string, len(x.keys))
		for i, k := range x.keys {
			parts[i] = pyRepr(k) + ": " + pyRepr(x.values[k])
		}
		return "{" + strings.Join(parts, ", ") + "}"
	}
	return fmt.Sprint(v)
}

func must[T any](value T, err error) T {
	if err != nil {
		panic(err)
	}
	return value
}

func main() {
	auth := newAuthorizationServer()
	server := newResourceServer()
	c := newClient("alice", "native")
	discoverBody, discoverHeaders := makeSimpleRequest("server/discover", 0)
	_, discovery, _ := server.handle(discoverBody, discoverHeaders, nil, "POST")
	fmt.Println("server discovery:", pyRepr(discovery.get("result")))
	listBody, listHeaders := makeSimpleRequest("tools/list", 0)
	_, listing, _ := server.handle(listBody, listHeaders, nil, "POST")
	var names []string
	for _, tool := range listing.get("result").(*object).get("tools").([]any) {
		names = append(names, tool.(*object).get("name").(string))
	}
	fmt.Println("tools:", pyRepr(names))
	fmt.Println("protected resource metadata:", pyRepr(server.protectedResourceMetadata()))
	fmt.Println("CIMD client_id:", must(c.enroll(auth)))
	for _, tool := range []string{"notes.list", "notes.create", "notes.delete"} {
		status, response, _, err := c.callWithStepUp(tool, server, auth)
		if err != nil {
			panic(err)
		}
		var content any
		if result, ok := asObject(response.get("result")); ok {
			content = result.get("content")
		}
		fmt.Println(tool, status, pyRepr(content))
	}
	issuers := make([]string, 0, len(c.clientIDsByIssuer))
	for issuer := range c.clientIDsByIssuer {
		issuers = append(issuers, issuer)
	}
	sort.Strings(issuers)
	fmt.Println("effective client ids by issuer:", pyRepr(issuers))
}
