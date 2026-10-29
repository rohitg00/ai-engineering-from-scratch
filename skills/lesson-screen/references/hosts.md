# Hosts

The lesson screen needs three things: Node.js 20 or later, a local port, and a browser on the learner's machine. This page lists the cases and what to do in each one.

## The default case

The agent runs on the learner's computer and keeps child processes alive.

1. Run `CLI start --open`.
2. `start` starts the server as a separate process and returns at once.
3. `--open` opens the browser. Give the learner the URL as well, because the open can fail.

## Hosts that end child processes

Some hosts stop every process that a command started when the command returns. A screen that stops loading after the first turn shows this case.

1. Run `CLI start --foreground --open` with the host's option for a background shell command.
2. The command keeps running and prints the start JSON first.
3. In a later turn, run `CLI status` to read the URL again.

## Sandboxed hosts

A sandbox can block local ports or the browser launch. The start JSON or the error names the cause.

- A blocked port: ask the learner to allow local network access for this command, or skip the screen.
- A blocked browser launch: run `start` without `--open` and give the URL.

## Remote machines

The agent runs on another machine: over SSH, in a container, or in a cloud workspace.

- Prefer port forwarding. Start with `CLI start --port 4777`. Ask the learner to run `ssh -L 4777:127.0.0.1:4777 <host>`, then to open the URL on their computer.
- A container can publish the port instead. Start with `--host 0.0.0.0 --url-host localhost` and publish port 4777.
- Bind to `0.0.0.0` only when the learner asks for it. The key is then the only protection on the network.

## Hosts with no shell

A chat app without a shell cannot run the server. Give the lesson page instead:

```text
https://aiengineeringfromscratch.com/lesson?path=<phase-dir>/<lesson-dir>
```

The lesson page shows the same registered figures. Machines need the server, so describe the parts and flows in the terminal.

## Windows

The commands work the same in PowerShell and in Command Prompt. Quote paths that contain spaces. `--open` uses the default browser.

## Offline learners

The figure runtime and the 3D library load from the network. Offline, the frame shows the text parts of each screen and a note in place of each figure. In a clone with a built site, `--assets local` loads the figure runtime from disk. The 3D view still needs cdn.jsdelivr.net, and the machine viewer shows its steps and parts as text without it.
