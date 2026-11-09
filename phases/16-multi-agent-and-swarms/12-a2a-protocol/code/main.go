// Lesson: A2A Protocol (phase 16 / lesson 12)
// Go port of code/main.py. Go standard library only.
// Source: phases/16-multi-agent-and-swarms/12-a2a-protocol/docs/en.md
// Run: go run code/main.go

package main

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const a2aVersion = "1.0"
const a2aMediaType = "application/a2a+json"

var terminalStates = []string{"TASK_STATE_COMPLETED", "TASK_STATE_FAILED", "TASK_STATE_CANCELED", "TASK_STATE_REJECTED"}

type Interface struct {
	URL             string `json:"url"`
	ProtocolBinding string `json:"protocolBinding"`
	ProtocolVersion string `json:"protocolVersion"`
}

type Capabilities struct {
	Streaming         bool `json:"streaming"`
	PushNotifications bool `json:"pushNotifications"`
}

type Skill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
}

type AgentCard struct {
	Name                 string        `json:"name"`
	Description          string        `json:"description"`
	Version              string        `json:"version"`
	SupportedInterfaces  []Interface   `json:"supportedInterfaces"`
	Capabilities         Capabilities  `json:"capabilities"`
	SecurityRequirements []interface{} `json:"securityRequirements"`
	DefaultInputModes    []string      `json:"defaultInputModes"`
	DefaultOutputModes   []string      `json:"defaultOutputModes"`
	Skills               []Skill       `json:"skills"`
}

func agentCard(baseURL string) AgentCard {
	return AgentCard{
		Name:                 "code-review-agent",
		Description:          "Reviews Python code for missing functions and return statements.",
		Version:              "0.1.0",
		SupportedInterfaces:  []Interface{{URL: baseURL, ProtocolBinding: "HTTP+JSON", ProtocolVersion: a2aVersion}},
		Capabilities:         Capabilities{Streaming: false, PushNotifications: false},
		SecurityRequirements: []interface{}{},
		DefaultInputModes:    []string{"application/json"},
		DefaultOutputModes:   []string{"application/json"},
		Skills: []Skill{{
			ID:          "review-python",
			Name:        "Review Python",
			Description: "Flags Python code with no function definition or no return statement.",
			Tags:        []string{"code-review", "python"},
		}},
	}
}

type Part struct {
	Text      string                 `json:"text,omitempty"`
	Data      map[string]interface{} `json:"data,omitempty"`
	MediaType string                 `json:"mediaType,omitempty"`
}

type Message struct {
	MessageID string `json:"messageId"`
	Role      string `json:"role"`
	Parts     []Part `json:"parts"`
}

type ReviewData struct {
	Issues []string `json:"issues"`
	Lines  int      `json:"lines"`
}

type ArtifactPart struct {
	Data      ReviewData `json:"data"`
	MediaType string     `json:"mediaType"`
}

type Artifact struct {
	ArtifactID string         `json:"artifactId"`
	Name       string         `json:"name"`
	Parts      []ArtifactPart `json:"parts"`
}

type Status struct {
	State   string   `json:"state"`
	Message *Message `json:"message,omitempty"`
}

type Task struct {
	ID        string     `json:"id"`
	ContextID string     `json:"contextId"`
	Status    Status     `json:"status"`
	Artifacts []Artifact `json:"artifacts"`
	History   []Message  `json:"history"`
}

func uuid4() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

type TaskStore struct {
	mu    sync.Mutex
	tasks map[string]*Task
}

func (s *TaskStore) Create(message Message, returnImmediately bool) Task {
	tid := uuid4()[:8]
	task := &Task{
		ID:        tid,
		ContextID: uuid4(),
		Status:    Status{State: "TASK_STATE_SUBMITTED"},
		Artifacts: []Artifact{},
		History:   []Message{message},
	}
	s.mu.Lock()
	s.tasks[tid] = task
	submitted := Task{ID: tid, ContextID: task.ContextID, Status: task.Status}
	s.mu.Unlock()
	done := make(chan struct{})
	go func() {
		s.run(tid)
		close(done)
	}()
	if returnImmediately {
		return submitted
	}
	<-done
	t, _ := s.Get(tid)
	return t
}

