// Lesson: A2A: Agent-to-Agent Protocol (phase 13 / lesson 19)
// Go port of code/main.py. Go standard library only.
// Source: phases/13-tools-and-protocols/19-a2a-protocol/docs/en.md
// Run: go run code/main.go

package main

import (
	"bytes"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
)

const a2aVersion = "1.0"

type agentInterface struct {
	URL             string `json:"url"`
	ProtocolBinding string `json:"protocolBinding"`
	ProtocolVersion string `json:"protocolVersion"`
}

type agentSkill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	InputModes  []string `json:"inputModes"`
	OutputModes []string `json:"outputModes"`
}

type agentCard struct {
	Name                string           `json:"name"`
	Description         string           `json:"description"`
	Version             string           `json:"version"`
	SupportedInterfaces []agentInterface `json:"supportedInterfaces"`
	Capabilities        map[string]bool  `json:"capabilities"`
	DefaultInputModes   []string         `json:"defaultInputModes"`
	DefaultOutputModes  []string         `json:"defaultOutputModes"`
	Skills              []agentSkill     `json:"skills"`
}

var writerAgentCard = agentCard{
	Name:        "writer-agent",
	Description: "Drafts technical summaries and reports from source material.",
	Version:     "1.0.0",
	SupportedInterfaces: []agentInterface{
		{URL: "https://writer.example.com/a2a", ProtocolBinding: "JSONRPC", ProtocolVersion: a2aVersion},
	},
	Capabilities:       map[string]bool{"streaming": true, "pushNotifications": false},
	DefaultInputModes:  []string{"text/plain"},
	DefaultOutputModes: []string{"text/markdown"},
	Skills: []agentSkill{
		{
			ID:          "draft_report",
			Name:        "Draft report",
			Description: "Given source material and a target length, produce a report.",
			Tags:        []string{"writing", "summarization"},
			InputModes:  []string{"text/plain", "application/pdf", "application/json"},
			OutputModes: []string{"text/markdown"},
		},
	},
}

type part struct {
	Text      *string        `json:"text,omitempty"`
	Raw       *string        `json:"raw,omitempty"`
	URL       *string        `json:"url,omitempty"`
	Data      map[string]any `json:"data,omitempty"`
	Filename  string         `json:"filename,omitempty"`
	MediaType string         `json:"mediaType,omitempty"`
}

func partContent(p part) string {
	var present []string
	if p.Text != nil {
		present = append(present, "text")
	}
	if p.Raw != nil {
		present = append(present, "raw")
	}
	if p.URL != nil {
		present = append(present, "url")
	}
	if p.Data != nil {
		present = append(present, "data")
	}
	if len(present) != 1 {
		panic(fmt.Sprintf("a Part holds exactly one of text, raw, url, data; got %v", present))
	}
	return present[0]
}

type message struct {
	MessageID string `json:"messageId"`
	Role      string `json:"role"`
	Parts     []part `json:"parts"`
	TaskID    string `json:"taskId,omitempty"`
}

type taskStatus struct {
	State   string   `json:"state"`
	Message *message `json:"message,omitempty"`
}

type artifact struct {
	ArtifactID string `json:"artifactId"`
	Name       string `json:"name"`
	Parts      []part `json:"parts"`
}

type task struct {
	ID        string     `json:"id"`
	ContextID string     `json:"contextId"`
	Status    taskStatus `json:"status"`
	Artifacts []artifact `json:"artifacts"`
	History   []message  `json:"history"`
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type rpcRequest struct {
	JSONRPC string `json:"jsonrpc"`
	ID      int    `json:"id"`
	Method  string `json:"method"`
	Params  struct {
		Message message `json:"message"`
	} `json:"params"`
}

type sendResult struct {
	Task task `json:"task"`
}

type rpcResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      int         `json:"id"`
	Result  *sendResult `json:"result,omitempty"`
	Error   *rpcError   `json:"error,omitempty"`
}

func str(s string) *string { return &s }

func uuid4() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	b[6] = b[6]&0x0f | 0x40
	b[8] = b[8]&0x3f | 0x80
	h := hex.EncodeToString(b)
	return h[0:8] + "-" + h[8:12] + "-" + h[12:16] + "-" + h[16:20] + "-" + h[20:]
}

func newMessage(role string, parts []part, taskID string) message {
	return message{MessageID: uuid4(), Role: role, Parts: parts, TaskID: taskID}
}

type writer struct {
	mu    sync.Mutex
	store map[string]*task
}

func transition(t *task, state string, msg *message) {
	fmt.Printf("    WRITER  : %s -> %s\n", t.Status.State, state)
	t.Status = taskStatus{State: state}
	if msg != nil {
		t.Status.Message = msg
		t.History = append(t.History, *msg)
	}
}

func pyStr(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case nil:
		return "None"
	case bool:
		if x {
			return "True"
		}
		return "False"
	case float64:
		if x == float64(int64(x)) {
			return strconv.FormatInt(int64(x), 10)
		}
		return strconv.FormatFloat(x, 'g', -1, 64)
	}
	data, _ := json.Marshal(v)
	return string(data)
}

func finish(t *task, length string) {
	text := fmt.Sprintf("[writer agent] %s summary of provided source: "+
		"topic identified, key points extracted, conclusion drafted.", length)
	t.Artifacts = append(t.Artifacts, artifact{
		ArtifactID: uuid4(),
		Name:       "summary",
		Parts:      []part{{Text: str(text), MediaType: "text/markdown"}},
	})
	transition(t, "TASK_STATE_COMPLETED", nil)
}

