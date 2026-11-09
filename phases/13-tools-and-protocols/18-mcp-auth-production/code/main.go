// Lesson: MCP Authorization in Production (phase 13 / lesson 18)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/18-mcp-auth-production/docs/en.md
// Run: go run code/main.go

package main

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

func b64url(raw []byte) string { return base64.RawURLEncoding.EncodeToString(raw) }

func b64urlDecode(s string) ([]byte, error) {
	return base64.RawURLEncoding.DecodeString(strings.TrimRight(s, "="))
}

type jwtHeader struct {
	Alg string `json:"alg"`
	Typ string `json:"typ"`
	Kid string `json:"kid"`
}

type jwtClaims struct {
	Iss   string `json:"iss"`
	Sub   string `json:"sub"`
	Aud   string `json:"aud"`
	Azp   string `json:"azp"`
	Scope string `json:"scope"`
	Iat   int64  `json:"iat"`
	Exp   int64  `json:"exp"`
}

func hmacSHA256(secret []byte, message string) []byte {
	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(message))
	return mac.Sum(nil)
}

func compactJSON(v any) []byte {
	out, err := json.Marshal(v)
	if err != nil {
		panic(err)
	}
	return out
}

func jwtSign(payload jwtClaims, kid string, secret []byte) string {
	h := b64url(compactJSON(jwtHeader{Alg: "HS256", Typ: "JWT", Kid: kid}))
	p := b64url(compactJSON(payload))
	return h + "." + p + "." + b64url(hmacSHA256(secret, h+"."+p))
}

func jwtDecode(token string) (map[string]any, map[string]any, string, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return nil, nil, "", errors.New("token must have three parts")
	}
	var header, payload map[string]any
	for i, target := range []*map[string]any{&header, &payload} {
		raw, err := b64urlDecode(parts[i])
		if err != nil {
			return nil, nil, "", err
		}
		if err := json.Unmarshal(raw, target); err != nil {
			return nil, nil, "", err
		}
	}
	return header, payload, parts[2], nil
}

func jwtVerify(token string, secret []byte) bool {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return false
	}
	signature, err := b64urlDecode(parts[2])
	if err != nil {
		return false
	}
	return hmac.Equal(hmacSHA256(secret, parts[0]+"."+parts[1]), signature)
}

func protectedResourceMetadataURL(resource string) (string, error) {
	parsed, err := url.Parse(resource)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.RawQuery != "" || parsed.Fragment != "" {
		return "", errors.New("MCP resource must be an absolute HTTPS URL without query or fragment")
	}
	suffix := parsed.Path
	if suffix == "/" {
		suffix = ""
	}
	return fmt.Sprintf("%s://%s/.well-known/oauth-protected-resource%s", parsed.Scheme, parsed.Host, suffix), nil
}

const (
	mcpResource                   = "https://notes.example.com"
	otherMCPResource              = "https://tasks.example.com"
	defaultToolScope              = "mcp:tools.invoke"
	authorizationCodeTTLInSeconds = 300
)

var toolScopes = map[string]string{
	"notes.list":   "mcp:tools.invoke",
	"notes.read":   "mcp:tools.invoke",
	"notes.delete": "mcp:tools.delete",
	"tasks.list":   "mcp:tools.invoke",
}

func parsedAbsoluteRedirectURI(value any) *url.URL {
	text, ok := value.(string)
	if !ok || text == "" || text != strings.TrimSpace(text) {
		return nil
	}
	for _, c := range text {
		if unicode.IsSpace(c) || c < 0x20 || c == 0x7f {
			return nil
		}
	}
	parsed, err := url.Parse(text)
	if err != nil {
		return nil
	}
	if parsed.Scheme == "" || parsed.Fragment != "" || parsed.User != nil {
		return nil
	}
	if (parsed.Scheme == "http" || parsed.Scheme == "https") && (parsed.Host == "" || parsed.Hostname() == "") {
		return nil
	}
	return parsed
}

func validWebRedirectURI(value any) bool {
	parsed := parsedAbsoluteRedirectURI(value)
	return parsed != nil && parsed.Scheme == "https" && parsed.Hostname() != ""
}

func isASCIIAlnum(c rune) bool {
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9')
}

