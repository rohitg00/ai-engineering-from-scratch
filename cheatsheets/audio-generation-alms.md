---
id: audio-generation-alms
title: Music Generation and Audio-Language Models
code: MG
subtitle: Codec tokens, MusicGen, audio encoders and projectors, Thinker and Talker, TTFAB budgets and audio pitfalls.
hue: 285
sources: phases/06-speech-and-audio/09-music-generation, phases/06-speech-and-audio/10-audio-language-models, phases/08-generative-ai/11-audio-generation, phases/12-multimodal-ai/19-audio-language-whisper-to-af3, phases/12-multimodal-ai/20-omni-models-thinker-talker
source_hash: 453110680f89bafa
---

## Audio becomes codec tokens
type: architecture
from: phases/08-generative-ai/11-audio-generation/docs/en.md

```arch
node | wave | 1,1 | Waveform | 16-48 kHz | client
node | enc | 2,1 | Encoder conv | per-timestep vector | process
node | rvq | 3,1 | RVQ | 8 codebooks at 75 Hz | store
node | gen | 3,2 | Generator | token-AR or diffusion | model
node | dec | 2,2 | Codec decoder | tokens to audio | process
node | out | 1,2 | Audio out | |
edge | wave | enc |
edge | enc | rvq | vectors
edge | rvq | gen | indices
edge | gen | dec | new tokens
edge | dec | out |
```

## Numbers that matter
type: concepts
from: phases/08-generative-ai/11-audio-generation/docs/en.md, phases/06-speech-and-audio/09-music-generation/docs/en.md, phases/12-multimodal-ai/19-audio-language-whisper-to-af3/docs/en.md, phases/12-multimodal-ai/20-omni-models-thinker-talker/docs/en.md

- **Codec rate**: 8 RVQ codebooks at 75 Hz give 600 tokens/sec.
- **Stream floor**: at 75 tokens/second, generate ≥75 tokens/sec per user.
- **Talker floor**: 50 Hz speech tokens need ≥50 tok/s from the Talker.
- **Codebook**: 1024 or 2048 entries is typical.
- **MusicGen codec**: EnCodec at 32 kHz with 4 codebooks.
- **Log-Mel shape**: 30 s at 100 Hz frame rate gives (3000, 80).
- **Round trip**: below 500ms, the user stops noticing the lag.

## Two generator families
type: concepts
from: phases/08-generative-ai/11-audio-generation/docs/en.md, phases/06-speech-and-audio/09-music-generation/docs/en.md

- **Token-autoregressive**: a decoder-only transformer over flattened RVQ tokens.
- **Delayed parallel**: MusicGen emits K codebook streams with per-stream offsets.
- **VALL-E**: speech tokens from a text prompt and a 3-second voice sample.
- **Latent diffusion**: Stable Audio Open works on compressed audio. Good for loops.
- **Flow matching**: Stable Audio 2.5 uses it on continuous audio latents.
- **Trend**: flow matching wins for music. Token-AR dominates speech.

## MusicGen, melody and FAD
type: annotated-code
lang: python
from: phases/06-speech-and-audio/09-music-generation/docs/en.md

```python
from audiocraft.models import MusicGen
model = MusicGen.get_pretrained("facebook/musicgen-small")  # 300M, fast
model.set_generation_params(duration=10)  # seconds of audio
wav = model.generate(["upbeat synthwave with driving drums, 128 BPM"])
torchaudio.save("out.wav", wav[0].cpu(), 32000)  # 32 kHz output
melody, sr = torchaudio.load("humming.wav")
wav = model.generate_with_chroma(  # keeps the tune, swaps timbre
    ["jazz piano cover"], melody.squeeze(), sr)
from frechet_audio_distance import FrechetAudioDistance
fad = FrechetAudioDistance()  # VGGish embedding distance
fad.get_fad_score("generated_folder/", "reference_folder/")  # lower is better
```

## Audio-language model template
type: flow
from: phases/06-speech-and-audio/10-audio-language-models/docs/en.md

1. **Audio encoder**: Whisper encoder, BEATs, CLAP or WavLM makes features.
2. **Projector**: a linear layer or MLP maps features into the LLM embedding space.
3. **LLM**: a decoder reads interleaved text and audio tokens and writes text.
4. **Stage 1**: freeze encoder and LLM. Train the projector on ASR or captioning data.
5. **Stage 2**: full or LoRA fine-tune on instruction audio tasks.
6. **Stage 3**: optional. Add a speech decoder for voice-in and voice-out.

## Projector and audio Q-former
type: annotated-code
lang: python
from: phases/06-speech-and-audio/10-audio-language-models/docs/en.md, phases/12-multimodal-ai/19-audio-language-whisper-to-af3/code/main.py

```python
class AudioProjector(nn.Module):
    def __init__(self, audio_dim=1280, llm_dim=4096):
        super().__init__()
        self.down = nn.Linear(audio_dim, llm_dim)  # audio to LLM width
        self.act = nn.GELU()
        self.up = nn.Linear(llm_dim, llm_dim)
    def forward(self, audio_features):
        return self.up(self.act(self.down(audio_features)))
qf = QFormer(n_queries=8, hidden=20)  # N=8 queries
tokens = qf.forward(frames)  # 99 frames in, 8 tokens out
```

