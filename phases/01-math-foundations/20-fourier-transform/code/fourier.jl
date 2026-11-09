# Lesson: Fourier Transform (phase 01 / lesson 20)
# Julia port of code/fourier.py. Julia standard library only.
# Source: phases/01-math-foundations/20-fourier-transform/docs/en.md
# Run: julia code/fourier.jl

using Printf
using Random

pybool(b) = b ? "True" : "False"
commas(n::Integer) = replace(string(n), r"(?<=\d)(?=(\d{3})+$)" => ",")

euler(theta) = complex(cos(theta), sin(theta))

function dft(x)
    N = length(x)
    result = ComplexF64[]
    for k in 0:N-1
        total = 0.0 + 0.0im
        for n in 0:N-1
            total += x[n+1] * euler(-2pi * k * n / N)
        end
        push!(result, total)
    end
    return result
end

function idft(X)
    N = length(X)
    result = ComplexF64[]
    for n in 0:N-1
        total = 0.0 + 0.0im
        for k in 0:N-1
            total += X[k+1] * euler(2pi * k * n / N)
        end
        push!(result, total / N)
    end
    return result
end

function fft(x)
    N = length(x)
    N == 0 && return ComplexF64[]
    N == 1 && return ComplexF64[x[1]]
    N % 2 != 0 && return dft(x)
    even = fft(x[1:2:end])
    odd = fft(x[2:2:end])
    result = zeros(ComplexF64, N)
    half = N ÷ 2
    for k in 0:half-1
        t = euler(-2pi * k / N) * odd[k+1]
        result[k+1] = even[k+1] + t
        result[k+1+half] = even[k+1] - t
    end
    return result
end

function ifft(X)
    N = length(X)
    N == 0 && return ComplexF64[]
    return conj.(fft(conj.(ComplexF64.(X)))) ./ N
end

power_spectrum(X) = abs2.(X)
magnitude_spectrum(X) = abs.(X)

function spectral_analysis(signal, sample_rate)
    N = length(signal)
    mags = magnitude_spectrum(fft(signal))
    freqs = [k * sample_rate / N for k in 0:N-1]
    return freqs[1:N÷2+1], mags[1:N÷2+1]
end

hann_window(N) = [0.5 * (1 - cos(2pi * n / (N - 1))) for n in 0:N-1]
hamming_window(N) = [0.54 - 0.46 * cos(2pi * n / (N - 1)) for n in 0:N-1]
apply_window(signal, window) = signal .* window

function convolve_direct(x, h)
    N, M = length(x), length(h)
    (N == 0 || M == 0) && return Float64[]
    result = zeros(N + M - 1)
    for n in 0:N+M-2
        total = 0.0
        for k in 0:M-1
            if 0 <= n - k < N
                total += x[n-k+1] * h[k+1]
            end
        end
        result[n+1] = total
    end
    return result
end

function convolve_fft(x, h)
    (isempty(x) || isempty(h)) && return Float64[]
    N = length(x) + length(h) - 1
    padded = 1
    while padded < N
        padded *= 2
    end
    X = fft(vcat(x, zeros(padded - length(x))))
    H = fft(vcat(h, zeros(padded - length(h))))
    return real.(ifft(X .* H))[1:N]
end

function generate_signal(frequencies, amplitudes, N, sample_rate)
    signal = zeros(N)
    for (freq, amp) in zip(frequencies, amplitudes)
        for n in 0:N-1
            signal[n+1] += amp * sin(2pi * freq * (n / sample_rate))
        end
    end
    return signal
end

function positional_encoding(pos, d_model)
    pe = zeros(d_model)
    for i in 0:(d_model+1)÷2-1
        angle = pos * (1.0 / (10000^(2 * i / d_model)))
        pe[2i+1] = sin(angle)
        if 2i + 1 < d_model
            pe[2i+2] = cos(angle)
        end
    end
    return pe
end

function banner(title)
    println("="^65)
    println("  ", title)
    println("="^65)
end

function demo_pure_sine()
    banner("DFT OF A PURE SINE WAVE")
    println()
    N, sample_rate, freq = 32, 32, 5
    signal = generate_signal([freq], [1.0], N, sample_rate)
    println("  Signal: sin(2*pi*$freq*t), $N samples at $sample_rate Hz\n")
    mags = magnitude_spectrum(dft(signal))
    @printf("  %-12s %14s %10s\n", "Freq bin k", "Frequency (Hz)", "|X[k]|")
    println("  ", "-"^12, " ", "-"^14, " ", "-"^10)
    for k in 0:N÷2
        if mags[k+1] > 0.01
            @printf("  k=%-8d %14.1f %10.4f\n", k, k * sample_rate / N, mags[k+1])
        end
    end
    println("\n  Peak at k=$freq, corresponding to $freq Hz.")
    println("  The DFT correctly identified the frequency.")
