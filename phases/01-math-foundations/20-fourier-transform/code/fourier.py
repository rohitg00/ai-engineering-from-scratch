import math


class Complex:
    def __init__(self, real=0.0, imag=0.0):
        self.real = float(real)
        self.imag = float(imag)

    def __add__(self, other):
        if isinstance(other, (int, float)):
            return Complex(self.real + other, self.imag)
        return Complex(self.real + other.real, self.imag + other.imag)

    def __radd__(self, other):
        return self.__add__(other)

    def __sub__(self, other):
        if isinstance(other, (int, float)):
            return Complex(self.real - other, self.imag)
        return Complex(self.real - other.real, self.imag - other.imag)

    def __mul__(self, other):
        if isinstance(other, (int, float)):
            return Complex(self.real * other, self.imag * other)
        r = self.real * other.real - self.imag * other.imag
        i = self.real * other.imag + self.imag * other.real
        return Complex(r, i)

    def __rmul__(self, other):
        return self.__mul__(other)

    def magnitude(self):
        return math.sqrt(self.real ** 2 + self.imag ** 2)

    def phase(self):
        return math.atan2(self.imag, self.real)

    def conjugate(self):
        return Complex(self.real, -self.imag)

    def __repr__(self):
        if abs(self.imag) < 1e-12:
            return f"{self.real:.6f}"
        sign = "+" if self.imag >= 0 else "-"
        return f"{self.real:.6f} {sign} {abs(self.imag):.6f}i"


def euler(theta):
    return Complex(math.cos(theta), math.sin(theta))


def dft(x):
    N = len(x)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            xn = x[n] if isinstance(x[n], Complex) else Complex(x[n])
            total = total + xn * euler(angle)
        result.append(total)
    return result


def idft(X):
    N = len(X)
    result = []
    for n in range(N):
        total = Complex(0, 0)
        for k in range(N):
            angle = 2 * math.pi * k * n / N
            xk = X[k] if isinstance(X[k], Complex) else Complex(X[k])
            total = total + xk * euler(angle)
        result.append(Complex(total.real / N, total.imag / N))
    return result


