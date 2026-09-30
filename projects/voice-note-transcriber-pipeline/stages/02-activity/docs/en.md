# Measure activity without claiming speech detection

> At 1000 Hz, forty samples of amplitude 0.5, twenty silent samples and forty active samples merge into [0,100] when gap_ms is 40. The merged span lasts 100 ms. A 20 ms isolated burst is discarded when min_ms is 40.

**Type:** Build
**Stage:** 2 of 4
**Time:** About 2 hours

## The useful boundary

Compute root-mean-square energy for each frame. Mark frames above the threshold, merge neighboring active spans separated by a short enough gap, and discard spans shorter than the minimum. Return half-open sample intervals so slicing and timestamps share one coordinate system.

```figure
pj-voice-note-transcriber-pipeline-2
```

## Work the example

At 1000 Hz, forty samples of amplitude 0.5, twenty silent samples and forty active samples merge into [0,100] when gap_ms is 40. The merged span lasts 100 ms. A 20 ms isolated burst is discarded when min_ms is 40.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `activity(samples, rate, frame_ms=20, threshold=0.02, min_ms=40, gap_ms=40) in activity.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

Reject nonfinite samples or parameters and invalid negative bounds. Acoustic energy does not identify words, language or speakers: a fan can pass and quiet speech can fail. The CLI sends the whole clip by default; --segment explicitly opts into this lossy energy-based split.

## Hints

Draw the active frame indices before merging. Separate the gap condition from the minimum-duration filter. Try a threshold just above and just below a frame's RMS and explain the changed output.

## Verify your work

```bash
python3 scripts/project_test.py voice-note-transcriber-pipeline --init my-voice-note-transcriber-pipeline
python3 scripts/project_test.py voice-note-transcriber-pipeline --stage 2 --path my-voice-note-transcriber-pipeline --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

What information can be lost by removing quiet regions? How would you evaluate this detector on your own recording conditions?

The completed project produces audio.wav, captions.vtt, transcript.json and an HTML page with embedded playback and cue-seek buttons.

```bash
cd projects/voice-note-transcriber-pipeline/solution
python3 pipeline.py --input fixtures/repair-note.wav --transcript-file fixtures/reference.json --out voice-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/wave.html). The implementation, policy choices and examples are original.