func (w *writer) hasTask(id string) bool {
	if id == "" {
		return true
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	_, ok := w.store[id]
	return ok
}

func (w *writer) sendMessage(msg message) task {
	w.mu.Lock()
	defer w.mu.Unlock()
	var t *task
	if msg.TaskID != "" {
		t = w.store[msg.TaskID]
	} else {
		t = &task{
			ID:        "task_" + strings.ReplaceAll(uuid4(), "-", "")[:10],
			ContextID: uuid4(),
			Status:    taskStatus{State: "TASK_STATE_SUBMITTED"},
			Artifacts: []artifact{},
			History:   []message{},
		}
		w.store[t.ID] = t
		fmt.Printf("    WRITER  : created task %s\n", t.ID)
	}
	t.History = append(t.History, msg)
	transition(t, "TASK_STATE_WORKING", nil)
	var dataPayloads []map[string]any
	for _, p := range msg.Parts {
		if partContent(p) == "data" {
			dataPayloads = append(dataPayloads, p.Data)
		}
	}
	var length any
	ok := false
	if len(dataPayloads) > 0 {
		length, ok = dataPayloads[0]["targetLength"]
	}
	if !ok {
		ask := newMessage("ROLE_AGENT", []part{{Text: str("Please specify targetLength as a data part.")}}, t.ID)
		transition(t, "TASK_STATE_INPUT_REQUIRED", &ask)
	} else {
		finish(t, pyStr(length))
	}
	return *t
}

func (w *writer) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	var req rpcRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(rw, err.Error(), http.StatusBadRequest)
		return
	}
	resp := rpcResponse{JSONRPC: "2.0", ID: req.ID}
	switch {
	case r.Header.Get("A2A-Version") != a2aVersion:
		resp.Error = &rpcError{Code: -32009, Message: "Version not supported"}
	case req.Method != "SendMessage":
		resp.Error = &rpcError{Code: -32601, Message: "Method not found"}
	case !w.hasTask(req.Params.Message.TaskID):
		resp.Error = &rpcError{Code: -32001, Message: "Task not found"}
	default:
		resp.Result = &sendResult{Task: w.sendMessage(req.Params.Message)}
	}
	rw.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(rw).Encode(resp); err != nil {
		panic(err)
	}
}

func sendMessage(endpoint string, requestID int, msg message) task {
	req := rpcRequest{JSONRPC: "2.0", ID: requestID, Method: "SendMessage"}
	req.Params.Message = msg
	body, err := json.Marshal(req)
	if err != nil {
		panic(err)
	}
	fmt.Printf("  research : %s (A2A-Version: %s)\n", req.Method, a2aVersion)
	httpReq, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		panic(err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("A2A-Version", a2aVersion)
	httpResp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		panic(err)
	}
	defer httpResp.Body.Close()
	var resp rpcResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&resp); err != nil {
		panic(err)
	}
	if resp.Error != nil {
		panic(fmt.Sprintf("rpc error %d: %s", resp.Error.Code, resp.Error.Message))
	}
	return resp.Result.Task
}

func researchAgentFlow(endpoint string) {
	bar := strings.Repeat("=", 72)
	fmt.Println(bar)
	fmt.Println("PHASE 13 LESSON 18 - A2A CALL FROM RESEARCH TO WRITER")
	fmt.Println(bar)

	fmt.Println("\n--- research agent fetches writer Agent Card ---")
	view := struct {
		Name                string           `json:"name"`
		SupportedInterfaces []agentInterface `json:"supportedInterfaces"`
		Skills              []agentSkill     `json:"skills"`
	}{writerAgentCard.Name, writerAgentCard.SupportedInterfaces, writerAgentCard.Skills}
	out, err := json.MarshalIndent(view, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Println(string(out))

	skillID := writerAgentCard.Skills[0].ID
	fmt.Printf("\n  research agent will invoke skill: %s\n", skillID)

	msg := newMessage("ROLE_USER", []part{
		{Text: str("Summarize the attached paper.")},
		{Raw: str(base64.StdEncoding.EncodeToString([]byte("fake-pdf"))), Filename: "paper.pdf", MediaType: "application/pdf"},
	}, "")
	t := sendMessage(endpoint, 1, msg)
	fmt.Printf("  research : task state = %s\n", t.Status.State)

	if t.Status.State == "TASK_STATE_INPUT_REQUIRED" {
		fmt.Println("\n--- research agent supplies the missing data ---")
		followup := newMessage("ROLE_USER", []part{
			{Data: map[string]any{"targetLength": "3 paragraphs"}, MediaType: "application/json"},
		}, t.ID)
		t = sendMessage(endpoint, 2, followup)
		fmt.Printf("  research : task state = %s\n", t.Status.State)
	}

	fmt.Println("\n--- research agent reads artifact ---")
	if len(t.Artifacts) > 0 {
		a := t.Artifacts[0]
		fmt.Printf("  name      : %s\n", a.Name)
		fmt.Printf("  mediaType : %s\n", a.Parts[0].MediaType)
		fmt.Printf("  content   : %s\n", *a.Parts[0].Text)
	}

	fmt.Println("\n--- lifecycle observation ---")
	fmt.Printf("  final state : %s\n", t.Status.State)
	fmt.Printf("  history     : %d\n", len(t.History))
}

func main() {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	srv := &http.Server{Handler: &writer{store: map[string]*task{}}}
	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			panic(err)
		}
	}()
	researchAgentFlow("http://" + ln.Addr().String() + "/a2a")
	if err := srv.Close(); err != nil {
		panic(err)
	}
}
