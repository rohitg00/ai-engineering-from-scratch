# Lesson: Audio Fundamentals: Waveforms, Sampling, FFT (phase 06 / lesson 01)
# Julia port of code/main.py. Julia standard library only.
# Source: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md
# Run: julia code/main.jl

using Printf

function sine(freq_hz, sr, seconds; amp=0.5)
    n = floor(Int, sr * seconds)
    return [amp * sin(2.0 * pi * freq_hz * i / sr) for i in 0:n-1]
end

function mix(signals...)
    len = minimum(length.(signals))
    return [sum(s[i] for s in signals) / length(signals) for i in 1:len]
end

function write_wav(path, samples, sr)
    data = Int16[clamp(trunc(Int, s * 32767), -32768, 32767) for s in samples]
    nbytes = 2 * length(data)
    open(path, "w") do io
        write(io, b"RIFF", htol(UInt32(36 + nbytes)), b"WAVE")
        write(io, b"fmt ", htol(UInt32(16)), htol(UInt16(1)), htol(UInt16(1)))
        write(io, htol(UInt32(sr)), htol(UInt32(sr * 2)), htol(UInt16(2)), htol(UInt16(16)))
        write(io, b"data", htol(UInt32(nbytes)))
        write(io, htol.(data))
    end
end

function read_wav(path)
    open(path, "r") do io
        skip(io, 24)
        sr = Int(ltoh(read(io, UInt32)))
        skip(io, 12)
        nbytes = Int(ltoh(read(io, UInt32)))
        ints = Vector{Int16}(undef, nbytes ÷ 2)
        read!(io, ints)
        return [ltoh(x) / 32768.0 for x in ints], sr
    end
end

function dft(x)
    n = length(x)
    out = Tuple{Float64,Float64}[]
    for k in 0:n-1
        re = 0.0
        im = 0.0
        for j in 0:n-1
            angle = -2.0 * pi * k * j / n
            re += x[j+1] * cos(angle)
            im += x[j+1] * sin(angle)
        end
        push!(out, (re, im))
    end
    return out
end

magnitudes(spectrum) = [sqrt(re * re + im * im) for (re, im) in spectrum]

function peak_freq(samples, sr)
    mags = magnitudes(dft(samples))
    mags = mags[1:length(mags)÷2]
    k = argmax(mags) - 1
    return k * sr / length(samples), k
end

downsample_naive(samples, factor) = samples[1:factor:end]

function main()
    sr = 8000
    duration = 0.064

    println("=== Step 1: synthesize a 440 Hz sine, 8 kHz, 64 ms ===")
    a = sine(440.0, sr, duration)
    println("  samples: $(length(a))")
    println("  first 5: $(string([round(x, digits=4) for x in a[1:5]]))")

    println()
    println("=== Step 2: round-trip through a WAV file ===")
    tmpdir = mktempdir(; prefix="audio_fundamentals_")
    path = joinpath(tmpdir, "a440.wav")
    write_wav(path, a, sr)
    loaded, loaded_sr = read_wav(path)
    size = filesize(path)
    println("  wrote $path ($size bytes, sr=$loaded_sr)")
    diff = maximum(abs(a[i] - loaded[i]) for i in eachindex(a))
    @printf("  round-trip max abs error (16-bit quantization): %.5f\n", diff)

    println()
    println("=== Step 3: DFT peak detection on 440 Hz ===")
    freq, k = peak_freq(a, sr)
    @printf("  peak bin k=%d, freq=%.1f Hz (expected ~440.0 Hz, bin resolution %.2f Hz)\n", k, freq, sr / length(a))

    println()
    println("=== Step 4: mixed signal (220 + 440 + 880) ===")
    mixed = mix(sine(220, sr, duration), sine(440, sr, duration), sine(880, sr, duration))
    mags = magnitudes(dft(mixed))[1:length(mixed)÷2]
    top3 = sortperm(-mags)[1:3] .- 1
    peaks_hz = sort([round(k * sr / length(mixed), digits=1) for k in top3])
    println("  top 3 peaks: $(string(peaks_hz)) Hz")

    println()
    println("=== Step 5: aliasing: 7 kHz tone sampled at 10 kHz ===")
    alias_sr = 10000
    tone = sine(7000.0, alias_sr, 0.0512)
    alias_freq, _ = peak_freq(tone, alias_sr)
    folded = alias_sr - 7000.0
    println("  true frequency: 7000.0 Hz (above Nyquist = $(alias_sr / 2) Hz)")
    @printf("  DFT reports:    %.1f Hz\n", alias_freq)
    @printf("  expected alias: %.1f Hz  (= sr - f_true)\n", folded)

    println()
    println("=== Step 6: proper downsample vs naive decimation ===")
    orig_sr = 24000
    sig = sine(7000.0, orig_sr, 0.032)
    decimated = downsample_naive(sig, 3)
    new_sr = orig_sr ÷ 3
    peak_new, _ = peak_freq(decimated, new_sr)
    println("  24 kHz 7 kHz tone, decimated to 8 kHz without low-pass:")
    @printf("    peak after decimation: %.1f Hz (should be 1000 Hz from folding)\n", peak_new)
    println("    lesson: always low-pass filter before decimating")
end

main()
