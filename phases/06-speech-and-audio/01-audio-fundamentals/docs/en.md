# Audio Fundamentals — Waveforms, Sampling, Fourier Transform

> Waveforms are the raw signal. Spectrograms are the representation. Mel features are the ML-friendly form. Every modern ASR and TTS pipeline walks this ladder, and the first rung is understanding sampling and Fourier.

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 1 · 06 (Vectors & Matrices), Phase 1 · 14 (Probability Distributions)
**Time:** ~45 minutes

## The Problem

A microphone produces a pressure-vs-time signal. Your neural net consumes tensors. Between them sits a stack of conventions that, when violated, produce silent bugs: the model trains fine but the WER doubles, or TTS ships a hiss, or a voice cloning system memorizes the microphone instead of the speaker.

Every bug in speech systems traces back to one of three questions:

1. What sample rate was the data recorded at, and what does the model expect?
2. Is the signal aliased?
3. Are you operating on raw samples or on a frequency representation?

Get these right and the rest of Phase 6 is tractable. Get them wrong and even Whisper-Large-v4 produces garbage.

## The Concept

![Waveform, sampling, DFT, and frequency bins visualized](../assets/audio-fundamentals.svg)

**Waveform.** A one-dimensional array of floats in `[-1.0, 1.0]`. Indexed by sample number. To convert to seconds, divide by the sample rate: `t = n / sr`. A 10-second clip at 16 kHz is an array of 160,000 floats.

**Sampling rate (sr).** How many samples per second. Common rates in 2026:

| Rate | Use |
|------|-----|
| 8 kHz | Telephony, legacy VOIP. Nyquist at 4 kHz kills consonants. Avoid for ASR. |
| 16 kHz | ASR standard. Whisper, Parakeet, SeamlessM4T v2 all consume 16 kHz. |
| 22.05 kHz | TTS vocoder training for older models. |
| 24 kHz | Modern TTS (Kokoro, F5-TTS, xTTS v2). |
| 44.1 kHz | CD audio, music. |
| 48 kHz | Film, pro audio, high-fidelity TTS (VALL-E 2, NaturalSpeech 3). |

**Nyquist-Shannon.** A sample rate of `sr` can unambiguously represent frequencies up to `sr/2`. The `sr/2` boundary is the *Nyquist frequency*. Energy above Nyquist gets *aliased* — folded down into lower frequencies — and corrupts the signal. Always low-pass filter before downsampling.

**Bit depth.** 16-bit PCM (signed int16, range ±32,767) is the universal exchange format. 24-bit for music, 32-bit float for internal DSP. Libraries like `soundfile` read int16 but expose float32 arrays in `[-1, 1]`.

**Fourier Transform.** Any finite signal is a sum of sinusoids at different frequencies. The Discrete Fourier Transform (DFT) computes, for `N` samples, `N` complex coefficients — one per frequency bin. `bin k` maps to frequency `k · sr / N` Hz. Magnitude is amplitude at that frequency, angle is phase.

**FFT.** Fast Fourier Transform: an `O(N log N)` algorithm for the DFT when `N` is a power of 2. Every audio library uses FFT under the hood. A 1024-sample FFT at 16 kHz gives 512 usable frequency bins spanning 0–8 kHz at 15.6 Hz resolution.

**Framing + window.** We do not FFT an entire clip. We chop it into overlapping *frames* (typically 25 ms with 10 ms hop), multiply each frame by a window function (Hann, Hamming) to kill edge discontinuities, then FFT each frame. This is the Short-Time Fourier Transform (STFT). Lesson 02 picks up from here.

## Build It

### Step 1: read a clip and plot the waveform

`code/main.py` uses only the stdlib `wave` module to keep the demo dependency-free. For production you will use `soundfile` or `torchaudio.load` (both return `(waveform, sr)` tuples):

```python
import soundfile as sf
waveform, sr = sf.read("clip.wav", dtype="float32")  # shape (T,), sr=int
```

### Step 2: synthesize a sine wave from first principles

```python
import math

def sine(freq_hz, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    return [amp * math.sin(2 * math.pi * freq_hz * i / sr) for i in range(n)]
```

A 440 Hz sine (concert A) at 16 kHz for 1 second is 16,000 floats. Write with `wave.open(..., "wb")` using 16-bit PCM encoding.

### Step 3: compute the DFT by hand