end

function demo_multi_frequency()
    println("\n")
    banner("DFT OF SUMMED SINE WAVES")
    println()
    N, sample_rate = 64, 64
    freqs = [3, 7, 15]
    amps = [1.0, 0.5, 0.3]
    signal = generate_signal(freqs, amps, N, sample_rate)
    println("  Signal: $(amps[1])*sin(2*pi*$(freqs[1])*t) + $(amps[2])*sin(2*pi*$(freqs[2])*t) + $(amps[3])*sin(2*pi*$(freqs[3])*t)")
    println("  $N samples at $sample_rate Hz\n")
    mags = magnitude_spectrum(fft(signal))
    println("  Frequencies recovered (magnitude > 0.5):")
    @printf("  %10s %10s %20s\n", "Freq (Hz)", "|X[k]|", "Expected amp * N/2")
    println("  ", "-"^10, " ", "-"^10, " ", "-"^20)
    for k in 0:N÷2
        if mags[k+1] > 0.5
            f_hz = k * sample_rate / N
            expected = ""
            for (freq, amp) in zip(freqs, amps)
                abs(f_hz - freq) < 0.1 && (expected = @sprintf("%.1f", amp * N / 2))
            end
            @printf("  %10.1f %10.4f %20s\n", f_hz, mags[k+1], expected)
        end
    end
    println("\n  All three frequencies correctly recovered.")
    println("  Amplitudes match expected values (amplitude * N/2).")
end

function demo_fft_vs_dft()
    println("\n")
    banner("FFT vs DFT: SAME RESULT, FASTER")
    println()
    N = 32
    signal = randn(MersenneTwister(42), N)
    X_dft = dft(signal)
    X_fft = fft(signal)
    max_error = maximum(max(abs(real(a - b)), abs(imag(a - b))) for (a, b) in zip(X_dft, X_fft))
    println("  Random signal, N = $N")
    @printf("  Max difference between DFT and FFT: %.2e\n", max_error)
    println("  Match: ", pybool(max_error < 1e-10), "\n")
    @printf("  %-6s %14s %14s %12s\n", "k", "DFT |X[k]|", "FFT |X[k]|", "Diff")
    println("  ", "-"^6, " ", "-"^14, " ", "-"^14, " ", "-"^12)
    for k in 0:7
        d, f = abs(X_dft[k+1]), abs(X_fft[k+1])
        @printf("  %-6d %14.8f %14.8f %12.2e\n", k, d, f, abs(d - f))
    end
    println("  ... ($(N - 8) more coefficients)\n")
    println("  DFT complexity: O(N^2) = $(N * N) multiplications")
    println("  FFT complexity: O(N*log2(N)) = $(floor(Int, N * log2(N))) multiplications")
    @printf("  Speedup: %.1fx\n", N * N / (N * log2(N)))
end

function demo_reconstruction()
    println("\n")
    banner("PERFECT RECONSTRUCTION: DFT -> IDFT")
    println()
    N = 16
    signal = 2 .* randn(MersenneTwister(99), N)
    rec = real.(ifft(fft(signal)))
    max_err = maximum(abs.(rec .- signal))
    println("  Original and reconstructed signal (N=$N):")
    @printf("  %-4s %12s %14s %12s\n", "n", "Original", "Reconstructed", "Error")
    println("  ", "-"^4, " ", "-"^12, " ", "-"^14, " ", "-"^12)
    for n in 1:N
        @printf("  %-4d %12.6f %14.6f %12.2e\n", n - 1, signal[n], rec[n], abs(rec[n] - signal[n]))
    end
    @printf("\n  Max reconstruction error: %.2e\n", max_err)
    println("  Perfect reconstruction: ", pybool(max_err < 1e-10))
end

