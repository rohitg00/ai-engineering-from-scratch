// Lesson: Model Context Protocol (MCP) (phase 11 / lesson 14)
// Go port of code/main.py. Go standard library only.
// Source: phases/11-llm-engineering/14-model-context-protocol/docs/en.md
// Run: go run code/main.go

package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
)

const (
	protocolVersion       = "2026-07-28"
	protocolKey           = "io.modelcontextprotocol/protocolVersion"
	clientCapabilitiesKey = "io.modelcontextprotocol/clientCapabilities"
	clientInfoKey         = "io.modelcontextprotocol/clientInfo"
	serverInfoKey         = "io.modelcontextprotocol/serverInfo"
)

var supportedVersions = []string{protocolVersion}

type Obj = map[string]any

type kv struct {
	key   string
	value any
}

type ordered []kv

type Tool struct {
	Name        string
	Description string
	InputSchema Obj
	Params      []string
	Handler     func(args Obj) (any, error)
	Destructive bool
}

type Resource struct {
	URI         string
	Name        string
	Description string
	Handler     func() (any, error)
}

type Prompt struct {
	Name        string
	Description string
	Arguments   []string
	Handler     func(args Obj) (any, error)
}

func pyDumps(value any) string {
	switch v := value.(type) {
	case nil:
		return "null"
	case ordered:
		parts := make([]string, len(v))
		for i, item := range v {
			parts[i] = pyDumps(item.key) + ": " + pyDumps(item.value)
		}
		return "{" + strings.Join(parts, ", ") + "}"
	case Obj:
		keys := make([]string, 0, len(v))
		for k := range v {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, len(keys))
		for i, k := range keys {
			parts[i] = pyDumps(k) + ": " + pyDumps(v[k])
		}
		return "{" + strings.Join(parts, ", ") + "}"
	case []any:
		parts := make([]string, len(v))
		for i, item := range v {
			parts[i] = pyDumps(item)
		}
		return "[" + strings.Join(parts, ", ") + "]"
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return "null"
		}
		return string(b)
	}
}

func checkKwargs(params []string, args Obj) error {
	for key := range args {
		found := false
		for _, p := range params {
			if p == key {
				found = true
				break
			}
		}
		if !found {
			return fmt.Errorf("unexpected keyword argument '%s'", key)
		}
	}
	for _, p := range params {
		if _, ok := args[p]; !ok {
			return fmt.Errorf("missing required argument: '%s'", p)
		}
	}
	return nil
}

func asInt(v any) (int, error) {
	switch n := v.(type) {
	case int:
		return n, nil
	case float64:
		if n == float64(int(n)) {
			return int(n), nil
		}
	}
	return 0, errors.New("expected integer")
}

func requestMetadata() Obj {
	return Obj{
		protocolKey:           protocolVersion,
		clientCapabilitiesKey: Obj{},
		clientInfoKey:         Obj{"name": "demo-client", "version": "1.0.0"},
	}
}

type MCPServer struct {
	Name       string
	ServerInfo Obj
	Tools      map[string]Tool
	Resources  map[string]Resource
	Prompts    map[string]Prompt
}

func NewMCPServer(name string) *MCPServer {
	return &MCPServer{
		Name:       name,
		ServerInfo: Obj{"name": name, "version": "0.2.0"},
		Tools:      map[string]Tool{},
		Resources:  map[string]Resource{},
		Prompts:    map[string]Prompt{},
	}
}

func (s *MCPServer) Tool(t Tool) { s.Tools[t.Name] = t }

func (s *MCPServer) Resource(r Resource) { s.Resources[r.URI] = r }

func (s *MCPServer) Prompt(p Prompt) { s.Prompts[p.Name] = p }

func (s *MCPServer) capabilities() Obj {
	return Obj{"tools": Obj{}, "resources": Obj{}, "prompts": Obj{}}
}

func (s *MCPServer) complete(payload Obj, cacheable bool) Obj {
	result := Obj{"resultType": "complete"}
	for k, v := range payload {
		result[k] = v
	}
	result["_meta"] = Obj{serverInfoKey: s.ServerInfo}
	if cacheable {
		result["ttlMs"] = 30000
		result["cacheScope"] = "private"
	}
	return result
}

func rpcError(requestID any, code int, message string, data any) Obj {
	e := Obj{"code": code, "message": message}
	if data != nil {
		e["data"] = data
	}
	return Obj{"jsonrpc": "2.0", "id": requestID, "error": e}
}

func isIDType(v any) bool {
	switch v.(type) {
	case string, int:
		return true
	}
	return false
}