## Log-Mel and encoder settings
type: defaults
from: phases/12-multimodal-ai/19-audio-language-whisper-to-af3/docs/en.md, phases/12-multimodal-ai/19-audio-language-whisper-to-af3/code/main.py

| Setting | Default | Note |
|---|---|---|
| Sample rate | 16 kHz | Resample first |
| Window | 25ms | `win_ms: int = 25` |
| Hop | 10ms | `hop_ms: int = 10` |
| Mel filters | 80 | 0-8000 Hz |
| Log compress | `math.log(1 + x)` | Dynamic range |
| Q-former queries | 32 or 64 | AF3 uses 64 |
| Whisper encoder | 12-layer | Frozen in the ALM pattern |

## Thinker and Talker
type: architecture
from: phases/12-multimodal-ai/20-omni-models-thinker-talker/docs/en.md

```arch
node | mic | 1,1 | Mic and VAD | speech tokens | client
node | think | 2,1 | Thinker | 7B-80B, TMRoPE | model
node | talk | 3,1 | Talker | 200M-1B | model
node | dec | 3,2 | Speech decoder | SNAC, MoVQGAN | process
node | spk | 2,2 | Speakers | audio samples | client
edge | mic | think | audio tokens
edge | think | talk | text tokens
edge | talk | dec | RVQ indices
edge | dec | spk | stream
```

## TTFAB budget at 7B
type: defaults
from: phases/12-multimodal-ai/20-omni-models-thinker-talker/docs/en.md, phases/12-multimodal-ai/20-omni-models-thinker-talker/code/main.py

| Setting | Default | Note |
|---|---|---|
| Mic to audio tokens | 40-80ms | Streams |
| Prefill | 100-200ms | Much more at 70B |
| First Thinker text token | 40ms | Grows with Thinker size |
| Talker on first text token | 20ms | At least 15ms in the lesson model |
| First speech tokens commit | 40ms | Before residual-VQ decode |
| Residual-VQ decode | 30ms | `rvq_decode = 30` |
| Speech waveform decode | 50-80ms | `wave_decode = 70` |
| Total TTFAB | 320-490ms | 600-900ms at 70B |

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/09-music-generation/docs/en.md, phases/06-speech-and-audio/10-audio-language-models/docs/en.md, phases/08-generative-ai/11-audio-generation/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Music loops past 30 s | AR models loop | Crossfade, or use ACE-Step |
| Tempo leaves the BPM | Models wander | BPM tags, librosa `beat_track` |
| Mushy sung words | Open models are weak on lyrics | Commercial API or fine-tune |
| Hallucinations on silence | Whisper encoder issue | VAD-gate |
| Speakers mixed past 10 minutes | Long-audio degradation | Diarize first, then summarize |
| Multi-audio near 25% | Random-chance level | Do not trust "which clip" tasks |
| Errors from RVQ layer 1 spread | RVQ error accumulation | Temperature 0 on higher layers |
| Artifacts at clip joins | Crossfade boundaries | Careful overlap-add |

## Tasks in code
type: task-table
span: 2
from: phases/06-speech-and-audio/10-audio-language-models/docs/en.md, phases/06-speech-and-audio/10-audio-language-models/code/main.py, phases/12-multimodal-ai/19-audio-language-whisper-to-af3/code/main.py, phases/12-multimodal-ai/20-omni-models-thinker-talker/code/main.py, phases/08-generative-ai/11-audio-generation/code/main.py, phases/08-generative-ai/11-audio-generation/docs/en.md

| Task | Code |
|---|---|
| Load the ALM processor | `AutoProcessor.from_pretrained("Qwen/Qwen2.5-Omni-7B")` |
| Generate an answer | `model.generate(**inputs, max_new_tokens=200)` |
| Load MMAU-Pro | `load_dataset("gamma-lab-umd/MMAU-Pro", split="test")` |
| Score MMAU-Pro officially | `evaluate_mmau_pro_comprehensive.py` |
| Cut audio into frames | `window_frames(wave, 16000, 25, 10)` |
| List TTFAB parts | `ttfab(cfg)` |
| Sample codec tokens | `generate(counts, style, start, length, rng, temperature=1.0)` |

## Q&A
type: qa
from: phases/12-multimodal-ai/19-audio-language-whisper-to-af3/docs/en.md, phases/12-multimodal-ai/20-omni-models-thinker-talker/docs/en.md

- **When is a cascade enough?** Transcription is the goal, with no music and no emotion.
- **When do I need end-to-end?** Music, emotion, multi-speaker or complex audio reasoning.
- **What does a cascade lose?** Mood, speaker identity, timing and deepfake cues.
- **Why a small Talker?** A 7B Talker falls behind the 50 tok/s floor.
- **Why TMRoPE?** It gives each token an absolute timestamp. Vision, audio and text align.
- **Half or full duplex?** Qwen2.5-Omni is half-duplex by default. Moshi supports full-duplex.

## Tips
type: tips
from: phases/06-speech-and-audio/09-music-generation/docs/en.md, phases/06-speech-and-audio/10-audio-language-models/docs/en.md, phases/08-generative-ai/11-audio-generation/docs/en.md

- To ship safely, generate instrumental only.
- Tag each generation with watermarks and metadata.
- Report each MMAU-Pro `category` separately.
- Check the codec first. It caps output quality. DAC is the current open best.
- For voice cloning, add abuse detection and opt-out lists.