function demo_convolution_theorem()
    println("\n")
    banner("CONVOLUTION THEOREM")
    println()
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    h = [1.0, 1.0, 1.0]
    direct = convolve_direct(x, h)
    viafft = convolve_fft(x, h)
    println("  Signal x = [1.0, 2.0, 3.0, 4.0, 5.0]")
    println("  Filter h = [1.0, 1.0, 1.0]")
    println("  Linear convolution (x * h):\n")
    @printf("  %-4s %10s %10s %12s\n", "n", "Direct", "FFT-based", "Diff")
    println("  ", "-"^4, " ", "-"^10, " ", "-"^10, " ", "-"^12)
    max_err = 0.0
    for n in eachindex(direct)
        diff = abs(direct[n] - viafft[n])
        max_err = max(max_err, diff)
        @printf("  %-4d %10.4f %10.4f %12.2e\n", n - 1, direct[n], viafft[n], diff)
    end
    @printf("\n  Max difference: %.2e\n", max_err)
    println("  Match: ", pybool(max_err < 1e-8), "\n")
    println("  Convolution in time = multiplication in frequency.")
    println("  Direct convolution: O(N*M) = O(15)")
    println("  FFT convolution: O(N*log(N)) for large N")
end

function demo_windowing()
    println("\n")
    banner("WINDOWING AND SPECTRAL LEAKAGE")
    println()
    N, sample_rate, freq = 64, 64, 7.5
    signal = [sin(2pi * freq * n / sample_rate) for n in 0:N-1]
    m_rect = magnitude_spectrum(fft(signal))
    m_hann = magnitude_spectrum(fft(apply_window(signal, hann_window(N))))
    m_hamm = magnitude_spectrum(fft(apply_window(signal, hamming_window(N))))
    println("  Signal: sin(2*pi*$freq*t) -- frequency is between bins")
    println("  N = $N, sample rate = $sample_rate Hz")
    @printf("  Frequency resolution: %.2f Hz per bin\n", sample_rate / N)
    println("  $freq Hz falls between bin 7 and bin 8\n")
    @printf("  %10s %12s %12s %12s\n", "Freq (Hz)", "No window", "Hann", "Hamming")
    println("  ", "-"^10, " ", "-"^12, " ", "-"^12, " ", "-"^12)
    for k in 0:N÷2
        f_hz = k * sample_rate / N
        if m_rect[k+1] > 0.5 || 5 <= f_hz <= 11
            @printf("  %10.1f %12.4f %12.4f %12.4f\n", f_hz, m_rect[k+1], m_hann[k+1], m_hamm[k+1])
        end
    end
    println("\n  Without windowing, energy leaks into neighboring bins.")
    println("  Hann and Hamming windows concentrate energy near the true frequency.")
    println("  Tradeoff: windows widen the main peak but suppress side lobes.")
end

function demo_parseval()
    println("\n")
    banner("PARSEVAL'S THEOREM: ENERGY CONSERVATION")
    println()
    N = 32
    signal = randn(MersenneTwister(7), N)
    time_energy = sum(signal .^ 2)
    freq_energy = sum(power_spectrum(fft(signal))) / N
    println("  Signal: $N random samples")
    @printf("  Time-domain energy:  sum |x[n]|^2 = %.6f\n", time_energy)
    @printf("  Freq-domain energy:  (1/N) sum |X[k]|^2 = %.6f\n", freq_energy)
    @printf("  Difference: %.2e\n", abs(time_energy - freq_energy))
    println("  Energy conserved: ", pybool(abs(time_energy - freq_energy) < 1e-10))
end

function demo_positional_encoding()
    println("\n")
    banner("POSITIONAL ENCODING FREQUENCIES")
    println()
    d_model, max_pos = 16, 8
    println("  d_model = $d_model, positions 0-$(max_pos - 1)\n")
    println("  Frequency at each dimension pair:")
    for i in 0:d_model÷2-1
        freq = 1.0 / (10000^(2 * i / d_model))
        @printf("    dim (%2d,%2d): freq = %.8f  wavelength = %.1f\n", 2i, 2i + 1, freq, 2pi / freq)
    end
    println("\n  Dot product between position encodings:")
    println("  (depends only on distance, not absolute position)\n")
    @printf("  %6s %6s %6s %12s\n", "pos_i", "pos_j", "dist", "dot product")
    println("  ", "-"^6, " ", "-"^6, " ", "-"^6, " ", "-"^12)
    for (p1, p2) in [(0, 0), (0, 1), (0, 2), (0, 4), (1, 2), (1, 3), (2, 4), (3, 7)]
        d = sum(positional_encoding(p1, d_model) .* positional_encoding(p2, d_model))
        @printf("  %6d %6d %6d %12.4f\n", p1, p2, abs(p2 - p1), d)
    end
    println("\n  Pairs with the same distance have similar dot products.")
    println("  This lets the model learn relative position through attention.")