```python
def dft(x):
    N = len(x)
    out = []
    for k in range(N):
        re = sum(x[n] * math.cos(-2 * math.pi * k * n / N) for n in range(N))
        im = sum(x[n] * math.sin(-2 * math.pi * k * n / N) for n in range(N))
        out.append((re, im))
    return out
```

`O(N²)` — fine for `N=256` to confirm correctness, useless for real audio. Real code calls `numpy.fft.rfft` or `torch.fft.rfft`.

### Step 4: find the dominant frequency

Magnitude peak index `k_star` maps to frequency `k_star * sr / N`. Running this on the 440 Hz sine should return a peak at bin `440 * N / sr`.

### Step 5: demonstrate aliasing

Sample a 7 kHz sine at 10 kHz (Nyquist = 5 kHz). The 7 kHz tone is above Nyquist and folds to `10 − 7 = 3 kHz`. The FFT peak appears at 3 kHz. This is the classic aliasing demo and the reason every DAC/ADC ships with a brick-wall low-pass filter.

## Use It

The stack you will actually ship in 2026:

| Task | Library | Why |
|------|---------|-----|
| Read/write WAV/FLAC/OGG | `soundfile` (libsndfile wrapper) | Fastest, stable, returns float32. |
| Resample | `torchaudio.transforms.Resample` or `librosa.resample` | Correct anti-aliasing built in. |
| STFT / Mel | `torchaudio` or `librosa` | GPU-friendly; PyTorch ecosystem. |
| Real-time streaming | `sounddevice` or `pyaudio` | Cross-platform PortAudio bindings. |
| Inspect a file | `ffprobe` or `soxi` | CLI, fast, reports sr/channels/codec. |

Decision rule: **match sample rate before you match anything else**. Whisper expects 16 kHz mono float32. Pass it 44.1 kHz stereo and you will get garbage that looks like a model bug.

## Ship It

Save as `outputs/skill-audio-loader.md`. The skill helps you check that audio input matches the expectations of the downstream model and resamples correctly when it does not.

## Exercises

1. **Easy.** Synthesize a 1-second mix of 220 Hz + 440 Hz + 880 Hz at 16 kHz. Run DFT. Confirm three peaks at the expected bins.
2. **Medium.** Record a 3-second WAV of your voice at 48 kHz. Downsample to 16 kHz using `torchaudio.transforms.Resample` (with anti-aliasing), then to 16 kHz using naive decimation (every third sample). FFT both. Where does the aliasing appear?
3. **Hard.** Build the STFT from scratch using only `math` and the DFT from Step 3. Frame size 400, hop 160, Hann window. Plot magnitudes with `matplotlib.pyplot.imshow`. This is the spectrogram of Lesson 02.

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Sample rate | How many samples per second | Frequency in Hz at which the ADC measures the signal. |
| Nyquist | The max frequency you can represent | `sr/2`; energy above it aliases back down. |
| Bit depth | Resolution of each sample | `int16` = 65,536 levels; `float32` = 24-bit precision in `[-1, 1]`. |
| DFT | The Fourier transform for sequences | `N` samples → `N` complex frequency coefficients. |
| FFT | The fast DFT | `O(N log N)` algorithm requiring `N` = power of 2. |
| Bin | Frequency column | `k · sr / N` Hz; resolution = `sr / N`. |
| STFT | Spectrogram under the hood | Framed + windowed FFT over time. |
| Aliasing | Weird frequency ghosts | Energy above Nyquist mirroring down to lower bins. |

## Further Reading

- [Shannon (1949). Communication in the Presence of Noise](https://people.math.harvard.edu/~ctm/home/text/others/shannon/entropy/entropy.pdf) — the paper behind the sampling theorem.
- [Smith — The Scientist and Engineer's Guide to Digital Signal Processing](https://www.dspguide.com/ch8.htm) — free, canonical DSP textbook.
- [librosa docs — audio primer](https://librosa.org/doc/latest/tutorial.html) — practical walkthrough with code.
- [Heinrich Kuttruff — Room Acoustics (6th ed.)](https://www.routledge.com/Room-Acoustics/Kuttruff/p/book/9781482260434) — reference for why real-world audio is not a clean sinusoid.
- [Steve Eddins — FFT Interpretation notebook](https://blogs.mathworks.com/steve/2020/03/30/fft-spectrum-and-spectral-densities/) — frequency bin intuition cleared up in 10 minutes.
