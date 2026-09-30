# Send real WAV bytes through a recognizer boundary

> A provider timeout followed by success records attempts=2. Each output row retains start, end, text and the SHA256 of the exact encoded segment. A second segment cannot overlap the previous one, and fractional sample indices are invalid.

**Type:** Build
**Stage:** 3 of 4
**Time:** About 2 hours

## The useful boundary

Encode each selected span as a complete WAV before calling the provider. The real HTTP adapter sends multipart form data with model and file fields to an explicitly configured audio/transcriptions endpoint. It parses the returned text and rejects an empty or malformed result. Endpoint selection is the explicit upload boundary.

```figure
pj-voice-note-transcriber-pipeline-3
```

## Work the example

A provider timeout followed by success records attempts=2. Each output row retains start, end, text and the SHA256 of the exact encoded segment. A second segment cannot overlap the previous one, and fractional sample indices are invalid.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `transcribe(...) in transcribe.py; http_recognizer(endpoint, model, api_key, timeout) in provider.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

Allow zero through five retries, retry only TimeoutError, and count attempts. The adapter requires HTTPS remotely and permits HTTP only for localhost or an explicit loopback IPv4/IPv6 address. Validate a hostname and port, rejecting URL credentials, fragments and whitespace. Reject every redirect with a dedicated urllib opener whose HTTPRedirectHandler.redirect_request returns None; credentials and audio stay tied to the selected endpoint. It also checks a WAV signature, a 20 MB upload bound, a 1 MB response bound and a timeout of at most 120 seconds. TRANSCRIPTION_API_KEY supplies optional authentication. Controlled transport tests verify real multipart serialization; they do not measure recognition accuracy.

## Hints

Capture the outgoing request in a test and confirm it contains the WAV bytes rather than a filename string. Return a distinct held-out sentence from the test endpoint. Keep source hashes next to text so a reviewed transcript can be related to its actual audio.

## Verify your work

```bash
python3 scripts/project_test.py voice-note-transcriber-pipeline --init my-voice-note-transcriber-pipeline
python3 scripts/project_test.py voice-note-transcriber-pipeline --stage 3 --path my-voice-note-transcriber-pipeline --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Why should an authentication error fail immediately instead of consuming the timeout retry budget? What does the audio hash establish, and what does it not establish?

The completed project produces audio.wav, captions.vtt, transcript.json and an HTML page with embedded playback and cue-seek buttons.

```bash
cd projects/voice-note-transcriber-pipeline/solution
python3 pipeline.py --input fixtures/repair-note.wav --transcript-file fixtures/reference.json --out voice-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/wave.html). The implementation, policy choices and examples are original.
