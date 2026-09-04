import math
import os


class Complex:
    def __init__(self, real, imag=0.0):
        self.real = float(real)
        self.imag = float(imag)

    def __add__(self, other):
        if isinstance(other, (int, float)):
            other = Complex(other)
        return Complex(self.real + other.real, self.imag + other.imag)

    def __radd__(self, other):
        return self.__add__(Complex(other))

    def __sub__(self, other):
        if isinstance(other, (int, float)):
            other = Complex(other)
        return Complex(self.real - other.real, self.imag - other.imag)

    def __rsub__(self, other):
        return Complex(other - self.real, -self.imag)

    def __mul__(self, other):
        if isinstance(other, (int, float)):
            other = Complex(other)
        r = self.real * other.real - self.imag * other.imag
        i = self.real * other.imag + self.imag * other.real
        return Complex(r, i)

    def __rmul__(self, other):
        return self.__mul__(Complex(other))

    def __truediv__(self, other):
        if isinstance(other, (int, float)):
            other = Complex(other)
        denom = other.real ** 2 + other.imag ** 2
        if denom == 0:
            raise ZeroDivisionError("division by zero complex number")
        r = (self.real * other.real + self.imag * other.imag) / denom
        i = (self.imag * other.real - self.real * other.imag) / denom
        return Complex(r, i)

    def __neg__(self):
        return Complex(-self.real, -self.imag)

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

    def __eq__(self, other):
        if isinstance(other, (int, float)):
            other = Complex(other)
        return (abs(self.real - other.real) < 1e-10 and
                abs(self.imag - other.imag) < 1e-10)


def to_polar(z):
    return z.magnitude(), z.phase()


def from_polar(r, theta):
    return Complex(r * math.cos(theta), r * math.sin(theta))


def euler(theta):
    return Complex(math.cos(theta), math.sin(theta))


def dft(signal):
    N = len(signal)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            xn = signal[n] if isinstance(signal[n], Complex) else Complex(signal[n])
            total = total + xn * euler(angle)
        result.append(total)
    return result


def idft(spectrum):
    N = len(spectrum)
    result = []
    for n in range(N):
        total = Complex(0, 0)
        for k in range(N):
            angle = 2 * math.pi * k * n / N
            total = total + spectrum[k] * euler(angle)
        result.append(Complex(total.real / N, total.imag / N))
    return result


def roots_of_unity(N):
    return [euler(2 * math.pi * k / N) for k in range(N)]


def demo_arithmetic():
    print("=" * 65)
    print("  COMPLEX ARITHMETIC")
    print("=" * 65)
    print()

    z1 = Complex(3, 2)
    z2 = Complex(1, 4)

    print(f"  z1 = {z1}")
    print(f"  z2 = {z2}")
    print()

    print(f"  z1 + z2  = {z1 + z2}")
    print(f"  z1 - z2  = {z1 - z2}")
    print(f"  z1 * z2  = {z1 * z2}")
    print(f"  z1 / z2  = {z1 / z2}")
    print()

    print(f"  |z1|     = {z1.magnitude():.6f}")
    print(f"  phase(z1)= {z1.phase():.6f} rad ({math.degrees(z1.phase()):.2f} deg)")
    print(f"  conj(z1) = {z1.conjugate()}")
    print()

    product = z1 * z1.conjugate()
    expected = z1.real ** 2 + z1.imag ** 2
    print(f"  z1 * conj(z1) = {product}")
    print(f"  a^2 + b^2     = {expected:.6f}")
    print(f"  Match: {abs(product.real - expected) < 1e-10}")
    print()

    z3 = Complex(5, 2)
    z4 = Complex(1, -3)
    quotient = z3 / z4
    reconstructed = quotient * z4
    print(f"  Division check: (5+2i) / (1-3i) = {quotient}")
    print(f"  Reconstruct:    result * (1-3i)  = {reconstructed}")
    print(f"  Match original: {abs(reconstructed.real - 5) < 1e-10 and abs(reconstructed.imag - 2) < 1e-10}")


