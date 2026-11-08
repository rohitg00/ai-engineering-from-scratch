# Evidence: cheatsheets/audio-generation-alms.md

Abbreviations: L09 = phases/06-speech-and-audio/09-music-generation, L10 = phases/06-speech-and-audio/10-audio-language-models, G11 = phases/08-generative-ai/11-audio-generation, M19 = phases/12-multimodal-ai/19-audio-language-whisper-to-af3, M20 = phases/12-multimodal-ai/20-omni-models-thinker-talker. d = docs/en.md, c = code/main.py.

## Audio becomes codec tokens (architecture, 6 nodes, 5 edges)
- Waveform 16-48 kHz: G11/d:3
- Encoder conv, per-timestep vector: G11/d:26, 29-30
- RVQ, 8 codebooks at 75 Hz, indices: G11/d:26, 31-34
- Generator token-AR or diffusion: G11/d:18, 39-41
- Codec decoder reverses the encoder: G11/d:26
- Audio out: G11/d:18, 26

## Numbers that matter (concepts, 7)
- 8 RVQ codebooks at 75 Hz = 600 tokens/sec: G11/d:26
- ~75 tokens/second, ≥75 tokens/sec per user: G11/d:132
- 50 Hz speech tokens, Talker ≥50 tok/s: M20/d:92
- codebook 1024 or 2048 typical: G11/d:123
- EnCodec 32 kHz, 4 codebooks: L09/d:24, 163
- (3000, 80) for 30 s at 100 Hz: M19/d:41
- below 500ms user stops noticing lag: M20/d:26

## Two generator families (concepts, 6)
- token-autoregressive, decoder-only transformer over flattened RVQ tokens: G11/d:39
- delayed parallel, K streams with per-stream offsets: G11/d:39
- VALL-E text prompt plus 3-second voice sample: G11/d:39
- Stable Audio Open latent diffusion on compressed audio, loops: L09/d:30
- Stable Audio 2.5 flow matching on continuous audio latents: G11/d:41
- flow matching wins music, token-AR dominates speech: G11/d:43

## MusicGen, melody and FAD (annotated-code, 11 lines)
- import, get_pretrained, set_generation_params, generate, torchaudio.save 32000: L09/d:80-86
- small 300M fast: L09/d:89
- torchaudio.load, generate_with_chroma, melody.squeeze(), sr: L09/d:94-99
- preserves tune, swaps timbre: L09/d:102
- FrechetAudioDistance, get_fad_score: L09/d:107-110
- VGGish distance: L09/d:113. lower is better: L09/d:40

## Audio-language model template (flow, 6)
1. audio encoder options Whisper, BEATs, CLAP, WavLM: L10/d:29
2. projector linear or MLP into LLM embedding space: L10/d:30
3. LLM decoder, interleaved text + audio tokens, generates text: L10/d:31
4. Stage 1 freeze encoder + LLM, projector on ASR / captioning: L10/d:35
5. Stage 2 full / LoRA fine-tune on instruction tasks: L10/d:36
6. Stage 3 optional speech decoder for voice-in / voice-out: L10/d:37

## Projector and audio Q-former (annotated-code, 10 lines)
- AudioProjector class, audio_dim=1280, llm_dim=4096, down/act/up, forward: L10/d:115-123
- QFormer(n_queries=8, hidden=20), N=8 queries: M19/c:114, 117
- qf.forward(frames), 99 frames in, 8 tokens out: M19/c:116, 118-120

## Log-Mel and encoder settings (defaults, 7)
- 16 kHz resample: M19/d:35
- 25ms window, win_ms: int = 25: M19/d:36, M19/c:25
- 10ms hop, hop_ms: int = 10, 100 Hz frame rate: M19/d:36, 41, M19/c:25
- 80 Mel filters 0-8000 Hz: M19/d:38
- math.log(1 + x) dynamic range: M19/c:70, M19/d:39
- 32 or 64 queries, AF3 uses 64: M19/d:61, 73
- Whisper encoder 12-layer, frozen in ALM pattern: M19/d:45, 49

## Thinker and Talker (architecture, 5 nodes, 4 edges)
- Mic and VAD, speech tokenization: M20/d:21
- Thinker 7B-80B text: M20/d:36. TMRoPE in Thinker: M20/d:51-53
- Talker 200M-1B, discrete speech tokens (residual-VQ indices): M20/d:37
- Speech decoder SNAC, MoVQGAN, audio samples: M20/d:38
- streaming between stages: M20/d:42-47

## TTFAB budget at 7B (defaults, 8)
- mic to audio tokens 40-80ms: M20/d:80
- prefill 100-200ms at 7B, more at 70B: M20/d:81
- first Thinker text token 40ms: M20/d:82
- Talker first text token 20ms: M20/d:83
- first speech tokens commit 40ms: M20/d:84
- residual-VQ decode 30ms, rvq_decode = 30: M20/d:85, M20/c:42
- waveform decode 50-80ms, wave_decode = 70: M20/d:86, M20/c:45
- total 320-510ms at 7B, 600-900ms at 70B: M20/d:88

## Troubleshooting (troubleshooting, 8)
- loops past 30 s, crossfade or ACE-Step: L09/d:139
- tempo drift, BPM tags, librosa beat_track: L09/d:140
- mushy words, commercial API or fine-tune: L09/d:141
- hallucinations on silence, Whisper encoder, VAD-gate: L10/d:160
- past 10 minutes speaker attribution breaks, diarize first: L10/d:159
- multi-audio random-chance level, 25%: L10/d:66, 158
- RVQ error accumulation, temperature 0 on higher layers: G11/d:88
- artifacts at boundaries, careful overlap-add: G11/d:90

## Tasks in code (task-table, 7)
- AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B"): L10/d:94
- model.generate(**inputs, max_new_tokens=200): L10/d:106
- load_dataset("gamma-lab-umd/MMAU-Pro", split="test"): L10/d:132
- evaluate_mmau_pro_comprehensive.py: L10/d:143
- window_frames(wave, 16000, 25, 10): M19/c:77
- ttfab(cfg): M20/c:26
- generate(counts, style, start, length, rng, temperature=1.0): G11/c:45

## Q&A (qa, 6)
- cascade if transcription, no music, no emotion: M19/d:96
- end-to-end for music, emotion, multi-speaker, complex reasoning: M19/d:97
- cascade loses mood, speaker, timing, deepfake cues: M19/d:85-88
- 7B Talker falls behind 50 tok/s: M20/d:92
- TMRoPE absolute timestamps across vision, audio, text: M20/d:53, 131
- Qwen2.5-Omni half-duplex default, Moshi full-duplex: M20/d:68, 70

## Tips (tips, 5)
- generate instrumental only: L09/d:66
- watermarks + metadata: L09/d:69
- report each category separately: L10/d:144
- codec caps quality, DAC open best: G11/d:87
- abuse detection + opt-out lists: G11/d:92