end

function demo_frequency_scaling()
    println("\n")
    banner("FFT COMPLEXITY SCALING")
    println()
    @printf("  %8s %14s %16s %10s\n", "N", "DFT O(N^2)", "FFT O(N logN)", "Speedup")
    println("  ", "-"^8, " ", "-"^14, " ", "-"^16, " ", "-"^10)
    for e in 3:13
        N = 2^e
        dft_ops = N * N
        fft_ops = floor(Int, N * log2(N))
        @printf("  %8d %14s %16s %10.1fx\n", N, commas(dft_ops), commas(fft_ops), dft_ops / fft_ops)
    end
end

const PROMPT = raw"""
---
name: prompt-spectral-analyzer
description: Guides analysis of frequency content in signals using Fourier transform techniques
phase: 1
lesson: 20
---

You are a spectral analysis expert. You help engineers analyze the frequency content of signals using Fourier transform techniques.

When given a signal or signal description, guide the analysis step by step:

1. **Determine sampling parameters.**
   - What is the sampling rate (fs)? This sets the maximum detectable frequency (Nyquist = fs/2).
   - How many samples (N)? This sets the frequency resolution (delta_f = fs/N).
   - Is the signal length a power of 2? If not, recommend zero-padding for FFT efficiency.

2. **Choose a window function.**
   - Is the signal exactly periodic in the analysis window? If yes, no window needed.
   - For general analysis: use Hann window (good tradeoff between resolution and leakage).
   - For audio/speech: Hamming window.
   - When side lobe suppression matters most: Blackman window.
   - Remember: windowing widens peaks but reduces leakage.

3. **Compute and interpret the spectrum.**
   - Power spectrum |X[k]|^2 shows energy at each frequency.
   - Peaks in the power spectrum indicate dominant frequencies.
   - X[0] is the DC component (signal mean * N).
   - Only look at bins 0 to N/2 for real-valued signals (upper half is the mirror).
   - Frequency of bin k: f_k = k * fs / N.

4. **Identify dominant frequencies.**
   - Find peaks above a noise threshold.
   - Convert bin index to Hz: freq = k * fs / N.
   - Check for harmonics (peaks at integer multiples of a fundamental).
   - Check for aliased frequencies (actual frequency = fs - apparent frequency).

5. **Common pitfalls to watch for.**
   - Spectral leakage: non-integer number of cycles in the window causes energy to spread across bins.
   - Aliasing: if signal contains frequencies above fs/2, they fold back into the spectrum.
   - DC offset: large X[0] can mask nearby low-frequency content. Remove the mean before FFT.
   - Zero-padding increases bin density but does NOT improve actual frequency resolution.
   - Circular vs linear convolution: DFT gives circular convolution. Zero-pad for linear.

6. **For convolution analysis.**
   - Time-domain convolution = frequency-domain multiplication.
   - For large kernels, FFT-based convolution is faster: O(N log N) vs O(N*M).
   - Zero-pad both signals to length N + M - 1 for correct linear convolution.
"""

function write_prompt_output()
    output_path = "outputs/prompt-spectral-analyzer.md"
    try
        write(output_path, PROMPT)
        println("\n  Prompt output written to $output_path")
    catch e
        e isa SystemError || rethrow()
        println("\n  Could not write prompt output (run from the lesson directory)")
    end
end

function print_summary()
    println("\n")
    banner("SUMMARY")
    println()
    println("  1. The DFT converts N time samples to N frequency coefficients.")
    println("  2. Each X[k] measures the signal's correlation with frequency k.")
    println("  3. The FFT computes the DFT in O(N log N) instead of O(N^2).")
    println("  4. DFT and IDFT are perfect inverses -- no information is lost.")
    println("  5. The convolution theorem: convolution in time = multiplication")
    println("     in frequency. This is why FFT-based convolution is fast.")
    println("  6. Windowing reduces spectral leakage for non-periodic signals.")
    println("  7. Parseval's theorem: energy is conserved through the transform.")
    println("  8. Transformer positional encodings use the same frequency")
    println("     decomposition idea -- each position gets a unique spectrum.")
    println()
end

if abspath(PROGRAM_FILE) == @__FILE__
    demo_pure_sine()
    demo_multi_frequency()
    demo_fft_vs_dft()
    demo_reconstruction()
    demo_convolution_theorem()
    demo_windowing()
    demo_parseval()
    demo_positional_encoding()
    demo_frequency_scaling()
    write_prompt_output()
    print_summary()
end