def demo_polar_conversion():
    print()
    print()
    print("=" * 65)
    print("  POLAR FORM AND CONVERSION")
    print("=" * 65)
    print()

    test_cases = [
        Complex(1, 0),
        Complex(0, 1),
        Complex(-1, 0),
        Complex(0, -1),
        Complex(3, 4),
        Complex(-2, 3),
    ]

    print(f"  {'Rectangular':<25s} {'r':>8s}  {'theta (deg)':>12s}  {'Reconstructed':<25s}")
    print(f"  {'-' * 25} {'-' * 8}  {'-' * 12}  {'-' * 25}")

    for z in test_cases:
        r, theta = to_polar(z)
        z_back = from_polar(r, theta)
        print(f"  {str(z):<25s} {r:>8.4f}  {math.degrees(theta):>12.2f}  {str(z_back):<25s}")


def demo_euler_formula():
    print()
    print()
    print("=" * 65)
    print("  EULER'S FORMULA: e^(i*theta) = cos(theta) + i*sin(theta)")
    print("=" * 65)
    print()

    angles = [0, math.pi / 6, math.pi / 4, math.pi / 3, math.pi / 2,
              math.pi, 3 * math.pi / 2, 2 * math.pi]
    labels = ["0", "pi/6", "pi/4", "pi/3", "pi/2", "pi", "3pi/2", "2pi"]

    print(f"  {'theta':<8s} {'cos(theta)':>12s} {'sin(theta)':>12s} "
          f"{'e^(i*theta)':>25s} {'|e^(i*theta)|':>14s}")
    print(f"  {'-' * 8} {'-' * 12} {'-' * 12} {'-' * 25} {'-' * 14}")

    for label, theta in zip(labels, angles):
        e = euler(theta)
        print(f"  {label:<8s} {math.cos(theta):>12.6f} {math.sin(theta):>12.6f} "
              f"  {str(e):>23s} {e.magnitude():>14.10f}")

    print()
    e_pi = euler(math.pi)
    result = e_pi + Complex(1, 0)
    print(f"  Euler's identity: e^(i*pi) + 1 = {result}")
    print(f"  |e^(i*pi) + 1| = {result.magnitude():.2e} (should be ~0)")


def demo_rotation():
    print()
    print()
    print("=" * 65)
    print("  ROTATION VIA COMPLEX MULTIPLICATION")
    print("=" * 65)
    print()

    point = Complex(3, 4)
    print(f"  Original point: {point}")
    print(f"  Magnitude: {point.magnitude():.4f}")
    print(f"  Phase: {math.degrees(point.phase()):.2f} deg")
    print()

    rotation_angles = [45, 90, 180, 270, 360]

    print(f"  {'Rotation':<12s} {'Result':<30s} {'Magnitude':>10s} {'Phase (deg)':>12s}")
    print(f"  {'-' * 12} {'-' * 30} {'-' * 10} {'-' * 12}")

    for deg in rotation_angles:
        rad = math.radians(deg)
        rotated = point * euler(rad)
        r, theta = to_polar(rotated)
        print(f"  {deg:>3d} deg     {str(rotated):<30s} {r:>10.4f} {math.degrees(theta):>12.2f}")

    print()
    print("  Magnitude is preserved through all rotations.")
    print("  360 degrees returns to the original point.")
    print()

    print("  Rotation matrix equivalence check:")
    print()

    test_angles = [math.pi / 6, math.pi / 4, math.pi / 3, math.pi / 2, math.pi]
    test_points = [Complex(1, 0), Complex(3, 4), Complex(-2, 5)]

    max_error = 0.0
    for theta in test_angles:
        cos_t = math.cos(theta)
        sin_t = math.sin(theta)
        for p in test_points:
            complex_result = p * euler(theta)
            matrix_x = cos_t * p.real - sin_t * p.imag
            matrix_y = sin_t * p.real + cos_t * p.imag

            err = math.sqrt((complex_result.real - matrix_x) ** 2 +
                            (complex_result.imag - matrix_y) ** 2)
            max_error = max(max_error, err)

    print(f"  Max difference between complex multiplication")
    print(f"  and rotation matrix: {max_error:.2e}")