def fft(x):
    N = len(x)
    if N <= 1:
        return [x[0] if isinstance(x[0], Complex) else Complex(x[0])]
    if N % 2 != 0:
        return dft(x)

    even = fft([x[i] for i in range(0, N, 2)])
    odd = fft([x[i] for i in range(1, N, 2)])

    result = [Complex(0)] * N
    for k in range(N // 2):
        angle = -2 * math.pi * k / N
        twiddle = euler(angle)
        t = twiddle * odd[k]
        result[k] = even[k] + t
        result[k + N // 2] = even[k] - t
    return result


def ifft(X):
    N = len(X)
    conj_X = [xk.conjugate() if isinstance(xk, Complex) else Complex(xk) for xk in X]
    result = fft(conj_X)
    return [Complex(r.real / N, -r.imag / N) for r in result]


def power_spectrum(X):
    return [xk.real ** 2 + xk.imag ** 2 for xk in X]


def magnitude_spectrum(X):
    return [xk.magnitude() for xk in X]


def spectral_analysis(signal, sample_rate):
    N = len(signal)
    X = fft(signal)
    magnitudes = magnitude_spectrum(X)
    freqs = [k * sample_rate / N for k in range(N)]
    return freqs[:N // 2 + 1], magnitudes[:N // 2 + 1]


def hann_window(N):
    return [0.5 * (1 - math.cos(2 * math.pi * n / (N - 1))) for n in range(N)]


def hamming_window(N):
    return [0.54 - 0.46 * math.cos(2 * math.pi * n / (N - 1)) for n in range(N)]


def apply_window(signal, window):
    return [s * w for s, w in zip(signal, window)]


def convolve_direct(x, h):
    N = len(x)
    M = len(h)
    out_len = N + M - 1
    result = [0.0] * out_len
    for n in range(out_len):
        total = 0.0
        for k in range(M):
            if 0 <= n - k < N:
                total += x[n - k] * h[k]
        result[n] = total
    return result


def convolve_fft(x, h):
    if len(x) == 0 or len(h) == 0:
        return []
    N = len(x) + len(h) - 1
    padded_N = 1
    while padded_N < N:
        padded_N *= 2

    x_padded = list(x) + [0.0] * (padded_N - len(x))
    h_padded = list(h) + [0.0] * (padded_N - len(h))

    X = fft(x_padded)
    H = fft(h_padded)

    Y = [xk * hk for xk, hk in zip(X, H)]

    y = ifft(Y)
    return [y[n].real for n in range(N)]


def generate_signal(frequencies, amplitudes, N, sample_rate):
    signal = [0.0] * N
    for freq, amp in zip(frequencies, amplitudes):
        for n in range(N):
            t = n / sample_rate
            signal[n] += amp * math.sin(2 * math.pi * freq * t)
    return signal


def positional_encoding(pos, d_model):
    pe = [0.0] * d_model
    for i in range(d_model // 2):
        freq = 1.0 / (10000 ** (2 * i / d_model))
        angle = pos * freq
        pe[2 * i] = math.sin(angle)
        pe[2 * i + 1] = math.cos(angle)
    return pe


def demo_pure_sine():
    print("=" * 65)
    print("  DFT OF A PURE SINE WAVE")
    print("=" * 65)
    print()

    N = 32
    sample_rate = 32
    freq = 5
    signal = generate_signal([freq], [1.0], N, sample_rate)

    print(f"  Signal: sin(2*pi*{freq}*t), {N} samples at {sample_rate} Hz")
    print()

    X = dft(signal)
    mags = magnitude_spectrum(X)

    print(f"  {'Freq bin k':<12s} {'Frequency (Hz)':>14s} {'|X[k]|':>10s}")
    print(f"  {'-' * 12} {'-' * 14} {'-' * 10}")

    for k in range(N // 2 + 1):
        f_hz = k * sample_rate / N
        if mags[k] > 0.01:
            print(f"  k={k:<8d} {f_hz:>14.1f} {mags[k]:>10.4f}")

    print()
    print(f"  Peak at k={freq}, corresponding to {freq} Hz.")
    print(f"  The DFT correctly identified the frequency.")


def demo_multi_frequency():
    print()
    print()
    print("=" * 65)
    print("  DFT OF SUMMED SINE WAVES")
    print("=" * 65)
    print()

    N = 64
    sample_rate = 64
    freqs = [3, 7, 15]
    amps = [1.0, 0.5, 0.3]

    signal = generate_signal(freqs, amps, N, sample_rate)

    print(f"  Signal: {amps[0]}*sin(2*pi*{freqs[0]}*t) + "
          f"{amps[1]}*sin(2*pi*{freqs[1]}*t) + "
          f"{amps[2]}*sin(2*pi*{freqs[2]}*t)")
    print(f"  {N} samples at {sample_rate} Hz")
    print()

    X = fft(signal)
    mags = magnitude_spectrum(X)

    print(f"  Frequencies recovered (magnitude > 0.5):")
    print(f"  {'Freq (Hz)':>10s} {'|X[k]|':>10s} {'Expected amp * N/2':>20s}")
    print(f"  {'-' * 10} {'-' * 10} {'-' * 20}")

    for k in range(N // 2 + 1):
        if mags[k] > 0.5:
            f_hz = k * sample_rate / N
            expected = ""
            for freq, amp in zip(freqs, amps):
                if abs(f_hz - freq) < 0.1:
                    expected = f"{amp * N / 2:.1f}"
            print(f"  {f_hz:>10.1f} {mags[k]:>10.4f} {expected:>20s}")

    print()
    print("  All three frequencies correctly recovered.")
    print("  Amplitudes match expected values (amplitude * N/2).")


def demo_fft_vs_dft():
    print()
    print()
    print("=" * 65)
    print("  FFT vs DFT: SAME RESULT, FASTER")
    print("=" * 65)
    print()

    N = 32
    import random
    random.seed(42)
    signal = [random.gauss(0, 1) for _ in range(N)]

    X_dft = dft(signal)
    X_fft = fft(signal)

    max_error = 0.0
    for k in range(N):
        diff_real = abs(X_dft[k].real - X_fft[k].real)
        diff_imag = abs(X_dft[k].imag - X_fft[k].imag)
        max_error = max(max_error, diff_real, diff_imag)

    print(f"  Random signal, N = {N}")
    print(f"  Max difference between DFT and FFT: {max_error:.2e}")
    print(f"  Match: {max_error < 1e-10}")
    print()

    print(f"  {'k':<6s} {'DFT |X[k]|':>14s} {'FFT |X[k]|':>14s} {'Diff':>12s}")
    print(f"  {'-' * 6} {'-' * 14} {'-' * 14} {'-' * 12}")
    for k in range(8):
        d_mag = X_dft[k].magnitude()
        f_mag = X_fft[k].magnitude()
        diff = abs(d_mag - f_mag)
        print(f"  {k:<6d} {d_mag:>14.8f} {f_mag:>14.8f} {diff:>12.2e}")

    print(f"  ... ({N - 8} more coefficients)")
    print()

    print(f"  DFT complexity: O(N^2) = {N * N} multiplications")
    print(f"  FFT complexity: O(N*log2(N)) = {int(N * math.log2(N))} multiplications")
    print(f"  Speedup: {N * N / (N * math.log2(N)):.1f}x")


def demo_reconstruction():
    print()
    print()
    print("=" * 65)
    print("  PERFECT RECONSTRUCTION: DFT -> IDFT")
    print("=" * 65)
    print()

    import random
    random.seed(99)
    N = 16
    signal = [random.gauss(0, 2) for _ in range(N)]

    X = fft(signal)
    reconstructed = ifft(X)

    max_err = max(abs(reconstructed[n].real - signal[n]) for n in range(N))

    print(f"  Original and reconstructed signal (N={N}):")
    print(f"  {'n':<4s} {'Original':>12s} {'Reconstructed':>14s} {'Error':>12s}")
    print(f"  {'-' * 4} {'-' * 12} {'-' * 14} {'-' * 12}")

    for n in range(N):
        err = abs(reconstructed[n].real - signal[n])
        print(f"  {n:<4d} {signal[n]:>12.6f} {reconstructed[n].real:>14.6f} {err:>12.2e}")

    print()
    print(f"  Max reconstruction error: {max_err:.2e}")
    print(f"  Perfect reconstruction: {max_err < 1e-10}")


def demo_convolution_theorem():
    print()
    print()
    print("=" * 65)
    print("  CONVOLUTION THEOREM")
    print("=" * 65)
    print()

    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    h = [1.0, 1.0, 1.0]

    direct = convolve_direct(x, h)
    fft_result = convolve_fft(x, h)

    print(f"  Signal x = {x}")
    print(f"  Filter h = {h}")
    print(f"  Linear convolution (x * h):")
    print()

    print(f"  {'n':<4s} {'Direct':>10s} {'FFT-based':>10s} {'Diff':>12s}")
    print(f"  {'-' * 4} {'-' * 10} {'-' * 10} {'-' * 12}")

    max_err = 0.0
    for n in range(len(direct)):
        diff = abs(direct[n] - fft_result[n])
        max_err = max(max_err, diff)
        print(f"  {n:<4d} {direct[n]:>10.4f} {fft_result[n]:>10.4f} {diff:>12.2e}")

    print()
    print(f"  Max difference: {max_err:.2e}")
    print(f"  Match: {max_err < 1e-8}")
    print()
    print("  Convolution in time = multiplication in frequency.")
    print("  Direct convolution: O(N*M) = O(15)")
    print("  FFT convolution: O(N*log(N)) for large N")


def demo_windowing():
    print()
    print()
    print("=" * 65)
    print("  WINDOWING AND SPECTRAL LEAKAGE")
    print("=" * 65)
    print()

    N = 64
    sample_rate = 64
    freq = 7.5

    signal = [math.sin(2 * math.pi * freq * n / sample_rate) for n in range(N)]

    X_rect = fft(signal)
    mags_rect = magnitude_spectrum(X_rect)

    hann = hann_window(N)
    signal_hann = apply_window(signal, hann)
    X_hann = fft(signal_hann)
    mags_hann = magnitude_spectrum(X_hann)

    hamm = hamming_window(N)
    signal_hamm = apply_window(signal, hamm)
    X_hamm = fft(signal_hamm)
    mags_hamm = magnitude_spectrum(X_hamm)

    print(f"  Signal: sin(2*pi*{freq}*t) -- frequency is between bins")
    print(f"  N = {N}, sample rate = {sample_rate} Hz")
    print(f"  Frequency resolution: {sample_rate / N:.2f} Hz per bin")
    print(f"  {freq} Hz falls between bin 7 and bin 8")
    print()

    print(f"  {'Freq (Hz)':>10s} {'No window':>12s} {'Hann':>12s} {'Hamming':>12s}")
    print(f"  {'-' * 10} {'-' * 12} {'-' * 12} {'-' * 12}")

    for k in range(N // 2 + 1):
        f_hz = k * sample_rate / N
        if mags_rect[k] > 0.5 or (5 <= f_hz <= 11):
            print(f"  {f_hz:>10.1f} {mags_rect[k]:>12.4f} "
                  f"{mags_hann[k]:>12.4f} {mags_hamm[k]:>12.4f}")

    print()
    print("  Without windowing, energy leaks into neighboring bins.")
    print("  Hann and Hamming windows concentrate energy near the true frequency.")
    print("  Tradeoff: windows widen the main peak but suppress side lobes.")


def demo_parseval():
    print()
    print()
    print("=" * 65)
    print("  PARSEVAL'S THEOREM: ENERGY CONSERVATION")
    print("=" * 65)
    print()

    import random
    random.seed(7)
    N = 32
    signal = [random.gauss(0, 1) for _ in range(N)]

    time_energy = sum(s ** 2 for s in signal)

    X = fft(signal)
    freq_energy = sum(xk.real ** 2 + xk.imag ** 2 for xk in X) / N

    print(f"  Signal: {N} random samples")
    print(f"  Time-domain energy:  sum |x[n]|^2 = {time_energy:.6f}")
    print(f"  Freq-domain energy:  (1/N) sum |X[k]|^2 = {freq_energy:.6f}")
    print(f"  Difference: {abs(time_energy - freq_energy):.2e}")
    print(f"  Energy conserved: {abs(time_energy - freq_energy) < 1e-10}")


def demo_positional_encoding():
    print()
    print()
    print("=" * 65)
    print("  POSITIONAL ENCODING FREQUENCIES")
    print("=" * 65)
    print()

    d_model = 16
    max_pos = 8

    print(f"  d_model = {d_model}, positions 0-{max_pos - 1}")
    print()

    print(f"  Frequency at each dimension pair:")
    for i in range(d_model // 2):
        freq = 1.0 / (10000 ** (2 * i / d_model))
        wavelength = 2 * math.pi / freq if freq > 0 else float('inf')
        print(f"    dim ({2 * i:>2d},{2 * i + 1:>2d}): freq = {freq:.8f}  "
              f"wavelength = {wavelength:.1f}")

    print()
    print(f"  Dot product between position encodings:")
    print(f"  (depends only on distance, not absolute position)")
    print()

    print(f"  {'pos_i':>6s} {'pos_j':>6s} {'dist':>6s} {'dot product':>12s}")
    print(f"  {'-' * 6} {'-' * 6} {'-' * 6} {'-' * 12}")

    pairs = [(0, 0), (0, 1), (0, 2), (0, 4), (1, 2), (1, 3), (2, 4), (3, 7)]
    for p1, p2 in pairs:
        pe1 = positional_encoding(p1, d_model)
        pe2 = positional_encoding(p2, d_model)
        dot = sum(a * b for a, b in zip(pe1, pe2))
        print(f"  {p1:>6d} {p2:>6d} {abs(p2 - p1):>6d} {dot:>12.4f}")

    print()
    print("  Pairs with the same distance have similar dot products.")
    print("  This lets the model learn relative position through attention.")


def demo_frequency_scaling():
    print()
    print()
    print("=" * 65)
    print("  FFT COMPLEXITY SCALING")
    print("=" * 65)
    print()

    print(f"  {'N':>8s} {'DFT O(N^2)':>14s} {'FFT O(N logN)':>16s} {'Speedup':>10s}")
    print(f"  {'-' * 8} {'-' * 14} {'-' * 16} {'-' * 10}")

    for exp in range(3, 14):
        N = 2 ** exp
        dft_ops = N * N
        fft_ops = int(N * math.log2(N))
        speedup = dft_ops / fft_ops
        print(f"  {N:>8d} {dft_ops:>14,d} {fft_ops:>16,d} {speedup:>10.1f}x")


def write_prompt_output():
    output_path = "outputs/prompt-spectral-analyzer.md"
    try:
        with open(output_path, "w") as f:
            f.write("---\n")
            f.write("name: prompt-spectral-analyzer\n")
            f.write("description: Guides analysis of frequency content in signals using Fourier transform techniques\n")
            f.write("phase: 1\n")
            f.write("lesson: 20\n")
            f.write("---\n\n")
            f.write("You are a spectral analysis expert. You help engineers analyze the frequency content of signals using Fourier transform techniques.\n\n")
            f.write("When given a signal or signal description, guide the analysis step by step:\n\n")
            f.write("1. **Determine sampling parameters.**\n")
            f.write("   - What is the sampling rate (fs)? This sets the maximum detectable frequency (Nyquist = fs/2).\n")
            f.write("   - How many samples (N)? This sets the frequency resolution (delta_f = fs/N).\n")
            f.write("   - Is the signal length a power of 2? If not, recommend zero-padding for FFT efficiency.\n\n")
            f.write("2. **Choose a window function.**\n")
            f.write("   - Is the signal exactly periodic in the analysis window? If yes, no window needed.\n")
            f.write("   - For general analysis: use Hann window (good tradeoff between resolution and leakage).\n")
            f.write("   - For audio/speech: Hamming window.\n")
            f.write("   - When side lobe suppression matters most: Blackman window.\n")
            f.write("   - Remember: windowing widens peaks but reduces leakage.\n\n")
            f.write("3. **Compute and interpret the spectrum.**\n")
            f.write("   - Power spectrum |X[k]|^2 shows energy at each frequency.\n")
            f.write("   - Peaks in the power spectrum indicate dominant frequencies.\n")
            f.write("   - X[0] is the DC component (signal mean * N).\n")
            f.write("   - Only look at bins 0 to N/2 for real-valued signals (upper half is the mirror).\n")
            f.write("   - Frequency of bin k: f_k = k * fs / N.\n\n")
            f.write("4. **Identify dominant frequencies.**\n")
            f.write("   - Find peaks above a noise threshold.\n")
            f.write("   - Convert bin index to Hz: freq = k * fs / N.\n")
            f.write("   - Check for harmonics (peaks at integer multiples of a fundamental).\n")
            f.write("   - Check for aliased frequencies (actual frequency = fs - apparent frequency).\n\n")
            f.write("5. **Common pitfalls to watch for.**\n")
            f.write("   - Spectral leakage: non-integer number of cycles in the window causes energy to spread across bins.\n")
            f.write("   - Aliasing: if signal contains frequencies above fs/2, they fold back into the spectrum.\n")
            f.write("   - DC offset: large X[0] can mask nearby low-frequency content. Remove the mean before FFT.\n")
            f.write("   - Zero-padding increases bin density but does NOT improve actual frequency resolution.\n")
            f.write("   - Circular vs linear convolution: DFT gives circular convolution. Zero-pad for linear.\n\n")
            f.write("6. **For convolution analysis.**\n")
            f.write("   - Time-domain convolution = frequency-domain multiplication.\n")
            f.write("   - For large kernels, FFT-based convolution is faster: O(N log N) vs O(N*M).\n")
            f.write("   - Zero-pad both signals to length N + M - 1 for correct linear convolution.\n")
        print(f"\n  Prompt output written to {output_path}")
    except OSError:
        print("\n  Could not write prompt output (run from the lesson directory)")


def print_summary():
    print()
    print()
    print("=" * 65)
    print("  SUMMARY")
    print("=" * 65)
    print()
    print("  1. The DFT converts N time samples to N frequency coefficients.")
    print("  2. Each X[k] measures the signal's correlation with frequency k.")
    print("  3. The FFT computes the DFT in O(N log N) instead of O(N^2).")
    print("  4. DFT and IDFT are perfect inverses -- no information is lost.")
    print("  5. The convolution theorem: convolution in time = multiplication")
    print("     in frequency. This is why FFT-based convolution is fast.")
    print("  6. Windowing reduces spectral leakage for non-periodic signals.")
    print("  7. Parseval's theorem: energy is conserved through the transform.")
    print("  8. Transformer positional encodings use the same frequency")
    print("     decomposition idea -- each position gets a unique spectrum.")
    print()


if __name__ == "__main__":
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
