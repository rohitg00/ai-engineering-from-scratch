# Lesson: Spectrograms, Mel Scale & Audio Features (phase 06 / lesson 02)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md
# Run: julia code/main.jl

using Printf

function sine(freq_hz, sr, seconds; amp=0.5, phase=0.0)
    n = floor(Int, sr * seconds)
    return [amp * sin(2.0 * pi * freq_hz * i / sr + phase) for i in 0:n-1]
end

function chirp(f0, f1, sr, seconds; amp=0.5)
    n = floor(Int, sr * seconds)
    out = Float64[]
    for i in 0:n-1
        t = i / sr
        f = f0 + (f1 - f0) * (t / seconds)
        push!(out, amp * sin(2.0 * pi * f * t))
    end
    return out
end

hann(N) = [0.5 * (1.0 - cos(2.0 * pi * n / (N - 1))) for n in 0:N-1]

function dft_mag(x)
    n = length(x)
    half = n ÷ 2 + 1
    out = Float64[]
    for k in 0:half-1
        re = 0.0
        im = 0.0
        for j in 0:n-1
            angle = -2.0 * pi * k * j / n
            re += x[j+1] * cos(angle)
            im += x[j+1] * sin(angle)
        end
        push!(out, sqrt(re * re + im * im))
    end
    return out
end

function frame_signal(signal, frame_len, hop)
    length(signal) < frame_len && return Vector{Float64}[]
    n = 1 + (length(signal) - frame_len) ÷ hop
    return [signal[i*hop+1:i*hop+frame_len] for i in 0:n-1]
end

function stft_magnitude(signal, frame_len, hop)
    w = hann(frame_len)
    return [dft_mag(w .* f) for f in frame_signal(signal, frame_len, hop)]
end

hz_to_mel(f) = 2595.0 * log10(1.0 + f / 700.0)
mel_to_hz(m) = 700.0 * (10^(m / 2595.0) - 1.0)

function mel_filterbank(n_mels, n_fft, sr; fmin=0.0, fmax=nothing)
    fmax === nothing && (fmax = sr / 2)
    m_lo = hz_to_mel(fmin)
    m_hi = hz_to_mel(fmax)
    mels = [m_lo + (m_hi - m_lo) * i / (n_mels + 1) for i in 0:n_mels+1]
    hzs = mel_to_hz.(mels)
    half = n_fft ÷ 2 + 1
    bins = [min(half - 1, Int(round(h * n_fft / sr))) for h in hzs]
    fb = [zeros(half) for _ in 1:n_mels]
    for m in 1:n_mels
        left, center, right = bins[m], bins[m+1], bins[m+2]
        for k in left:center-1
            fb[m][k+1] = (k - left) / max(1, center - left)
        end
        for k in center:right-1
            fb[m][k+1] = (right - k) / max(1, right - center)
        end
    end
    return fb
end

function apply_filterbank(stft_mag, fb)
    result = Vector{Float64}[]
    for spec in stft_mag
        frame_mels = Float64[]
        for row in fb
            val = 0.0
            for (k, w) in enumerate(row)
                if w != 0
                    val += spec[k] * w
                end
            end
            push!(frame_mels, val)
        end
        push!(result, frame_mels)
    end
    return result
end

log_transform(mel_spec; eps=1e-10) = [[log(max(v, eps)) for v in frame] for frame in mel_spec]

function dct_ii(x, n_coeffs)
    N = length(x)
    return [sum(x[n+1] * cos(pi * k * (2n + 1) / (2N)) for n in 0:N-1) for k in 0:n_coeffs-1]
end

function main()
    sr = 8000
    frame_len = 256
    hop = 128
    n_mels = 40
    n_fft = frame_len

    println("=== Step 1: frame a 0.5 s, 2 kHz tone ===")
    tone = sine(2000.0, sr, 0.5)
    frames = frame_signal(tone, frame_len, hop)
    println("  samples: $(length(tone)), frames: $(length(frames)), frame_len: $frame_len, hop: $hop")

    println()
    println("=== Step 2: Hann window attenuates frame edges ===")
    w = hann(frame_len)
    @printf("  hann(0) = %.4f   hann(mid) = %.4f   hann(last) = %.4f\n", w[1], w[frame_len÷2+1], w[end])

    println()
    println("=== Step 3: STFT of the tone; argmax bin is at 2000 Hz ===")
    mag = stft_magnitude(tone, frame_len, hop)
    mid = mag[length(mag)÷2+1]
    k_peak = argmax(mid) - 1
    println("  frames: $(length(mag)), bins/frame: $(length(mid))")
    @printf("  peak bin: %d, freq: %.1f Hz (expected 2000 Hz)\n", k_peak, k_peak * sr / n_fft)

    println()
    println("=== Step 4: mel filterbank, 40 mels, 0-4000 Hz ===")
    fb = mel_filterbank(n_mels, n_fft, sr)
    mel_widths = [count(>(0), f) for f in fb]
    println("  filterbank shape: $n_mels x $(length(fb[1]))")
    println("  bin widths (first 6): $(string(mel_widths[1:6]))   (last 6): $(string(mel_widths[end-5:end]))")
    println("  note: low-mel filters are narrow (dense), high-mel filters are wide (sparse).")

    println()
    println("=== Step 5: chirp 200 Hz -> 4000 Hz; argmax mel per frame ===")
    c = chirp(200.0, 4000.0, sr, 0.4)
    cmag = stft_magnitude(c, frame_len, hop)
    lm = log_transform(apply_filterbank(cmag, fb))
    println("  frame -> argmax mel bin:")
    step = max(1, length(lm) ÷ 10)
    for i in 0:step:length(lm)-1
        am = argmax(lm[i+1]) - 1
        @printf("    t=%3d  argmax_mel=%2d\n", i, am)
    end

    println()
    println("=== Step 6: MFCC-13 of a single mel frame ===")
    mfcc = dct_ii(lm[length(lm)÷2+1], 13)
    println("  MFCC (13 coeffs, mid frame): $(string([round(v, digits=3) for v in mfcc]))")
    println("  note: coef 0 encodes overall energy; typically dropped downstream.")
end

main()