def demo_roots_of_unity():
    print()
    print()
    print("=" * 65)
    print("  ROOTS OF UNITY")
    print("=" * 65)
    print()

    for N in [4, 8]:
        roots = roots_of_unity(N)
        print(f"  {N}-th roots of unity:")
        print(f"  {'k':<4s} {'Root':<30s} {'|root|':>8s}")
        print(f"  {'-' * 4} {'-' * 30} {'-' * 8}")

        total = Complex(0, 0)
        for k, root in enumerate(roots):
            total = total + root
            print(f"  {k:<4d} {str(root):<30s} {root.magnitude():>8.6f}")

        print(f"  Sum of all roots: {total}")
        print(f"  |sum| = {total.magnitude():.2e} (should be ~0)")
        print()

    print("  Roots of unity always sum to zero.")
    print("  Each root has magnitude exactly 1.")


def demo_dft():
    print()
    print()
    print("=" * 65)
    print("  DFT OF A SIMPLE SIGNAL")
    print("=" * 65)
    print()

    N = 32
    freq1 = 3
    freq2 = 7
    amp1 = 1.0
    amp2 = 0.5

    signal = []
    for n in range(N):
        t = n / N
        val = amp1 * math.sin(2 * math.pi * freq1 * t) + amp2 * math.sin(2 * math.pi * freq2 * t)
        signal.append(val)

    print(f"  Signal: {amp1}*sin(2*pi*{freq1}*t) + {amp2}*sin(2*pi*{freq2}*t)")
    print(f"  {N} samples")
    print()

    spectrum = dft(signal)

    print(f"  {'Freq bin':<10s} {'|X[k]|':>10s} {'Phase (deg)':>12s}")
    print(f"  {'-' * 10} {'-' * 10} {'-' * 12}")

    for k in range(N // 2 + 1):
        mag = spectrum[k].magnitude()
        if mag > 0.01:
            phase_deg = math.degrees(spectrum[k].phase())
            print(f"  k={k:<6d} {mag:>10.4f} {phase_deg:>12.2f}")

    print()
    print(f"  Expected peaks at k={freq1} (amplitude {amp1 * N / 2:.1f})")
    print(f"  and k={freq2} (amplitude {amp2 * N / 2:.1f})")
    print()

    reconstructed = idft(spectrum)
    max_err = max(abs(reconstructed[n].real - signal[n]) for n in range(N))
    print(f"  IDFT reconstruction error: {max_err:.2e}")
    print(f"  Perfect reconstruction: {max_err < 1e-10}")


def demo_phasor():
    print()
    print()
    print("=" * 65)
    print("  PHASORS: ROTATING COMPLEX NUMBERS AS SIGNALS")
    print("=" * 65)
    print()

    omega = 2 * math.pi * 3
    N = 16

    print(f"  Phasor: e^(i*{3}*2*pi*t), sampled at {N} points")
    print()
    print(f"  {'t':>6s} {'Real (cos)':>12s} {'Imag (sin)':>12s} {'Magnitude':>10s}")
    print(f"  {'-' * 6} {'-' * 12} {'-' * 12} {'-' * 10}")

    for n in range(N):
        t = n / N
        phasor = euler(omega * t)
        print(f"  {t:>6.3f} {phasor.real:>12.6f} {phasor.imag:>12.6f} {phasor.magnitude():>10.6f}")

    print()
    print("  The real part traces cos(6*pi*t).")
    print("  The imaginary part traces sin(6*pi*t).")
    print("  Magnitude is always 1 -- the phasor stays on the unit circle.")


def demo_positional_encoding():
    print()
    print()
    print("=" * 65)
    print("  TRANSFORMER POSITIONAL ENCODING FREQUENCIES")
    print("=" * 65)
    print()

    d_model = 8
    max_pos = 10

    print(f"  d_model = {d_model}, showing first {max_pos} positions")
    print()
    print(f"  Frequencies (1/10000^(2i/d)):")
    freqs = []
    for i in range(d_model // 2):
        freq = 1.0 / (10000 ** (2 * i / d_model))
        freqs.append(freq)
        print(f"    dim pair {i}: freq = {freq:.6f}")

    print()
    print(f"  PE matrix (sin/cos pairs for each position):")
    print()

    header = "  pos"
    for i in range(d_model // 2):
        header += f"  sin_{i:d}     cos_{i:d}  "
    print(header)
    print(f"  {'-' * (5 + d_model // 2 * 20)}")

    for pos in range(max_pos):
        line = f"  {pos:>3d}"
        for i in range(d_model // 2):
            angle = pos * freqs[i]
            line += f"  {math.sin(angle):>7.4f}  {math.cos(angle):>7.4f}"
        print(line)

    print()
    print("  Each (sin, cos) pair is the real and imaginary part")
    print("  of e^(i * pos * freq). Different frequencies give each")
    print("  position a unique 'fingerprint' in the complex plane.")


def write_skill_output():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_path = os.path.join(script_dir, "outputs", "skill-complex-arithmetic.md")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    try:
        with open(output_path, "w") as f:
            f.write("---\n")
            f.write("name: skill-complex-arithmetic\n")
            f.write("description: Quick reference for complex number operations in ML and signal processing contexts\n")
            f.write("phase: 1\n")
            f.write("lesson: 19\n")
            f.write("---\n\n")
            f.write("You are an expert in complex number arithmetic for machine learning and signal processing.\n\n")
            f.write("When someone asks about complex numbers, Fourier transforms, rotations, or positional encodings:\n\n")
            f.write("1. Identify which representation is best: rectangular (a + bi) for addition, polar (r * e^(i*theta)) for multiplication and rotation.\n\n")
            f.write("2. Key conversions:\n")
            f.write("   - Rectangular to polar: r = sqrt(a^2 + b^2), theta = atan2(b, a)\n")
            f.write("   - Polar to rectangular: a = r*cos(theta), b = r*sin(theta)\n")
            f.write("   - Euler's formula: e^(i*theta) = cos(theta) + i*sin(theta)\n\n")
            f.write("3. Common operations and their geometric meaning:\n")
            f.write("   - Addition: vector addition in the complex plane\n")
            f.write("   - Multiplication: rotate by arg(z2) and scale by |z2|\n")
            f.write("   - Conjugate: reflect over the real axis\n")
            f.write("   - Division: reverse rotation and rescale\n\n")
            f.write("4. ML connections:\n")
            f.write("   - DFT uses roots of unity: e^(-2*pi*i*k*n/N)\n")
            f.write("   - Positional encodings: sin/cos pairs are real/imag parts of complex exponentials\n")
            f.write("   - RoPE: explicit complex multiplication for position-dependent rotation of query/key vectors\n")
            f.write("   - FFT: recursive DFT using symmetry of roots of unity, O(N log N)\n\n")
            f.write("5. Quick checks:\n")
            f.write("   - |e^(i*theta)| = 1 always\n")
            f.write("   - z * conj(z) = |z|^2 (always real)\n")
            f.write("   - Sum of N-th roots of unity = 0\n")
            f.write("   - e^(i*pi) + 1 = 0 (Euler's identity)\n")
            f.write("   - Multiplying by e^(i*theta) rotates by theta radians\n\n")
            f.write("6. Python quick reference:\n")
            f.write("   - Built-in: z = 3+2j, abs(z), z.conjugate(), z.real, z.imag\n")
            f.write("   - cmath: cmath.phase(z), cmath.exp(1j*theta), cmath.polar(z)\n")
            f.write("   - numpy: np.abs(z), np.angle(z), np.conj(z), np.fft.fft(signal)\n")
        print(f"\n  Skill output written to {output_path}")
    except OSError:
        print("\n  Could not write skill output (run from the lesson directory)")


def print_summary():
    print()
    print()
    print("=" * 65)
    print("  SUMMARY")
    print("=" * 65)
    print()
    print("  1. A complex number z = a + bi is a point (a, b) in the plane.")
    print("  2. Multiplication rotates and scales. Division reverses it.")
    print("  3. Euler's formula: e^(i*theta) = cos(theta) + i*sin(theta).")
    print("  4. Multiplying by e^(i*theta) rotates by theta radians.")
    print("  5. Complex multiplication IS 2D rotation (same as rotation matrix).")
    print("  6. DFT decomposes signals into rotating phasors (roots of unity).")
    print("  7. Transformer positional encodings are complex exponentials")
    print("     at different frequencies.")
    print("  8. RoPE uses explicit complex multiplication for position.")
    print()


if __name__ == "__main__":
    demo_arithmetic()
    demo_polar_conversion()
    demo_euler_formula()
    demo_rotation()
    demo_roots_of_unity()
    demo_dft()
    demo_phasor()
    demo_positional_encoding()
    write_skill_output()
    print_summary()