func (s *MCPServer) validateMetadata(params Obj, requestID any) Obj {
	metadata, ok := params["_meta"].(Obj)
	if !ok {
		return rpcError(requestID, -32602, "params._meta is required", nil)
	}
	raw, present := metadata[protocolKey]
	if !present {
		return rpcError(requestID, -32602, protocolKey+" is required", nil)
	}
	version, ok := raw.(string)
	if !ok {
		return rpcError(requestID, -32602, protocolKey+" must be a string", nil)
	}
	supported := false
	for _, v := range supportedVersions {
		if v == version {
			supported = true
		}
	}
	if !supported {
		list := make([]any, len(supportedVersions))
		for i, v := range supportedVersions {
			list[i] = v
		}
		return rpcError(requestID, -32022, "Unsupported protocol version", Obj{"supported": list, "requested": version})
	}
	if _, ok := metadata[clientCapabilitiesKey].(Obj); !ok {
		return rpcError(requestID, -32602, "clientCapabilities must be an object", nil)
	}
	if info, present := metadata[clientInfoKey]; present && info != nil {
		m, ok := info.(Obj)
		_, nameOK := m["name"].(string)
		_, versionOK := m["version"].(string)
		if !ok || !nameOK || !versionOK {
			return rpcError(requestID, -32602, "clientInfo must contain name and version", nil)
		}
	}
	return nil
}

func sortedKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

func argsOf(params Obj) (Obj, bool) {
	raw, present := params["arguments"]
	if !present {
		return Obj{}, true
	}
	m, ok := raw.(Obj)
	return m, ok
}

func (s *MCPServer) Handle(message any) Obj {
	msg, ok := message.(Obj)
	if !ok {
		return rpcError(nil, -32600, "request must be an object", nil)
	}
	requestID, hasID := msg["id"]
	if !hasID {
		return nil
	}
	method, methodOK := msg["method"].(string)
	if msg["jsonrpc"] != "2.0" || !methodOK {
		var errorID any
		if isIDType(requestID) {
			errorID = requestID
		}
		return rpcError(errorID, -32600, "invalid JSON-RPC request", nil)
	}
	if !isIDType(requestID) {
		return rpcError(nil, -32600, "id must be a string or integer", nil)
	}
	params := Obj{}
	if raw, present := msg["params"]; present {
		p, ok := raw.(Obj)
		if !ok {
			return rpcError(requestID, -32602, "params must be an object", nil)
		}
		params = p
	}
	if metadataError := s.validateMetadata(params, requestID); metadataError != nil {
		return metadataError
	}

	var result Obj
	switch method {
	case "server/discover":
		result = s.complete(Obj{
			"supportedVersions": []any{protocolVersion},
			"capabilities":      s.capabilities(),
			"instructions":      "Use add for arithmetic and request approval before delete_user.",
		}, true)
	case "tools/list":
		tools := []any{}
		for _, name := range sortedKeys(s.Tools) {
			t := s.Tools[name]
			annotations := Obj{}
			if t.Destructive {
				annotations["destructiveHint"] = true
			}
			tools = append(tools, Obj{
				"name":        t.Name,
				"description": t.Description,
				"inputSchema": t.InputSchema,
				"annotations": annotations,
			})
		}
		result = s.complete(Obj{"tools": tools}, true)
	case "tools/call":
		name, ok := params["name"].(string)
		tool, exists := s.Tools[name]
		if !ok || !exists {
			return rpcError(requestID, -32602, "missing or unknown tool name", nil)
		}
		arguments, ok := argsOf(params)
		if !ok {
			return rpcError(requestID, -32602, "arguments must be an object", nil)
		}
		if err := checkKwargs(tool.Params, arguments); err != nil {
			return rpcError(requestID, -32603, "tool handler failed", nil)
		}
		value, err := tool.Handler(arguments)
		if err != nil {
			return rpcError(requestID, -32603, "tool handler failed", nil)
		}
		result = s.complete(Obj{
			"content": []any{Obj{"type": "text", "text": pyDumps(value)}},
			"isError": false,
		}, false)
	case "resources/list":
		resources := []any{}
		for _, uri := range sortedKeys(s.Resources) {
			r := s.Resources[uri]
			resources = append(resources, Obj{"uri": r.URI, "name": r.Name, "description": r.Description})
		}
		result = s.complete(Obj{"resources": resources}, true)
	case "resources/read":
		uri, ok := params["uri"].(string)
		resource, exists := s.Resources[uri]
		if !ok || !exists {
			return rpcError(requestID, -32602, "missing or unknown resource URI", nil)
		}
		value, err := resource.Handler()
		text, isText := value.(string)
		if err != nil || !isText {
			return rpcError(requestID, -32603, "resource handler failed", nil)
		}
		result = s.complete(Obj{
			"contents": []any{Obj{"uri": resource.URI, "mimeType": "text/plain", "text": text}},
		}, true)
	case "prompts/list":
		prompts := []any{}
		for _, name := range sortedKeys(s.Prompts) {
			p := s.Prompts[name]
			arguments := []any{}
			for _, a := range p.Arguments {
				arguments = append(arguments, Obj{"name": a, "required": true})
			}
			prompts = append(prompts, Obj{"name": p.Name, "description": p.Description, "arguments": arguments})
		}
		result = s.complete(Obj{"prompts": prompts}, true)
	case "prompts/get":
		name, ok := params["name"].(string)
		prompt, exists := s.Prompts[name]
		if !ok || !exists {
			return rpcError(requestID, -32602, "missing or unknown prompt name", nil)
		}
		arguments, ok := argsOf(params)
		if !ok {
			return rpcError(requestID, -32602, "arguments must be an object", nil)
		}
		if err := checkKwargs(prompt.Arguments, arguments); err != nil {
			return rpcError(requestID, -32603, "prompt handler failed", nil)
		}
		value, err := prompt.Handler(arguments)
		rendered, isText := value.(string)
		if err != nil || !isText {
			return rpcError(requestID, -32603, "prompt handler failed", nil)
		}
		result = s.complete(Obj{
			"messages": []any{Obj{"role": "user", "content": Obj{"type": "text", "text": rendered}}},
		}, false)
	default:
		return rpcError(requestID, -32601, "unknown method: "+method, nil)
	}
	return Obj{"jsonrpc": "2.0", "id": requestID, "result": result}
}

