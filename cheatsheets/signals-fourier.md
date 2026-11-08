---
id: signals-fourier
title: Complex Numbers, Fourier and Signals
code: CN
subtitle: Complex rotations, DFT and FFT, windows, sampling, spectrograms, mel filterbanks and MFCCs. Python from the lessons.
hue: 290
sources: phases/01-math-foundations/19-complex-numbers, phases/01-math-foundations/20-fourier-transform, phases/06-speech-and-audio/01-audio-fundamentals, phases/06-speech-and-audio/02-spectrograms-mel-features
source_hash: 0f1df4b429171683
---

## Cooley-Tukey FFT, 8 points
type: architecture
from: phases/01-math-foundations/20-fourier-transform/docs/en.md

```arch
node | x | 1,1 | x[0..7] | 8 samples
node | even | 2,1 | Even half | x[0,2,4,6]
node | odd | 2,2 | Odd half | x[1,3,5,7]
node | ek | 3,1 | E[0..3] | 4-pt FFT
node | ok | 3,2 | O[0..3] | 4-pt FFT
node | out | 4,1 | X[0..7] | E[k] +/- twiddle * O[k]
edge | x | even | split
edge | x | odd | split
edge | even | ek |
edge | odd | ok |
edge | ek | out | combine
edge | ok | out | twiddle
```

## Waveform to log-mel and MFCC
type: flow
from: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/code/main.py

1. **Frame**: cut 25 ms windows with a 10 ms hop. At 16 kHz that is 400 and 160 samples.
2. **Window**: multiply each frame by `hann(N)`. It tapers the edges to zero.
3. **STFT**: take the FFT magnitude of each frame. Shape is `(n_frames, n_freq_bins)`.
4. **Mel**: multiply by the triangular filterbank. 80 mels over 0 to 8 kHz is the ASR standard.
5. **Log**: `log(mel_spec + 1e-10)` compresses the dynamic range.
6. **MFCC**: apply `dct_ii` to each log-mel frame. Keep the first 13 coefficients.

## Tasks in code
type: task-table
from: phases/01-math-foundations/19-complex-numbers/docs/en.md, phases/01-math-foundations/20-fourier-transform/docs/en.md, phases/01-math-foundations/20-fourier-transform/code/fourier.py, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md

| Task | Code |
|---|---|
| Rotate a point by 45 degrees | `point * euler(math.pi / 4)` |
| N points on the unit circle | `roots_of_unity(N)` |
| Transform and invert, O(N^2) | `dft(x)`, then `idft(X)` |
| Fast transform, power of 2 | `fft(x)` |
| Energy per frequency | `power_spectrum(X)` |
| Linear convolution by FFT | `convolve_fft(x, h)` |
| Split a signal into frames | `frame(signal, frame_len, hop)` |
| Mel filterbank matrix | `mel_filterbank(n_mels, n_fft, sr)` |

## Spectra in NumPy and SciPy
type: annotated-code
lang: python
from: phases/01-math-foundations/19-complex-numbers/docs/en.md, phases/01-math-foundations/20-fourier-transform/docs/en.md, phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md

```python
waveform, sr = sf.read("clip.wav", dtype="float32")  # float32 in [-1, 1]
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(256, d=1/256)  # frequency of each bin
power = np.abs(spectrum) ** 2  # power spectrum
window = windows.hann(256)  # from scipy.signal
result = fftconvolve(signal, kernel, mode='full')
frequencies, times, Zxx = stft(signal, fs=sample_rate, nperseg=256)
spectrogram = np.abs(Zxx) ** 2  # (n_frequencies, n_time_frames)
print(cmath.exp(1j * cmath.pi))  # Euler: close to -1
```

## Mel features from scratch
type: annotated-code
lang: python
from: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/code/main.py

```python
def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)
mag = stft_magnitude(signal, frame_len=400, hop=160)  # Hann + DFT per frame
fb = mel_filterbank(n_mels, n_fft, sr)  # 80 mels, n_fft=400 gives (80, 201)
mel_spec = apply_filterbank(cmag, fb)  # one weighted sum per mel bin
lm = log_transform(mel_spec)  # eps=1e-10
mfcc = dct_ii(lm[len(lm) // 2], 13)  # coefficient 0 is overall energy
```

## Key formulas
type: concepts
from: phases/01-math-foundations/19-complex-numbers/docs/en.md, phases/01-math-foundations/20-fourier-transform/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md

