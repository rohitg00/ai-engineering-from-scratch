# Decode chunked bytes into complete events

> Let UTF-8 and SSE framing survive arbitrary transport boundaries.

**Type:** Build
**Languages:** TypeScript, Go
**Stage:** 1 of 4
**Prerequisites:** Basic functions, collections, JSON and the previous stages when applicable.
**Time:** ~2 hours

## What you build

Build an incremental UTF-8 decoder and line parser. Handle LF, CRLF and CR, even when the separator or multibyte character spans chunks. A blank line dispatches data; EOF by itself does not. Comments are ignored. Multiple data fields join with a newline.

## Worked example

Split the two bytes of é across pushes. No replacement character should appear. `id: 1`, `data: Caf` and a blank line dispatch one event. An event without a new id inherits the previous id; an empty id resets it.

```figure
pj-streaming-answer-recovery-1
```

## Implement the contract

`new SSEDecoder().push(bytes:Uint8Array,final=false):Event[]`, where Event is `{id,event,data}`. Default event type is message. Ignore id values containing NUL. Final flush rejects truncated UTF-8 and discards un-dispatched data. This subset ignores retry fields.

Reject malformed input before producing a partial artifact. The tests include held-out records separate from the demonstration fixture.

## Run your work

```bash
python3 scripts/project_test.py streaming-answer-recovery --init /tmp/streaming-answer-recovery-work
python3 scripts/project_test.py streaming-answer-recovery --stage 1 --path /tmp/streaming-answer-recovery-work --strict
```

Initialization copies cumulative scaffolding without replacing your work. Implement the TODO functions in the first-stage starter; later-stage starter notes describe the new behavior. Tests import the learner workspace. Run the command in the README against your own input after passing the stage.

## Inspect and extend

Try a trailing data line without a blank line. Explain why prematurely dispatching it can display incomplete JSON.

[WHATWG server-sent events](https://html.spec.whatwg.org/multipage/server-sent-events.html).