type MCPClient struct {
	server *MCPServer
	id     int
}

func (c *MCPClient) Request(method string, params Obj) (Obj, error) {
	c.id++
	requestParams := Obj{}
	for k, v := range params {
		requestParams[k] = v
	}
	requestParams["_meta"] = requestMetadata()
	response := c.server.Handle(Obj{"jsonrpc": "2.0", "id": c.id, "method": method, "params": requestParams})
	if response == nil {
		return nil, errors.New("request did not receive a response")
	}
	if e, ok := response["error"].(Obj); ok {
		return nil, errors.New(e["message"].(string))
	}
	return response["result"].(Obj), nil
}

func buildServer() *MCPServer {
	server := NewMCPServer("demo-server")
	server.Tool(Tool{
		Name:        "add",
		Description: "Add two integers and return the sum.",
		InputSchema: Obj{
			"type":       "object",
			"properties": Obj{"a": Obj{"type": "integer"}, "b": Obj{"type": "integer"}},
			"required":   []any{"a", "b"},
		},
		Params: []string{"a", "b"},
		Handler: func(args Obj) (any, error) {
			a, err := asInt(args["a"])
			if err != nil {
				return nil, err
			}
			b, err := asInt(args["b"])
			if err != nil {
				return nil, err
			}
			return ordered{{"sum", a + b}}, nil
		},
	})
	server.Tool(Tool{
		Name:        "delete_user",
		Description: "Delete a user by id. Mutating; requires approval.",
		InputSchema: Obj{
			"type":       "object",
			"properties": Obj{"user_id": Obj{"type": "integer"}},
			"required":   []any{"user_id"},
		},
		Params: []string{"user_id"},
		Handler: func(args Obj) (any, error) {
			return ordered{{"deleted", args["user_id"]}, {"note", "simulated"}}, nil
		},
		Destructive: true,
	})
	server.Resource(Resource{
		URI:         "config://app",
		Name:        "app-config",
		Description: "Application config as JSON text.",
		Handler: func() (any, error) {
			return pyDumps(ordered{{"env", "prod"}, {"region", "us-east-1"}}), nil
		},
	})
	server.Prompt(Prompt{
		Name:        "code_review",
		Description: "Review code in a language.",
		Arguments:   []string{"language", "code"},
		Handler: func(args Obj) (any, error) {
			return fmt.Sprintf("You are a senior %v reviewer. Review for correctness and style:\n\n%v", args["language"], args["code"]), nil
		},
	})
	return server
}

func must(result Obj, err error) Obj {
	if err != nil {
		panic(err)
	}
	return result
}

func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func main() {
	client := &MCPClient{server: buildServer()}
	discovery := must(client.Request("server/discover", nil))
	info := discovery["_meta"].(Obj)[serverInfoKey].(Obj)
	fmt.Printf("Discovered %v (protocol %v)\n", info["name"], discovery["supportedVersions"].([]any)[0])

	tools := must(client.Request("tools/list", nil))["tools"].([]any)
	fmt.Printf("\n%d tool(s) discovered:\n", len(tools))
	for _, raw := range tools {
		tool := raw.(Obj)
		flag := ""
		if hint, _ := tool["annotations"].(Obj)["destructiveHint"].(bool); hint {
			flag = " [destructive]"
		}
		fmt.Printf("  - %v%s: %v\n", tool["name"], flag, tool["description"])
	}

	addResult := must(client.Request("tools/call", Obj{"name": "add", "arguments": Obj{"a": 40, "b": 2}}))
	fmt.Println("\nCall add(40, 2) ->", addResult["content"].([]any)[0].(Obj)["text"])

	resources := must(client.Request("resources/list", nil))["resources"].([]any)
	fmt.Printf("\n%d resource(s): %v\n", len(resources), resources[0].(Obj)["uri"])
	config := must(client.Request("resources/read", Obj{"uri": "config://app"}))
	fmt.Println("Read config://app ->", config["contents"].([]any)[0].(Obj)["text"])

	prompt := must(client.Request("prompts/get", Obj{
		"name":      "code_review",
		"arguments": Obj{"language": "Python", "code": "x = 1\n"},
	}))
	text := prompt["messages"].([]any)[0].(Obj)["content"].(Obj)["text"].(string)
	fmt.Println("\nRender code_review prompt ->", truncateRunes(text, 80))
}