func validPrivateUseScheme(scheme string) bool {
	labels := strings.Split(scheme, ".")
	if len(labels) < 2 {
		return false
	}
	for _, label := range labels {
		if label == "" {
			return false
		}
		runes := []rune(label)
		if !isASCIIAlnum(runes[0]) || !isASCIIAlnum(runes[len(runes)-1]) {
			return false
		}
		for _, c := range runes {
			if !isASCIIAlnum(c) && c != '-' {
				return false
			}
		}
	}
	return true
}

func validNativeRedirectURI(value any) bool {
	parsed := parsedAbsoluteRedirectURI(value)
	if parsed == nil {
		return false
	}
	switch parsed.Scheme {
	case "https":
		return parsed.Hostname() != ""
	case "http":
		host := strings.ToLower(parsed.Hostname())
		return host == "localhost" || host == "127.0.0.1" || host == "::1"
	}
	return validPrivateUseScheme(parsed.Scheme)
}

func randomBytes(n int) []byte {
	b := make([]byte, n)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return b
}

func tokenURLSafe(n int) string { return b64url(randomBytes(n)) }

type idpKey struct {
	kid      string
	secret   []byte
	issuedAt time.Time
}

type clientRecord struct {
	redirectURIs    []string
	grantTypes      []string
	applicationType string
	clientName      string
	enrollment      string
	tokenHash       string
	issuedAt        time.Time
}

type authorizationCode struct {
	clientID      string
	redirectURI   string
	codeChallenge string
	method        string
	scopes        []string
	resource      string
	user          string
	expiresAt     time.Time
}

type authorizationServer struct {
	issuer  string
	keys    []idpKey
	clients map[string]*clientRecord
	codes   map[string]authorizationCode
	mu      sync.Mutex
}

func newAuthorizationServer() *authorizationServer {
	return &authorizationServer{issuer: "https://auth.example.com", clients: map[string]*clientRecord{}, codes: map[string]authorizationCode{}}
}

func (a *authorizationServer) currentKey() idpKey { return a.keys[len(a.keys)-1] }

func (a *authorizationServer) rotateKey() idpKey {
	key := idpKey{
		kid:      fmt.Sprintf("k_%d_%s", time.Now().Unix(), hex.EncodeToString(randomBytes(2))),
		secret:   randomBytes(32),
		issuedAt: time.Now(),
	}
	a.keys = append(a.keys, key)
	if len(a.keys) > 2 {
		a.keys = a.keys[len(a.keys)-2:]
	}
	return key
}

type jwk struct {
	Kid string `json:"kid"`
	Kty string `json:"kty"`
	Alg string `json:"alg"`
	Use string `json:"use"`
	K   string `json:"k"`
}

func (a *authorizationServer) jwks() []jwk {
	out := make([]jwk, 0, len(a.keys))
	for _, k := range a.keys {
		out = append(out, jwk{Kid: k.kid, Kty: "oct", Alg: "HS256", Use: "sig", K: b64url(k.secret)})
	}
	return out
}

type serverMetadata struct {
	issuer                 string
	codeChallengeMethods   []string
	registrationEndpoint   string
	responseIssSupported   bool
	clientIDMetadataDocSup bool
}

func (a *authorizationServer) metadata() serverMetadata {
	return serverMetadata{
		issuer:                 a.issuer,
		codeChallengeMethods:   []string{"S256"},
		registrationEndpoint:   a.issuer + "/register",
		responseIssSupported:   true,
		clientIDMetadataDocSup: true,
	}
}

type cimdDocument struct {
	clientID        string
	clientName      string
	applicationType *string
	redirectURIs    []any
	grantTypes      []string
}

func checkRedirects(redirectURIs []any, applicationType string) string {
	if len(redirectURIs) == 0 {
		return "absolute"
	}
	for _, uri := range redirectURIs {
		if parsedAbsoluteRedirectURI(uri) == nil {
			return "absolute"
		}
	}
	for _, uri := range redirectURIs {
		if applicationType == "web" && !validWebRedirectURI(uri) {
			return "web"
		}
	}
	for _, uri := range redirectURIs {
		if applicationType == "native" && !validNativeRedirectURI(uri) {
			return "native"
		}
	}
	return ""
}

func stringsOf(items []any) []string {
	out := make([]string, len(items))
	for i, item := range items {
		out[i], _ = item.(string)
	}
	return out
}

