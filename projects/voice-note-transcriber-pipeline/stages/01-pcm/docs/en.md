# Decode the audio clock before processing

> The integer samples 0, 16384 and -16384 become 0, 0.5 and -0.5. A sample index of 800 at 16000 Hz means 0.05 seconds. Interpreting the same index at 8000 Hz would double the timestamp without changing a single byte.

**Type:** Build
**Stage:** 1 of 4
**Time:** About 2 hours

## The useful boundary

Read the WAV header before interpreting bytes. The core accepts uncompressed mono signed 16-bit PCM and normalizes samples by 32768. Preserve the actual sample rate: every later timestamp is a sample index divided by that rate. Unsupported stereo or compressed input must fail visibly.

```figure
pj-voice-note-transcriber-pipeline-1
```

## Work the example

The integer samples 0, 16384 and -16384 become 0, 0.5 and -0.5. A sample index of 800 at 16000 Hz means 0.05 seconds. Interpreting the same index at 8000 Hz would double the timestamp without changing a single byte.

Write the returned fields and the expected side-effect count before coding. Keep a second input that should fail so the successful example cannot become a hard-coded answer.

## Build the contract

Implement `decode_wav(data), encode_wav(samples, rate=16000) in pcm.py` in your learner workspace. Preserve the exported names and continue using earlier stages rather than duplicating their policies.

The authored repair-note.wav is a 5.685-second spoken sentence synthesized locally with the operating system voice. Its companion reference.json contains author-supplied text and a hash of the original WAV. It is a speech fixture, not proof that the project recognized speech. The generation tool is not needed to run the committed fixture.

## Hints

Check channels, sample width and compression type before unpacking. Verify the byte count equals the declared frame count times two. Test negative samples and clipping at the largest positive signed value.

## Verify your work

```bash
python3 scripts/project_test.py voice-note-transcriber-pipeline --init my-voice-note-transcriber-pipeline
python3 scripts/project_test.py voice-note-transcriber-pipeline --stage 1 --path my-voice-note-transcriber-pipeline --strict
```

Initialize once. Cumulative tests import your workspace and preserve your earlier source. A reference-solution run verifies the teaching implementation and never grants a learner certificate. Optional SDK checks require the dependencies and commands in the project README.

## Inspect the result

Why can valid sample values still yield incorrect captions if the sample rate is guessed? Which conversion should happen before processing a phone voice note?

The completed project produces audio.wav, captions.vtt, transcript.json and an HTML page with embedded playback and cue-seek buttons.

```bash
cd projects/voice-note-transcriber-pipeline/solution
python3 pipeline.py --input fixtures/repair-note.wav --transcript-file fixtures/reference.json --out voice-output
```

Replace the fixture with a small input from your own workflow. Keep expected outcomes and observed evidence together, then retain a separate set of cases for evaluation. Provider request tests establish serialization and control flow; they do not establish model quality.

## Primary reference

[Official API documentation](https://docs.python.org/3/library/wave.html). The implementation, policy choices and examples are original.
