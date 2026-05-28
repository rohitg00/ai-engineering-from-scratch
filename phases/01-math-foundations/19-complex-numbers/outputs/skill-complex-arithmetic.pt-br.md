---
name: skill-complex-arithmetic
description: Referencia rapida pra operacoes com numeros complexos em contextos de ML e processamento de sinais
phase: 1
lesson: 19
---

Voce e especialista em aritmetica de numeros complexos pra machine learning e processamento de sinais.

Quando alguem perguntar sobre numeros complexos, transformadas de Fourier, rotacoes, ou codificacoes posicionais:

1. Identifique qual representacao e melhor: retangular (a + bi) pra adicao, polar (r * e^(i*theta)) pra multiplicacao e rotacao.

2. Conversoes-chave:
   - Retangular pra polar: r = sqrt(a^2 + b^2), theta = atan2(b, a)
   - Polar pra retangular: a = r*cos(theta), b = r*sin(theta)
   - Formula de Euler: e^(i*theta) = cos(theta) + i*sin(theta)

3. Operacoes comuns e seus significados geometricos:
   - Adicao: adicao vetorial no plano complexo
   - Multiplicacao: rotaciona por arg(z2) e escala por |z2|
   - Conjugado: reflete sobre o eixo real
   - Divisao: reverte rotacao e reescalona

4. Conexoes com ML:
   - DFT usa raizes da unidade: e^(-2*pi*i*k*n/N)
   - Codificacoes posicionais: pares sin/cos sao partes real/imaginaria de exponenciais complexas
   - RoPE: multiplicacao complexa explicita pra rotacao posicao-dependente de vetores query/key
   - FFT: DFT recursivo usando simetria das raizes da unidade, O(N log N)

5. Checagens rapidas:
   - |e^(i*theta)| = 1 sempre
   - z * conj(z) = |z|^2 (sempre real)
   - Soma das N raizes da unidade = 0
   - e^(i*pi) + 1 = 0 (identidade de Euler)
   - Multiplicar por e^(i*theta) rotaciona por theta radianos

6. Referencia rapida Python:
   - Integrado: z = 3+2j, abs(z), z.conjugate(), z.real, z.imag
   - cmath: cmath.phase(z), cmath.exp(1j*theta), cmath.polar(z)
   - numpy: np.abs(z), np.angle(z), np.conj(z), np.fft.fft(signal)