func (a *authorizationServer) registerCIMD(documentURL string, doc cimdDocument) (string, error) {
	parsed, err := url.Parse(documentURL)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" || parsed.Path == "" || parsed.Path == "/" {
		return "", errors.New("CIMD client_id must be an absolute HTTPS URL with a path")
	}
	if doc.clientID != documentURL {
		return "", errors.New("CIMD client_id must equal its document URL")
	}
	if strings.TrimSpace(doc.clientName) == "" {
		return "", errors.New("CIMD requires a non-empty client_name")
	}
	applicationType := ""
	if doc.applicationType != nil {
		applicationType = *doc.applicationType
		if applicationType != "native" && applicationType != "web" {
			return "", errors.New("CIMD application_type, when present, must be native or web")
		}
	}
	redirectType := applicationType
	if redirectType == "" {
		redirectType = "native"
	}
	switch checkRedirects(doc.redirectURIs, redirectType) {
	case "absolute":
		return "", errors.New("CIMD requires absolute redirect URIs without fragments")
	case "web":
		return "", errors.New("CIMD web clients require absolute HTTPS redirect URIs with a host and no fragment")
	case "native":
		return "", errors.New("CIMD native clients require HTTPS, a loopback HTTP URI, or a domain-based private-use scheme")
	}
	grantTypes := doc.grantTypes
	if grantTypes == nil {
		grantTypes = []string{"authorization_code"}
	}
	a.clients[documentURL] = &clientRecord{
		redirectURIs:    stringsOf(doc.redirectURIs),
		grantTypes:      grantTypes,
		applicationType: applicationType,
		clientName:      doc.clientName,
		enrollment:      "cimd",
		issuedAt:        time.Now(),
	}
	return documentURL, nil
}

type registration struct {
	status int
	body   map[string]any
}

func (a *authorizationServer) registerClient(redirectURIs []any, applicationType, authMethod, clientName string, grantTypes []string) registration {
	if checkRedirects(redirectURIs, "") == "absolute" {
		return registration{400, map[string]any{"error": "invalid_redirect_uri"}}
	}
	if applicationType != "native" && applicationType != "web" {
		return registration{400, map[string]any{"error": "invalid_client_metadata"}}
	}
	if checkRedirects(redirectURIs, applicationType) != "" {
		return registration{400, map[string]any{"error": "invalid_redirect_uri"}}
	}
	if authMethod != "none" && authMethod != "private_key_jwt" {
		return registration{400, map[string]any{"error": "invalid_client_metadata"}}
	}
	cid := "c_" + hex.EncodeToString(randomBytes(4))
	regToken := tokenURLSafe(24)
	digest := sha256.Sum256([]byte(regToken))
	a.clients[cid] = &clientRecord{
		redirectURIs:    stringsOf(redirectURIs),
		grantTypes:      grantTypes,
		tokenHash:       hex.EncodeToString(digest[:]),
		clientName:      clientName,
		applicationType: applicationType,
		enrollment:      "dcr",
		issuedAt:        time.Now(),
	}
	return registration{201, map[string]any{
		"client_id":                 cid,
		"client_id_issued_at":       time.Now().Unix(),
		"redirect_uris":             redirectURIs,
		"grant_types":               grantTypes,
		"application_type":          applicationType,
		"registration_access_token": regToken,
		"registration_client_uri":   a.issuer + "/register/" + cid,
	}}
}

func (a *authorizationServer) preRegisterClient(clientID string, redirectURIs []string, clientName, applicationType string) (string, error) {
	if clientID == "" || len(redirectURIs) == 0 || strings.TrimSpace(clientName) == "" {
		return "", errors.New("pre-registration requires client_id, client_name, and redirect_uris")
	}
	if applicationType != "native" && applicationType != "web" {
		return "", errors.New("pre-registration application_type must be native or web")
	}
	uris := make([]any, len(redirectURIs))
	for i, u := range redirectURIs {
		uris[i] = u
	}
	switch checkRedirects(uris, applicationType) {
	case "absolute":
		return "", errors.New("pre-registration requires absolute redirect URIs without fragments")
	case "web":
		return "", errors.New("pre-registered web clients require absolute HTTPS redirect URIs with a host and no fragment")
	case "native":
		return "", errors.New("pre-registered native clients require HTTPS redirect URIs, loopback HTTP redirect URIs, or a domain-based private-use scheme")
	}
	a.clients[clientID] = &clientRecord{
		redirectURIs:    append([]string(nil), redirectURIs...),
		grantTypes:      []string{"authorization_code"},
		applicationType: applicationType,
		clientName:      clientName,
		enrollment:      "pre_registered",
		issuedAt:        time.Now(),
	}
	return clientID, nil
}

