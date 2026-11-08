# Evidence: cheatsheets/signals-fourier.md

Abbreviations: L19 = phases/01-math-foundations/19-complex-numbers, L20 = phases/01-math-foundations/20-fourier-transform, A01 = phases/06-speech-and-audio/01-audio-fundamentals, A02 = phases/06-speech-and-audio/02-spectrograms-mel-features. d = docs/en.md. L20/c = code/fourier.py, A02/c = code/main.py.

## Cooley-Tukey FFT, 8 points (architecture, 6 nodes, 6 edges)
- x[0..7] 8 samples, split even/odd: L20/d:93-94
- Even half x[0,2,4,6]: L20/d:93
- Odd half x[1,3,5,7]: L20/d:94
- E[0..3] from 4-pt FFT: L20/d:95
- O[0..3] from 4-pt FFT: L20/d:96
- X[0..7] combine with twiddle factors: L20/d:97-98
- X[k] = E[k] + twiddle O[k], X[k + N/2] = E[k] - twiddle O[k]: L20/d:81-82

## Waveform to log-mel and MFCC (flow, 6 steps)
1. 25 ms window, 10 ms hop, 400 and 160 samples at 16 kHz: A02/d:22
2. hann(N) window tapers edges: A02/d:57-61, 161
3. FFT magnitude per frame, shape (n_frames, n_freq_bins): A02/d:22
4. Triangular filterbank, 80 mels over 0 to 8 kHz: A02/d:26-28
5. log(mel_spec + 1e-10): A02/d:30
6. DCT type II, first 13 coefficients: A02/d:32, 120

## Tasks in code (task-table, 8 rows)
- point * euler(math.pi / 4): L19/d:338-339
- roots_of_unity(N): L19/d:383-384
- dft(x), idft(X), O(N^2): L20/d:300, 319, L19/d:359
- fft(x) power of 2: L20/d:334-337
- power_spectrum(X): L20/d:360
- convolve_fft(x, h), zero-pads to len(x) + len(h) - 1: L20/d:363-378
- frame(signal, frame_len, hop): A02/d:45
- mel_filterbank(n_mels, n_fft, sr): A02/d:83

## Spectra in NumPy and SciPy (annotated-code, 9 lines)
- sf.read("clip.wav", dtype="float32"), float32 in [-1, 1]: A01/d:41, 61
- np.fft.fft(signal), np.fft.fftfreq(256, d=1/256), np.abs(spectrum) ** 2: L20/d:389-392
- windows.hann(256) from scipy.signal: L20/d:401-403
- fftconvolve(signal, kernel, mode='full'): L20/d:411-413
- stft(signal, fs=sample_rate, nperseg=256), np.abs(Zxx) ** 2: L20/d:421-422
- Shape (n_frequencies, n_time_frames): L20/d:425
- print(cmath.exp(1j * cmath.pi)): L19/d:405-407, e^{i pi} = -1: L19/d:138

## Mel features from scratch (annotated-code, 7 lines)
- hz_to_mel: A02/d:77-78, A02/c:56-57
- stft_magnitude(signal, frame_len=400, hop=160), Hann + DFT: A02/d:66-69
- mel_filterbank, 80 mels with n_fft=400 gives (80, 201): A02/d:98, A02/c:64
- mel_spec = apply_filterbank(cmag, fb): A02/c:85, 149
- lm = log_transform(mel_spec), eps=1e-10: A02/c:100, 150
- mfcc = dct_ii(lm[len(lm) // 2], 13), coef 0 is energy: A02/c:159-161

## Key formulas (concepts, 8 bullets)
- Complex multiply, magnitudes multiply and angles add: L19/d:61, 114-120
- Polar r and atan2: L19/d:107-108
- Euler and rotation: L19/d:131, 153
- DFT definition: L20/d:34
- Inverse DFT, positive exponent, 1/N, exact: L20/d:60-65
- Bin frequency, resolution, Nyquist: L20/d:127-129
- Convolution theorem: L20/d:143
- Mel formula: A02/d:26

## Sample rates (command-table, 6 rows)
- 8 kHz: A01/d:32
- 16 kHz, 10 s at 16 kHz is 160,000 floats: A01/d:26, 33
- 22.05 kHz: A01/d:34
- 24 kHz: A01/d:35
- 44.1 kHz: A01/d:36
- 48 kHz: A01/d:37

## Window functions (command-table, 4 rows)
- Rectangular -13 dB: L20/d:183
- Hann formula, -31 dB: L20/d:184, 190
- Hamming formula, -42 dB: L20/d:185, 191
- Blackman -58 dB: L20/d:186

## Numbers and defaults (defaults, 8 rows)
- 400 samples, 25 ms: A02/d:22, 50
- 160 hop, 10 ms, 998 frames for 10 s: A02/d:22, 50
- 80 mels, 128 for audio classification: A02/d:26, 130
- 13 MFCCs, 40 for keyword spotting: A02/d:32, 133
- 1e-10 log-mel eps: A02/d:30
- 1e-6 log-magnitude eps: A02/d:24
- 1024-point FFT at 16 kHz, 512 bins, 15.6 Hz: A01/d:45
- 16-bit PCM, ±32,767: A01/d:41

## Troubleshooting (troubleshooting, 8 rows)
- Sample rate mismatch looks like a model bug, 16 kHz mono float32: A01/d:111
- 7 kHz at 10 kHz folds to 3 kHz: A01/d:97; low-pass before downsampling: A01/d:39
- Spectral leakage, windowing: L20/d:175-177
- Mel count mismatch: A02/d:139
- dB vs log for Whisper: A02/d:141
- Normalization drift doubles WER: A02/d:142
- Padding leakage: A02/d:143
- Circular convolution, zero-pad to N + M - 1: L20/d:155

## Questions (qa, 6 bullets)
- Zero-padding does not increase resolution, T = 1 / delta f: L20/d:280-282
- Conjugate symmetry, first N/2 + 1 coefficients: L20/d:53
- i is a 90-degree rotation: L19/d:220
- RoPE rotates query and key vectors: L19/d:245
- Mel and log pitch perception: A02/d:16
- Parseval energy preserved: L20/d:209

## Tips (tips, 6 bullets)
- Start with 80 log-mels unless music: A02/d:135
- FFT size trades frequency for time resolution: A02/d:34
- Power of 2, zero-pad: L20/d:106
- Roots of unity magnitude 1, sum zero: L19/d:387-389
- DFT then IDFT gives back the signal: L19/d:378
- Coefficient 0 encodes energy, dropped: A02/d:120
