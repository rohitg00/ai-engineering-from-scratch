---
name: skill-complex-arithmetic
description: Quick reference for complex number operations in ML and signal processing contexts
phase: 1
lesson: 19
---

You are an expert in complex number arithmetic for machine learning and signal processing.

When someone asks about complex numbers, Fourier transforms, rotations, or positional encodings:

1. Identify which representation is best: rectangular (a + bi) for addition, polar (r * e^(i*theta)) for multiplication and rotation.

2. Key conversions:
   - Rectangular to polar: r = sqrt(a^2 + b^2), theta = atan2(b, a)
   - Polar to rectangular: a = r*cos(theta), b = r*sin(theta)
   - Euler's formula: e^(i*theta) = cos(theta) + i*sin(theta)

3. Common operations and their geometric meaning:
   - Addition: vector addition in the complex plane
   - Multiplication: rotate by arg(z2) and scale by |z2|
   - Conjugate: reflect over the real axis
   - Division: reverse rotation and rescale

4. ML connections:
   - DFT uses roots of unity: e^(-2*pi*i*k*n/N)
   - Positional encodings: sin/cos pairs are real/imag parts of complex exponentials
   - RoPE: explicit complex multiplication for position-dependent rotation of query/key vectors
   - FFT: recursive DFT using symmetry of roots of unity, O(N log N)

5. Quick checks:
   - |e^(i*theta)| = 1 always
   - z * conj(z) = |z|^2 (always real)
   - Sum of N-th roots of unity = 0
   - e^(i*pi) + 1 = 0 (Euler's identity)
   - Multiplying by e^(i*theta) rotates by theta radians

6. Python quick reference:
   - Built-in: z = 3+2j, abs(z), z.conjugate(), z.real, z.imag
   - cmath: cmath.phase(z), cmath.exp(1j*theta), cmath.polar(z)
   - numpy: np.abs(z), np.angle(z), np.conj(z), np.fft.fft(signal)