func sortedScopes(scopes map[string]bool) []string {
	out := make([]string, 0, len(scopes))
	for s := range scopes {
		out = append(out, s)
	}
	sort.Strings(out)
	return out
}

func (a *authorizationServer) beginAuthorization(clientID, redirectURI, codeChallenge, method string, scopes map[string]bool, resource, user string) (map[string]string, error) {
	client, ok := a.clients[clientID]
	if !ok {
		return nil, errors.New("client is not enrolled with this issuer")
	}
	registered := false
	for _, uri := range client.redirectURIs {
		if uri == redirectURI {
			registered = true
		}
	}
	if !registered {
		return nil, errors.New("authorization redirect_uri is not registered")
	}
	if codeChallenge == "" {
		return nil, errors.New("authorization request requires an S256 code_challenge")
	}
	if method != "S256" {
		return nil, errors.New("authorization request requires code_challenge_method S256")
	}
	parsed, err := url.Parse(resource)
	if err != nil || parsed.Scheme != "https" || parsed.Host == "" {
		return nil, errors.New("resource must be an absolute HTTPS URL")
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	for code, record := range a.codes {
		if !record.expiresAt.After(now) {
			delete(a.codes, code)
		}
	}
	code := tokenURLSafe(24)
	for _, taken := a.codes[code]; taken; _, taken = a.codes[code] {
		code = tokenURLSafe(24)
	}
	a.codes[code] = authorizationCode{clientID, redirectURI, codeChallenge, method, sortedScopes(scopes), resource, user, now.Add(authorizationCodeTTLInSeconds * time.Second)}
	return map[string]string{"code": code, "iss": a.issuer}, nil
}

func (a *authorizationServer) redeemCode(code, clientID, redirectURI, verifier, resource string) (string, error) {
	a.mu.Lock()
	record, ok := a.codes[code]
	if !ok {
		a.mu.Unlock()
		return "", errors.New("authorization code is invalid or already used")
	}
	if !record.expiresAt.After(time.Now()) {
		delete(a.codes, code)
		a.mu.Unlock()
		return "", errors.New("authorization code is expired")
	}
	if record.clientID != clientID || record.redirectURI != redirectURI {
		a.mu.Unlock()
		return "", errors.New("authorization code is not bound to this client redirect")
	}
	if record.resource != resource {
		a.mu.Unlock()
		return "", errors.New("token resource does not match the authorization request")
	}
	digest := sha256.Sum256([]byte(verifier))
	if !hmac.Equal([]byte(record.codeChallenge), []byte(b64url(digest[:]))) {
		a.mu.Unlock()
		return "", errors.New("PKCE code_verifier does not match the stored challenge")
	}
	delete(a.codes, code)
	a.mu.Unlock()
	return a.issueToken(record.clientID, record.user, record.scopes, record.resource)
}

func (a *authorizationServer) issueToken(clientID, user string, scopes []string, resource string) (string, error) {
	if _, ok := a.clients[clientID]; !ok {
		return "", errors.New("client is not enrolled with this issuer")
	}
	key := a.currentKey()
	now := time.Now().Unix()
	claims := jwtClaims{Iss: a.issuer, Sub: user, Aud: resource, Azp: clientID, Scope: strings.Join(scopes, " "), Iat: now, Exp: now + 3600}
	return jwtSign(claims, key.kid, key.secret), nil
}

type jwksEntry struct {
	keys      []jwk
	fetchedAt time.Time
}

type resourceServer struct {
	resource       string
	authServer     *authorizationServer
	allowedIssuers []string
	jwksCache      map[string]jwksEntry
}

func (r *resourceServer) refreshJWKS() []string {
	keys := r.authServer.jwks()
	r.jwksCache[r.authServer.issuer] = jwksEntry{keys: keys, fetchedAt: time.Now()}
	kids := make([]string, len(keys))
	for i, k := range keys {
		kids[i] = k.Kid
	}
	return kids
}

func (r *resourceServer) cachedKids() []string {
	entry := r.jwksCache[r.authServer.issuer]
	kids := make([]string, len(entry.keys))
	for i, k := range entry.keys {
		kids[i] = k.Kid
	}
	return kids
}

type validation struct {
	valid           bool
	status          int
	wwwAuthenticate string
	claims          map[string]any
}

func (r *resourceServer) findKey(issuer string, kid any) *jwk {
	entry, ok := r.jwksCache[issuer]
	if !ok {
		return nil
	}
	for i := range entry.keys {
		if entry.keys[i].Kid == kid {
			return &entry.keys[i]
		}
	}
	return nil
}

func (r *resourceServer) validate(token, requiredScope string) validation {
	rm, err := protectedResourceMetadataURL(r.resource)
	if err != nil {
		panic(err)
	}
	challenge := func(status int, params string) validation {
		return validation{valid: false, status: status, wwwAuthenticate: "Bearer " + params}
	}
	header, claims, _, err := jwtDecode(token)
	if err != nil {
		return challenge(401, fmt.Sprintf(`error="invalid_token", error_description="malformed", resource_metadata="%s"`, rm))
	}
	iss, _ := claims["iss"].(string)
	allowed := false
	for _, a := range r.allowedIssuers {
		if a == iss {
			allowed = true
		}
	}
	if !allowed {
		return challenge(401, fmt.Sprintf(`error="invalid_token", error_description="iss not allowed", resource_metadata="%s"`, rm))
	}
	if _, ok := r.jwksCache[iss]; !ok {
		r.refreshJWKS()
	}
	matching := r.findKey(iss, header["kid"])
	if matching == nil {
		r.refreshJWKS()
		matching = r.findKey(iss, header["kid"])
	}
	if matching == nil {
		return challenge(401, fmt.Sprintf(`error="invalid_token", error_description="unknown kid", resource_metadata="%s"`, rm))
	}
	secret, err := b64urlDecode(matching.K)
	if err != nil || !jwtVerify(token, secret) {
		return challenge(401, fmt.Sprintf(`error="invalid_token", error_description="bad signature", resource_metadata="%s"`, rm))
	}
	if claims["aud"] != r.resource {
		return challenge(401, fmt.Sprintf(`error="invalid_token", error_description="audience mismatch", resource_metadata="%s"`, rm))
	}
	exp, _ := claims["exp"].(float64)
	if exp < float64(time.Now().Unix()) {
		return challenge(401, fmt.Sprintf(`error="invalid_token", error_description="expired", resource_metadata="%s"`, rm))
	}
	if requiredScope != "" {
		scope, _ := claims["scope"].(string)
		granted := false
		for _, s := range strings.Fields(scope) {
			if s == requiredScope {
				granted = true
			}
		}
		if !granted {
			return challenge(403, fmt.Sprintf(`error="insufficient_scope", scope="%s", resource_metadata="%s"`, requiredScope, rm))
		}
	}
	return validation{valid: true, claims: claims}
}

type toolResponse struct {
	status int
	www    string
	tool   string
	user   string
}

func (t toolResponse) String() string {
	if t.status != 200 {
		return fmt.Sprintf("{'status': %d, 'WWW-Authenticate': '%s'}", t.status, t.www)
	}
	return fmt.Sprintf("{'status': 200, 'body': {'tool': '%s', 'user': '%s', 'ok': True}}", t.tool, t.user)
}

func (r *resourceServer) callTool(tool, bearer string) toolResponse {
	required, ok := toolScopes[tool]
	if !ok {
		required = defaultToolScope
	}
	result := r.validate(bearer, required)
	if !result.valid {
		return toolResponse{status: result.status, www: result.wwwAuthenticate}
	}
	user, _ := result.claims["sub"].(string)
	return toolResponse{status: 200, tool: tool, user: user}
}

type client struct {
	name                  string
	authServer            *authorizationServer
	clientMetadataURL     string
	clientMetadata        *cimdDocument
	preRegistered         map[string]string
	clientIDsByIssuer     map[string]string
	issuerOrder           []string
	accessTokens          map[[2]string]string
	expectedIssuer        string
	requireResponseIssuer bool
	discovered            bool
}

func (c *client) discover() (serverMetadata, error) {
	meta := c.authServer.metadata()
	if meta.issuer != c.authServer.issuer {
		return meta, errors.New("authorization metadata issuer mismatch")
	}
	hasS256 := false
	for _, m := range meta.codeChallengeMethods {
		if m == "S256" {
			hasS256 = true
		}
	}
	if !hasS256 {
		return meta, errors.New("authorization server does not advertise S256 PKCE")
	}
	if !meta.clientIDMetadataDocSup && meta.registrationEndpoint == "" {
		return meta, errors.New("authorization server advertises no client enrollment path")
	}
	c.expectedIssuer = meta.issuer
	c.discovered = true
	c.requireResponseIssuer = meta.responseIssSupported
	return meta, nil
}

func (c *client) remember(issuer, clientID string) {
	if _, ok := c.clientIDsByIssuer[issuer]; !ok {
		c.issuerOrder = append(c.issuerOrder, issuer)
	}
	c.clientIDsByIssuer[issuer] = clientID
}

func (c *client) register() (string, error) {
	resp := c.authServer.registerClient([]any{"http://127.0.0.1:7333/callback"}, "native", "none", c.name, []string{"authorization_code", "refresh_token"})
	if resp.status != 201 {
		return "", fmt.Errorf("client registration failed: %v", resp)
	}
	clientID := resp.body["client_id"].(string)
	c.remember(c.authServer.issuer, clientID)
	return clientID, nil
}

func (c *client) enroll() (string, error) {
	meta, err := c.discover()
	if err != nil {
		return "", err
	}
	if id, ok := c.clientIDsByIssuer[meta.issuer]; ok {
		return id, nil
	}
	if pre, ok := c.preRegistered[meta.issuer]; ok {
		if _, known := c.authServer.clients[pre]; !known {
			return "", errors.New("pre-registered client_id is not known to this issuer")
		}
		c.remember(meta.issuer, pre)
		return pre, nil
	}
	if meta.clientIDMetadataDocSup {
		if c.clientMetadataURL == "" || c.clientMetadata == nil {
			return "", errors.New("CIMD-capable issuer requires a client metadata document")
		}
		id, err := c.authServer.registerCIMD(c.clientMetadataURL, *c.clientMetadata)
		if err != nil {
			return "", err
		}
		c.remember(meta.issuer, id)
		return id, nil
	}
	return c.register()
}

func (c *client) validateAuthorizationResponseIssuer(returned string, present bool) error {
	if !c.discovered {
		return errors.New("authorization server metadata was not discovered")
	}
	if !present {
		if c.requireResponseIssuer {
			return errors.New("authorization response omitted required iss")
		}
		return nil
	}
	if returned != c.expectedIssuer {
		return errors.New("authorization response issuer mismatch")
	}
	return nil
}

func (c *client) useAuthorizationServer(auth *authorizationServer) {
	c.authServer = auth
	c.expectedIssuer = ""
	c.discovered = false
	c.requireResponseIssuer = false
}

func (c *client) authorize(scopes map[string]bool, resource, user string) (string, error) {
	issuer := c.authServer.issuer
	clientID, ok := c.clientIDsByIssuer[issuer]
	if !ok {
		return "", errors.New("client must enroll separately with this issuer")
	}
	record, ok := c.authServer.clients[clientID]
	if !ok || len(record.redirectURIs) == 0 {
		return "", errors.New("client has no registered redirect URI")
	}
	redirectURI := record.redirectURIs[0]
	verifier := tokenURLSafe(32)
	digest := sha256.Sum256([]byte(verifier))
	response, err := c.authServer.beginAuthorization(clientID, redirectURI, b64url(digest[:]), "S256", scopes, resource, user)
	if err != nil {
		return "", err
	}
	iss, present := response["iss"]
	if err := c.validateAuthorizationResponseIssuer(iss, present); err != nil {
		return "", err
	}
	token, err := c.authServer.redeemCode(response["code"], clientID, redirectURI, verifier, resource)
	if err != nil {
		return "", err
	}
	c.accessTokens[[2]string{issuer, resource}] = token
	return token, nil
}

func quoteList(items []string) string {
	parts := make([]string, len(items))
	for i, item := range items {
		parts[i] = "'" + item + "'"
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

func must[T any](value T, err error) T {
	if err != nil {
		panic(err)
	}
	return value
}

func assert(cond bool) {
	if !cond {
		panic("AssertionError")
	}
}

func main() {
	bar := strings.Repeat("=", 72)
	fmt.Println(bar)
	fmt.Println("PHASE 13 LESSON 18 - MCP AUTH IN PRODUCTION")
	fmt.Println(bar)

	fmt.Println("\n--- step 1: stand up the authorization server (two overlapping keys) ---")
	auth := newAuthorizationServer()
	auth.rotateKey()
	auth.rotateKey()
	kids := []string{}
	for _, k := range auth.keys {
		kids = append(kids, k.kid)
	}
	fmt.Printf("  issuer=%s, keys=%s\n", auth.issuer, quoteList(kids))

	fmt.Println("\n--- step 2: client discovers the authorization server (RFC 8414) ---")
	cimdURL := "https://client.example.com/oauth/client.json"
	c := &client{
		name:              "Example native client",
		authServer:        auth,
		clientMetadataURL: cimdURL,
		clientMetadata: &cimdDocument{
			clientID:     cimdURL,
			clientName:   "Example native client",
			redirectURIs: []any{"http://127.0.0.1:7333/callback"},
			grantTypes:   []string{"authorization_code", "refresh_token"},
		},
		preRegistered:     map[string]string{},
		clientIDsByIssuer: map[string]string{},
		accessTokens:      map[[2]string]string{},
	}
	meta := must(c.discover())
	fmt.Printf("  issuer=%s, S256 PKCE supported\n", meta.issuer)
	fmt.Printf("  CIMD supported=%s\n", map[bool]string{true: "True", false: "False"}[meta.clientIDMetadataDocSup])

	fmt.Println("\n--- step 3: client enrolls through CIMD without DCR ---")
	cid := must(c.enroll())
	fmt.Printf("  client_id metadata URL: %s\n", cid)
	fmt.Printf("  credential cache issuer keys: %s\n", quoteList(c.issuerOrder))

	fmt.Println("\n--- step 4: client runs PKCE authorization flow with resource indicator ---")
	invoke := map[string]bool{"mcp:tools.invoke": true}
	bearer := must(c.authorize(invoke, mcpResource, "alice@example.com"))
	fmt.Printf("  bearer issued (kid=%s, aud=%s)\n", auth.currentKey().kid, mcpResource)

	fmt.Println("\n--- step 5: MCP server validates the request, JWKS cache primed on first use ---")
	server := &resourceServer{resource: mcpResource, authServer: auth, allowedIssuers: []string{auth.issuer}, jwksCache: map[string]jwksEntry{}}
	resp := server.callTool("notes.list", bearer)
	fmt.Printf("  server response: %s\n", resp)
	assert(resp.status == 200)

	fmt.Println("\n--- step 6: IdP rotates a key, scheduled refresh re-pulls the JWKS ---")
	fmt.Printf("  cached kids before refresh: %s\n", quoteList(server.cachedKids()))
	auth.rotateKey()
	server.refreshJWKS()
	fmt.Printf("  cached kids after refresh:  %s\n", quoteList(server.cachedKids()))

	fmt.Println("\n--- step 7: existing token still validates (overlap window) ---")
	resp = server.callTool("notes.list", bearer)
	fmt.Printf("  server response: %s\n", resp)
	assert(resp.status == 200)

	fmt.Println("\n--- step 8: new token signed with new key validates against refreshed JWKS ---")
	fresh := must(c.authorize(invoke, mcpResource, "alice@example.com"))
	freshHeader, _, _, err := jwtDecode(fresh)
	if err != nil {
		panic(err)
	}
	fmt.Printf("  fresh token kid: %v\n", freshHeader["kid"])
	resp = server.callTool("notes.read", fresh)
	fmt.Printf("  server response: %s\n", resp)
	assert(resp.status == 200)

	fmt.Println("\n--- step 9: audience-replay attempt against a different MCP resource ---")
	other := &resourceServer{resource: otherMCPResource, authServer: auth, allowedIssuers: []string{auth.issuer}, jwksCache: map[string]jwksEntry{}}
	resp = other.callTool("tasks.list", bearer)
	fmt.Printf("  other server response: %s\n", resp)
	assert(resp.status == 401)
	assert(strings.Contains(resp.www, "audience mismatch"))

	fmt.Println("\n--- bonus: step-up flow for a higher-privilege scope ---")
	elevated := must(c.authorize(map[string]bool{"mcp:tools.invoke": true, "mcp:tools.delete": true}, mcpResource, "alice@example.com"))
	fmt.Printf("  server response: %s\n", server.callTool("notes.delete", elevated))

	fmt.Println("\n" + bar)
	fmt.Println("DONE - issuer-bound enrollment, response iss, audience, and JWKS refresh")
	fmt.Println(bar)
}
