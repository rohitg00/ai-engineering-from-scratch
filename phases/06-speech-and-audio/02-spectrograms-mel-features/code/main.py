"""Spectrograms, mel filterbanks, MFCCs — built from stdlib math.

Run: python3 code/main.py
"""

import math


def sine(freq_hz, sr, seconds, amp=0.5, phase=0.0):
    n = int(sr * seconds)
    return [amp * math.sin(2.0 * math.pi * freq_hz * i / sr + phase) for i in range(n)]


def chirp(f0, f1, sr, seconds, amp=0.5):
    n = int(sr * seconds)
    out = []
    for i in range(n):
        t = i / sr
        f = f0 + (f1 - f0) * (t / seconds)
        out.append(amp * math.sin(2.0 * math.pi * f * t))
    return out


def hann(N):
    return [0.5 * (1.0 - math.cos(2.0 * math.pi * n / (N - 1))) for n in range(N)]


def dft_mag(x):
    n = len(x)
    half = n // 2 + 1
    out = []
    for k in range(half):
        re = 0.0
        im = 0.0
        for j in range(n):
            angle = -2.0 * math.pi * k * j / n
            re += x[j] * math.cos(angle)
            im += x[j] * math.sin(angle)
        out.append(math.sqrt(re * re + im * im))
    return out


def frame_signal(signal, frame_len, hop):
    if len(signal) < frame_len:
        return []
    n = 1 + (len(signal) - frame_len) // hop
    return [signal[i * hop : i * hop + frame_len] for i in range(n)]


def stft_magnitude(signal, frame_len, hop):
    w = hann(frame_len)
    frames = frame_signal(signal, frame_len, hop)
    return [dft_mag([w[j] * f[j] for j in range(frame_len)]) for f in frames]


def hz_to_mel(f):
    return 2595.0 * math.log10(1.0 + f / 700.0)


def mel_to_hz(m):
    return 700.0 * (10 ** (m / 2595.0) - 1.0)


def mel_filterbank(n_mels, n_fft, sr, fmin=0.0, fmax=None):
    if fmax is None:
        fmax = sr / 2
    m_lo = hz_to_mel(fmin)
    m_hi = hz_to_mel(fmax)
    mels = [m_lo + (m_hi - m_lo) * i / (n_mels + 1) for i in range(n_mels + 2)]
    hzs = [mel_to_hz(m) for m in mels]
    half = n_fft // 2 + 1
    bins = [min(half - 1, int(round(h * n_fft / sr))) for h in hzs]
    fb = [[0.0] * half for _ in range(n_mels)]
    for m in range(n_mels):
        left, center, right = bins[m], bins[m + 1], bins[m + 2]
        for k in range(left, center):
            denom = max(1, center - left)
            fb[m][k] = (k - left) / denom
        for k in range(center, right):
            denom = max(1, right - center)
            fb[m][k] = (right - k) / denom
    return fb


def apply_filterbank(stft_mag, fb):
    n_mels = len(fb)
    result = []
    for spec in stft_mag:
        frame_mels = []
        for m in range(n_mels):
            val = 0.0
            for k, w in enumerate(fb[m]):
                if w:
                    val += spec[k] * w
            frame_mels.append(val)
        result.append(frame_mels)
    return result


def log_transform(mel_spec, eps=1e-10):
    return [[math.log(max(v, eps)) for v in frame] for frame in mel_spec]


def dct_ii(x, n_coeffs):
    N = len(x)
    return [
        sum(x[n] * math.cos(math.pi * k * (2 * n + 1) / (2 * N)) for n in range(N))
        for k in range(n_coeffs)
    ]


def main():
    sr = 8000
    frame_len = 256
    hop = 128
    n_mels = 40
    n_fft = frame_len

    print("=== Step 1: frame a 0.5 s, 2 kHz tone ===")
    tone = sine(2000.0, sr, 0.5)
    frames = frame_signal(tone, frame_len, hop)
    print(f"  samples: {len(tone)}, frames: {len(frames)}, frame_len: {frame_len}, hop: {hop}")

    print()
    print("=== Step 2: Hann window attenuates frame edges ===")
    w = hann(frame_len)
    print(f"  hann(0) = {w[0]:.4f}   hann(mid) = {w[frame_len // 2]:.4f}   hann(last) = {w[-1]:.4f}")

    print()
    print("=== Step 3: STFT of the tone; argmax bin is at 2000 Hz ===")
    mag = stft_magnitude(tone, frame_len, hop)
    mid = mag[len(mag) // 2]
    k_peak = max(range(len(mid)), key=lambda i: mid[i])
    print(f"  frames: {len(mag)}, bins/frame: {len(mid)}")
    print(f"  peak bin: {k_peak}, freq: {k_peak * sr / n_fft:.1f} Hz (expected 2000 Hz)")

    print()
    print("=== Step 4: mel filterbank, 40 mels, 0-4000 Hz ===")
    fb = mel_filterbank(n_mels, n_fft, sr)
    mel_widths = [sum(1 for x in f if x > 0) for f in fb]
    print(f"  filterbank shape: {n_mels} x {len(fb[0])}")
    print(f"  bin widths (first 6): {mel_widths[:6]}   (last 6): {mel_widths[-6:]}")
    print("  note: low-mel filters are narrow (dense), high-mel filters are wide (sparse).")

    print()
    print("=== Step 5: chirp 200 Hz -> 4000 Hz; argmax mel per frame ===")
    c = chirp(200.0, 4000.0, sr, 0.4)
    cmag = stft_magnitude(c, frame_len, hop)
    mel_spec = apply_filterbank(cmag, fb)
    lm = log_transform(mel_spec)
    print("  frame -> argmax mel bin:")
    step = max(1, len(lm) // 10)
    for i in range(0, len(lm), step):
        am = max(range(n_mels), key=lambda m: lm[i][m])
        print(f"    t={i:3d}  argmax_mel={am:2d}")

    print()
    print("=== Step 6: MFCC-13 of a single mel frame ===")
    mfcc = dct_ii(lm[len(lm) // 2], 13)
    print(f"  MFCC (13 coeffs, mid frame): {[round(c, 3) for c in mfcc]}")
    print("  note: coef 0 encodes overall energy; typically dropped downstream.")


if __name__ == "__main__":
    main()
