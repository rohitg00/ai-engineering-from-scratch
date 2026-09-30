package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
)

func main() {
	events := flag.String("events", "", "JSONL event file")
	review := flag.String("review", "", "impact, claims and actions JSON")
	output := flag.String("out", "", "directory for HTML, JSON and text packet")
	flag.Parse()
	raw := []byte("{\"id\":\"e1\",\"second\":0,\"kind\":\"deploy\",\"message\":\"version B started\"}\n{\"id\":\"e2\",\"second\":35,\"kind\":\"alert\",\"message\":\"latency exceeded SLO\"}\n")
	decision := []byte(`{"impact":"Example incident: latency alert; customer impact has not been measured.","claims":[{"text":"An alert followed the deployment; causality is unconfirmed.","evidence":["e1","e2"],"quotes":{"e1":"version B started","e2":"latency exceeded SLO"},"state":"pending","reviewer":""}],"actions":[{"task":"Measure affected requests from access logs","owner":"service-team","state":"open"}]}`)
	var err error
	if (*events == "") != (*review == "") {
		err = ErrInvalid
	}
	if err == nil && *events != "" {
		raw, err = os.ReadFile(*events)
		if err == nil {
			decision, err = os.ReadFile(*review)
		}
	}
	var packet Packet
	if err == nil {
		packet, err = BuildPacket(raw, decision)
	}
	if err == nil && *output != "" {
		var page string
		page, err = RenderPacket(packet)
		if err == nil {
			err = os.MkdirAll(*output, 0700)
		}
		if err == nil {
			err = os.WriteFile(filepath.Join(*output, "index.html"), []byte(page), 0600)
		}
		if err == nil {
			var encoded []byte
			encoded, err = json.MarshalIndent(packet, "", "  ")
			if err == nil {
				err = os.WriteFile(filepath.Join(*output, "packet.json"), encoded, 0600)
			}
		}
		if err == nil {
			err = os.WriteFile(filepath.Join(*output, "packet.txt"), []byte(packet.Text), 0600)
		}
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, "incident:", err)
		os.Exit(1)
	}
	fmt.Print(packet.Text)
	fmt.Printf("REVIEW pending=%d actions=%d source=%s\n", packet.Pending, len(packet.Actions), packet.SourceSHA256)
}