- **Multiply**: $(a + bi)(c + di) = (ac - bd) + (ad + bc)i$. Magnitudes multiply, angles add.
- **Polar**: $r = \sqrt{a^2 + b^2}$ and $\theta = \mathop{\mathrm{atan2}}(b, a)$.
- **Euler**: $e^{i\theta} = \cos\theta + i \sin\theta$. Multiply by it to rotate by $\theta$.
- **DFT**: $X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N}$.
- **Inverse DFT**: positive exponent and a $1/N$ factor. Reconstruction is exact.
- **Bins**: $f_k = k \cdot f_s / N$, resolution $f_s / N$, maximum $f_s / 2$.
- **Convolution theorem**: $x * h = \text{IFFT}(\text{FFT}(x) \cdot \text{FFT}(h))$.
- **Mel**: $m = 2595 \cdot \log_{10}(1 + f / 700)$.

## Sample rates
type: command-table
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md

| Command | What it does |
|---|---|
| 8 kHz | Telephony. Nyquist at 4 kHz kills consonants. Avoid for ASR |
| 16 kHz | ASR standard. A 10 s clip is 160,000 floats |
| 22.05 kHz | TTS vocoder training for older models |
| 24 kHz | Modern TTS |
| 44.1 kHz | CD audio, music |
| 48 kHz | Film, pro audio, high-fidelity TTS |

## Window functions
type: command-table
from: phases/01-math-foundations/20-fourier-transform/docs/en.md

| Command | What it does |
|---|---|
| Rectangular | No window. Side lobes -13 dB. Signal exactly periodic in N |
| Hann | 0.5 (1 - cos(2 pi n / (N-1))). -31 dB. General purpose |
| Hamming | 0.54 - 0.46 cos(2 pi n / (N-1)). -42 dB. Speech analysis |
| Blackman | Wide main lobe. -58 dB. Side lobe suppression is critical |

## Numbers and defaults
type: defaults
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md

| Setting | Default | Note |
|---|---|---|
| Frame length at 16 kHz | 400 | 25 ms window |
| Hop at 16 kHz | 160 | 10 ms. 10 s gives 998 frames |
| Mel bins for ASR | 80 | Audio classification uses 128 |
| MFCC coefficients | 13 | Keyword spotting uses 40 |
| Log-mel epsilon | 1e-10 | Inside log(mel_spec + eps) |
| Log-magnitude epsilon | 1e-6 | Inside log(abs(X) + eps) |
| 1024-point FFT at 16 kHz | 15.6 Hz | 512 usable bins over 0 to 8 kHz |
| PCM exchange format | 16-bit | int16, range plus or minus 32,767 |

## Troubleshooting
type: troubleshooting
from: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md, phases/01-math-foundations/20-fourier-transform/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Garbage output that looks like a model bug | Sample rate mismatch | Match sample rate first. 16 kHz mono float32 |
| 7 kHz tone peaks at 3 kHz | Aliasing above Nyquist | Low-pass filter before downsampling |
| Spurious high frequencies | Spectral leakage at the frame edges | Apply a Hann or Hamming window |
| Silent failure at inference | Mel count mismatch, 80 against 128 | Log the feature shape at both ends |
| Wrong input for Whisper | dB-mel, not log-mel | Feed log-mel |
| WER doubles in production | Normalization drift | Use the same normalization in training and inference |
| Flat spectrum in the last frames | Zero padding at the end | Pad symmetrically or replicate |
| FFT convolution wraps around | The DFT computes circular convolution | Zero-pad to N + M - 1 |

## Questions
type: qa
from: phases/01-math-foundations/19-complex-numbers/docs/en.md, phases/01-math-foundations/20-fourier-transform/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md

- **Does zero-padding add resolution?** No. Resolution needs $T = 1 / \Delta f$ seconds of data.
- **Why keep only the first N/2 + 1 bins?** For real input, $X[N-k]$ is the conjugate of $X[k]$.
- **Why is i a rotation?** Multiply by i to turn 90 degrees. Two turns give $i^2 = -1$.
- **How does RoPE use this?** It rotates queries and keys. Relative position becomes an angle.
- **Why mel, not Hz?** People hear pitch on a log scale. 100 to 200 Hz sounds like 1000 to 2000 Hz.
- **What does Parseval say?** Energy is the same in the time and frequency domains.

## Tips
type: tips
from: phases/01-math-foundations/19-complex-numbers/docs/en.md, phases/01-math-foundations/20-fourier-transform/docs/en.md, phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md

- Start with 80 log-mels unless you work on music.
- A larger FFT gives better frequency resolution and worse time resolution.
- Use a power of 2 length for the FFT. Zero-pad to the next power of 2.
- The N roots of unity have magnitude 1 and sum to zero.
- Check `idft(dft(x))` against x. It must match to machine precision.
- MFCC coefficient 0 encodes overall energy. Models usually drop it.