func (s *TaskStore) run(tid string) {
	s.mu.Lock()
	s.tasks[tid].Status = Status{State: "TASK_STATE_WORKING"}
	s.mu.Unlock()
	time.Sleep(200 * time.Millisecond)
	s.mu.Lock()
	defer s.mu.Unlock()
	t := s.tasks[tid]
	var data map[string]interface{}
	for _, p := range t.History[0].Parts {
		if p.Data != nil {
			data = p.Data
			break
		}
	}
	code, ok := data["code"].(string)
	if ok {
		issues := []string{}
		if !strings.Contains(code, "return") {
			issues = append(issues, "no return statement")
		}
		if !strings.Contains(code, "def ") {
			issues = append(issues, "no function definition")
		}
		t.Artifacts = []Artifact{{
			ArtifactID: uuid4(),
			Name:       "review",
			Parts:      []ArtifactPart{{Data: ReviewData{Issues: issues, Lines: strings.Count(code, "\n") + 1}, MediaType: "application/json"}},
		}}
		t.Status = Status{State: "TASK_STATE_COMPLETED"}
	} else {
		t.Status = Status{
			State: "TASK_STATE_FAILED",
			Message: &Message{MessageID: uuid4(), Role: "ROLE_AGENT",
				Parts: []Part{{Text: "expected a data part with a 'code' field"}}},
		}
	}
}

func (s *TaskStore) Get(tid string) (Task, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	t, ok := s.tasks[tid]
	if !ok {
		return Task{}, false
	}
	return *t, true
}

var store = &TaskStore{tasks: map[string]*Task{}}

func sendJSON(w http.ResponseWriter, status int, body interface{}, contentType string) {
	data, _ := json.Marshal(body)
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	w.WriteHeader(status)
	w.Write(data)
}

func sendError(w http.ResponseWriter, httpStatus int, rpcStatus, message, reason string) {
	errBody := map[string]interface{}{"code": httpStatus, "status": rpcStatus, "message": message}
	if reason != "" {
		errBody["details"] = []map[string]string{{
			"@type":  "type.googleapis.com/google.rpc.ErrorInfo",
			"reason": reason,
			"domain": "a2a-protocol.org",
		}}
	}
	sendJSON(w, httpStatus, map[string]interface{}{"error": errBody}, a2aMediaType)
}

func versionOK(w http.ResponseWriter, r *http.Request) bool {
	if r.Header.Get("A2A-Version") == a2aVersion {
		return true
	}
	sendError(w, 400, "FAILED_PRECONDITION", "A2A-Version "+a2aVersion+" is required", "VERSION_NOT_SUPPORTED")
	return false
}

type SendRequest struct {
	Message       Message `json:"message"`
	Configuration struct {
		ReturnImmediately bool `json:"returnImmediately"`
	} `json:"configuration"`
}

func handler(baseURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			if r.URL.Path == "/.well-known/agent-card.json" {
				sendJSON(w, 200, agentCard(baseURL), "application/json")
				return
			}
			if strings.HasPrefix(r.URL.Path, "/tasks/") {
				if !versionOK(w, r) {
					return
				}
				tid := strings.SplitN(r.URL.Path, "/tasks/", 2)[1]
				task, ok := store.Get(tid)
				if !ok {
					sendError(w, 404, "NOT_FOUND", "task not found", "TASK_NOT_FOUND")
					return
				}
				sendJSON(w, 200, task, a2aMediaType)
				return
			}
		case http.MethodPost:
			if r.URL.Path == "/message:send" {
				if !versionOK(w, r) {
					return
				}
				raw, _ := io.ReadAll(r.Body)
				var body SendRequest
				if err := json.Unmarshal(raw, &body); err != nil {
					sendError(w, 400, "INVALID_ARGUMENT", "invalid JSON body", "")
					return
				}
				task := store.Create(body.Message, body.Configuration.ReturnImmediately)
				sendJSON(w, 200, map[string]interface{}{"task": task}, a2aMediaType)
				return
			}
		}
		sendError(w, 404, "NOT_FOUND", "route not found", "")
	}
}

