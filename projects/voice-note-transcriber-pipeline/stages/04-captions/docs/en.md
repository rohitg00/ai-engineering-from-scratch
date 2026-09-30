# Export a transcript you can hear and correct

> The fixture CLI pairs the original spoken clip with its supplied reference text and labels the method clearly. Real recognition instead uses --endpoint. After inspecting playback, edit the rows in transcript.json and run --review-file to rerender; the report must match the original audio hash.

**Type:** Build
**Stage:** 4 of 4
**Time:** About 2 hours

## The useful boundary

Render segment times as WebVTT at the output boundary. Validate finite, ordered, nonoverlapping cues with nonempty text. Save the original WAV and a JSON report, then build a local review page with embedded audio and buttons that seek to each segment. The captions describe segment boundaries, not inferred word alignment.

```figure
pj-voice-note-transcriber-pipeline-4
```

## Work the example

The fixture CLI pairs the original spoken clip with its supplied reference text and labels the method clearly. Real recognition instead uses --endpoint. After inspecting playback, edit the rows in transcript.json and run --review-file to rerender; the report must match the original audio hash.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `stamp, captions in captions.py; export_transcript and the CLI in pipeline.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

Write audio.wav, captions.vtt, transcript.json and index.html. Reject cues ending beyond the audio duration. Escape transcription text and method labels in HTML. A supplied transcript-file is a hash-bound reference mode and cannot be combined with segmentation. No provider call occurs in reference or review mode.

`export_transcript` returns the same object written to transcript.json: `schema_version=1`, the supplied `method`, `audio_sha256` of the original WAV bytes, `duration_seconds` and the unchanged `rows`. Each row contains start and end in seconds plus text; provider rows can also carry segment hashes and attempt counts. Keep those extra fields when exporting. Compute duration from the decoded sample count divided by the actual sample rate. Embed the WAV as a base64 audio source so playback continues to work when the HTML is opened locally.

## Hints

Open the exported page, play the actual audio and click a cue. Compare the JSON row with its WebVTT timestamp. Change a caption to an HTML-like string in a test and confirm it renders as text.

## Verify your work

```bash
python3 scripts/project_test.py voice-note-transcriber-pipeline --init my-voice-note-transcriber-pipeline
python3 scripts/project_test.py voice-note-transcriber-pipeline --stage 4 --path my-voice-note-transcriber-pipeline --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Which fields would need updating after trimming the audio? Why is an editable reference transcript a useful integration test without being a speech-recognition benchmark?

The completed project produces audio.wav, captions.vtt, transcript.json and an HTML page with embedded playback and cue-seek buttons.

```bash
cd projects/voice-note-transcriber-pipeline/solution
python3 pipeline.py --input fixtures/repair-note.wav --transcript-file fixtures/reference.json --out voice-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/wave.html). The implementation, policy choices and examples are original.