func runServer() (*http.Server, string) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	baseURL := fmt.Sprintf("http://localhost:%d", ln.Addr().(*net.TCPAddr).Port)
	server := &http.Server{Handler: handler(baseURL)}
	go server.Serve(ln)
	return server, baseURL
}

func httpJSON(method, url string, body interface{}, out interface{}) {
	var reader io.Reader
	if body != nil {
		data, _ := json.Marshal(body)
		reader = bytes.NewReader(data)
	}
	req, err := http.NewRequest(method, url, reader)
	if err != nil {
		panic(err)
	}
	req.Header.Set("Content-Type", a2aMediaType)
	req.Header.Set("A2A-Version", a2aVersion)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		panic(fmt.Sprintf("HTTP Error %d: %s", resp.StatusCode, raw))
	}
	if err := json.Unmarshal(raw, out); err != nil {
		panic(err)
	}
}

func pyStrList(xs []string) string {
	parts := make([]string, len(xs))
	for i, x := range xs {
		parts[i] = "'" + x + "'"
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

func pyArtifacts(arts []Artifact) string {
	items := []string{}
	for _, a := range arts {
		parts := []string{}
		for _, p := range a.Parts {
			parts = append(parts, fmt.Sprintf("{'data': {'issues': %s, 'lines': %d}, 'mediaType': '%s'}",
				pyStrList(p.Data.Issues), p.Data.Lines, p.MediaType))
		}
		items = append(items, fmt.Sprintf("{'artifactId': '%s', 'name': '%s', 'parts': [%s]}",
			a.ArtifactID, a.Name, strings.Join(parts, ", ")))
	}
	return "[" + strings.Join(items, ", ") + "]"
}

func isTerminal(state string) bool {
	for _, s := range terminalStates {
		if s == state {
			return true
		}
	}
	return false
}

func runClient(baseURL string) {
	fmt.Println("\n[1] discovery: GET /.well-known/agent-card.json")
	var card AgentCard
	httpJSON("GET", baseURL+"/.well-known/agent-card.json", nil, &card)
	iface := card.SupportedInterfaces[0]
	ids := []string{}
	for _, s := range card.Skills {
		ids = append(ids, s.ID)
	}
	fmt.Printf("    name=%s, skills=%s\n", card.Name, pyStrList(ids))
	fmt.Printf("    interface=%s %s at %s\n", iface.ProtocolBinding, iface.ProtocolVersion, iface.URL)

	fmt.Println("\n[2] send message: POST /message:send (returnImmediately)")
	request := map[string]interface{}{
		"message": Message{
			MessageID: uuid4(),
			Role:      "ROLE_USER",
			Parts:     []Part{{Data: map[string]interface{}{"code": "x = 1\nprint(x)\n"}, MediaType: "application/json"}},
		},
		"configuration": map[string]bool{"returnImmediately": true},
	}
	var sent struct {
		Task Task `json:"task"`
	}
	httpJSON("POST", iface.URL+"/message:send", request, &sent)
	tid := sent.Task.ID
	fmt.Printf("    task id=%s, state=%s\n", tid, sent.Task.Status.State)

	fmt.Println("\n[3] poll GET /tasks/{id} until a terminal state")
	for i := 0; i < 10; i++ {
		var task Task
		httpJSON("GET", iface.URL+"/tasks/"+tid, nil, &task)
		state := task.Status.State
		fmt.Printf("    attempt %d: state=%s\n", i+1, state)
		if isTerminal(state) {
			fmt.Printf("    artifacts: %s\n", pyArtifacts(task.Artifacts))
			break
		}
		time.Sleep(100 * time.Millisecond)
	}
}

func main() {
	fmt.Println("A2A minimal protocol demo")
	fmt.Println(strings.Repeat("-", 30))
	server, baseURL := runServer()
	time.Sleep(100 * time.Millisecond)
	func() {
		defer server.Shutdown(context.Background())
		runClient(baseURL)
	}()
	fmt.Println("\nKey insight: discovery + task lifecycle + typed artifact + auth is the A2A surface.")
	fmt.Println("MCP is agent <-> tool (vertical); A2A is agent <-> agent (horizontal). Production uses both.")
}
