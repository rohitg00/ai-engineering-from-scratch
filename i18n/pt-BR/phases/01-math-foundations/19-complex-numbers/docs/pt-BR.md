# Números complexos para IA

> A raiz quadrada de -1 não é imaginária, é a chave para rotações, frequências e metade do processamento de sinais.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04 (linear algebra, calculus)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Realizar aritmética complexa (aditar, multiplicar, dividir, conjugar) em forma retangular e polar
- Aplicar a fórmula de Euler para converter entre exponenciais complexos e funções trigonometricas
- Implementar a Transforma Fourier Discreta usando raízes complexas de unidade
- Explicar como as rotações complexas são a base das codificações posicionais RoPE e sinusoidais em transformadores

## O problema

Abres um artigo sobre as transformações de Fourier e há`i`Olham para os codificadores de posição do transformador e veem`sin`E ...`cos`As partes reais e imaginárias de exponenciais complexos.

Os números complexos parecem abstratos. Um sistema de números construído na raiz quadrada de -1 parece um truque matemático. Mas não é um truque. É a linguagem natural das rotações e oscilações. Sempre que algo gira, vibra ou oscila, os números complexos são a ferramenta certa.

Sem entender números complexos, você não pode entender a Transformação de Fourier Discreta. Você não pode entender a FFT. Você não pode entender como RoPE (Rotary Position Embedding) funciona em modelos de linguagem modernos. Você não pode entender por que codificações posicionais sinusoidais no papel original Transformer usam as frequências que fazem.

Esta lição construi aritmética complexa a partir do zero, liga-a à geometria e mostra-lhe exatamente onde os números complexos aparecem na aprendizagem de máquina.

## O conceito

### O que é um número complexo?

Um número complexo tem duas partes: uma parte real e uma parte imaginária.

```
z = a + bi

where:
  a is the real part
  b is the imaginary part
  i is the imaginary unit, defined by i^2 = -1
```

É isso. Você estende a linha de números em um plano. Os números reais sentam-se em um eixo. Os números imaginários sentam-se no outro. Cada número complexo é um ponto neste plano.

### Aritmética complexa

**Addition.**Adicione as partes reais juntas, adicione as partes imaginárias juntas.

```math
\begin{aligned}
(a + bi) + (c + di) &= (a + c) + (b + d)i \\[4pt]
\text{Example: } (3 + 2i) + (1 + 4i) &= 4 + 6i
\end{aligned}
```

**Multiplication.**Use a lei da distribuição e lembre-se disso.$i^2 = -1$- Não .

```math
\begin{aligned}
(a + bi)(c + di) &= ac + adi + bci + bdi^2 \\
&= ac + adi + bci - bd \\
&= (ac - bd) + (ad + bc)i \\[8pt]
\text{Example: } (3 + 2i)(1 + 4i) &= 3 + 12i + 2i + 8i^2 \\
&= 3 + 14i - 8 \\
&= -5 + 14i
\end{aligned}
```

**Conjugate.**Vire o sinal da parte imaginária.

```math
\text{conjugate of } (a + bi) = a - bi
```

O produto de um número complexo e seu conjugado é sempre real:

```math
(a + bi)(a - bi) = a^2 + b^2
```

**Division.**Multiplicar o numerador e o denominador pelo conjugado do denominador.

```math
\frac{a + bi}{c + di} = \frac{(a + bi)(c - di)}{c^2 + d^2}
```

Isso elimina a parte imaginária do denominador, dando-lhe um número complexo limpo.

### O plano complexo

O plano complexo mapeia cada número complexo para um ponto 2D. O eixo horizontal é o eixo real, o eixo vertical é o eixo imaginário.

```
z = 3 + 2i  corresponds to the point (3, 2)
z = -1 + 0i corresponds to the point (-1, 0) on the real axis
z = 0 + 4i  corresponds to the point (0, 4) on the imaginary axis
```

Um número complexo é simultaneamente um ponto e um vetor da origem. Esta interpretação dupla é o que torna os números complexos úteis para a geometria.

### Forma polar

Qualquer ponto no plano pode ser descrito pela sua distância da origem e o seu ângulo do eixo real positivo.

```math
\begin{aligned}
z &= r (\cos\theta + i \sin\theta) \\[4pt]
\text{where: } r &= |z| = \sqrt{a^2 + b^2} \quad \text{(magnitude, or modulus)} \\
\theta &= \mathop{\mathrm{atan2}}(b, a) \quad \text{(phase, or argument)}
\end{aligned}
```

Forma retangular $(a + bi)$É bom para adição.$(r, \theta)$É bom para multiplicação.

**Multiplication in polar form.**Multiplicar as magnitudes, adicionar os ângulos.

```math
\begin{aligned}
z_1 &= r_1 e^{i\theta_1} \\
z_2 &= r_2 e^{i\theta_2} \\[4pt]
z_1 z_2 &= (r_1 r_2) \, e^{i(\theta_1 + \theta_2)}
\end{aligned}
```

É por isso que os números complexos são perfeitos para rotações. Multiplicar por um número complexo com magnitude 1 é uma rotação pura.

### A fórmula de Euler

A ponte entre exponenciais complexos e trigonometria:

```math
e^{i\theta} = \cos\theta + i \sin\theta
```

Esta é a fórmula mais importante desta lição.$\theta = \pi$- Não .

```math
\begin{aligned}
e^{i\pi} &= \cos\pi + i \sin\pi = -1 + 0i = -1 \\[4pt]
\text{Therefore: } e^{i\pi} + 1 &= 0
\end{aligned}
```

Cinco constantes fundamentais ($e$- Não .$i$- Não .$\pi$, 1, 0) ligados em uma equação.

### Por que a fórmula de Euler é importante para ML

A fórmula de Euler diz que$e^{i\theta}$traça o círculo unitário como $\theta$- A taxa de variação é de$\theta = 0$- Não , não .$(1, 0)$- Em .$\theta = \pi/2$- Não , não .$(0, 1)$- Em .$\theta = \pi$- Não , não .$(-1, 0)$- Em .$\theta = 3\pi/2$- Não , não .$(0, -1)$Uma rotação completa é$\theta = 2\pi$- Não .

Isto significa que os exponenciais complexos são rotações.

### Conexão a rotações 2D

Multiplicar o número complexo $(x + yi)$Por$e^{i\theta}$rota o ponto $(x, y)$por ângulo $\theta$em torno da origem.

```math
\begin{aligned}
&\text{Rotation via complex multiplication:} \\
&\quad (x + yi)(\cos\theta + i \sin\theta) = (x \cos\theta - y \sin\theta) + (x \sin\theta + y \cos\theta)i \\[8pt]
&\text{Rotation via matrix multiplication:} \\
&\quad \begin{bmatrix} \cos\theta & -\sin\theta \\ \sin\theta & \cos\theta \end{bmatrix} \begin{bmatrix} x \\ y \end{bmatrix} = \begin{bmatrix} x \cos\theta - y \sin\theta \\ x \sin\theta + y \cos\theta \end{bmatrix}
\end{aligned}
```

Eles produzem resultados idênticos. Multiplicação complexa é rotação 2D. A matriz de rotação é apenas multiplicação complexa escrita em notação de matriz.

```mermaid
graph TD
    subgraph "Complex Multiplication = 2D Rotation"
        A["z = x + yi<br/>Point (x, y)"] -->|"multiply by e^(i*theta)"| B["z' = z * e^(i*theta)<br/>Point rotated by theta"]
    end
    subgraph "Equivalent Matrix Form"
        C["vector [x, y]"] -->|"multiply by rotation matrix"| D["[x cos theta - y sin theta,<br/> x sin theta + y cos theta]"]
    end
    B -.->|"same result"| D
```

### Fámeros e sinais rotativos

Um exponencial complexo .$e^{i\omega t}$é um ponto que gira em torno do círculo unitário em frequência angular $\omega$Como ...$t$aumenta, o ponto segue o círculo.

A parte real deste ponto de rotação é$\cos(\omega t)$A parte imaginária é:$\sin(\omega t)$Um sinal sinusoidal é a sombra de um número complexo rotativo.

```math
\begin{aligned}
e^{i\omega t} &= \cos(\omega t) + i \sin(\omega t) \\[4pt]
\text{Real part: } & \cos(\omega t) \quad \text{-- a cosine wave} \\
\text{Imaginary part: } & \sin(\omega t) \quad \text{-- a sine wave}
\end{aligned}
```

Esta é a representação do fator. Em vez de rastrear uma onda sinusal movida, você rastreia uma seta que gira suavemente. As mudanças de fase se tornam offsets de ângulo. As mudanças de amplitude se tornam mudanças de magnitude. A adição de sinais se torna adição de vetores.

### Raízes da unidade

O $N$- as raízes da unidade são $N$pontos equitativamente espaçados no círculo unitário:

```math
w_k = e^{2\pi i k/N} \quad \text{for } k = 0, 1, 2, \ldots, N-1
```

Para o$N = 4$, as raízes são: $1, i, -1, -i$(os quatro pontos da bússola).
Para o$N = 8$, você tem os quatro pontos da bússola mais os quatro diagonais.

As raízes da unidade são a base da Transforma de Fourier Discreta.$N$frequências de espaço igual.

### Conexão ao DFT

A Transformação de Fourier discreta de um sinal .$x[0], x[1], \ldots, x[N-1]$é:

```math
X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N}
```

Cada um .$X[k]$Medem a correlação do sinal com o $k$- a raiz da unidade - um sinusoide complexo na frequência$k$O DFT rompe um sinal em$N$Fazeres giratórios e diz-lhe a amplitude e fase de cada um.

### Porque não sou imaginário

A palavra "imaginário" é um acidente histórico.$i$Os números negativos respondem: "o que subtraímos de 5 para obter 3?" A unidade imaginária responde: "o que quadramos para obter -1?"

Mais útil: $i$é um operador de rotação de 90 graus. Multiplica um número real por $i$Uma vez, você gira 90 graus para o eixo imaginário.$i$($i^2$), você gira mais 90 graus - agora você está apontando na direção real negativa.$i^2 = -1$Não é misterioso, é uma meia-volta construída a partir de duas meia-volta.

É por isso que os números complexos estão em toda a engenharia. Qualquer coisa que gira - ondas eletromagnéticas, estados quânticos, oscilações de sinal, codificações posicionais - é naturalmente descrita por números complexos.

### Exponenciais complexos vs funções trigonometricas

Antes da fórmula de Euler, os engenheiros escreveram sinais como$A \cos(\omega t + \phi)$-- amplitude $A$, frequência $\omega$, fase $\phi$Isso funciona, mas torna a aritmética dolorosa. adicionar dois cosinos com fases diferentes requer identidades trigonômétricas.

Com exponenciais complexos, o mesmo sinal é $A e^{i(\omega t + \phi)}$Adicionar dois sinais é apenas adicionar dois números complexos. Multiplicar (modular) é apenas multiplicar magnitudes e adicionar ângulos. As mudanças de fase se tornam adições de ângulos. As mudanças de frequência se tornam multiplicações por fases.

O campo inteiro de processamento de sinais mudou para notação exponencial complexa porque a matemática é mais limpa. O "sinal real" é sempre apenas a parte real da representação complexa. A parte imaginária é levada junto como contabilidade, fazendo com que toda a álgebra funcione naturalmente.

### Conexão a transformadores

**Sinusoidal positional encodings**(papel original de transformador):

```math
\begin{aligned}
PE(pos, 2i) &= \sin\left(pos / 10000^{2i/d}\right) \\
PE(pos, 2i+1) &= \cos\left(pos / 10000^{2i/d}\right)
\end{aligned}
```

Os pares de pecados e cos são as partes reais e imaginárias de exponenciais complexos em diferentes frequências. Cada frequência fornece uma "resolução" diferente para a posição de codificação. As frequências baixas mudam lentamente (posição grosseira). As frequências altas mudam rapidamente (posição fina). Juntas dão a cada posição uma impressão digital de frequência única.

**RoPE (Rotary Position Embedding)**A atenção é calculada usando esses vetores rotativos, tornando o modelo sensível à posição relativa através da multiplicação complexa.

| Operation | Algebraic Form | Geometric Meaning |
|-----------|---------------|-------------------|
| Addition | $(a+c) + (b+d)i$ | Vector addition in the plane |
| Multiplication | $(ac-bd) + (ad+bc)i$ | Rotate and scale |
| Conjugate | $a - bi$ | Reflect over real axis |
| Magnitude | $\sqrt{a^2 + b^2}$ | Distance from origin |
| Phase | $\mathop{\mathrm{atan2}}(b, a)$ | Angle from positive real axis |
| Division | multiply by conjugate | Reverse rotation and rescale |
| Power | $r^n e^{in\theta}$ | Rotate $n$ times, scale by $r^n$ |

```mermaid
graph LR
    subgraph "Unit Circle"
        direction TB
        U1["e^(i*0) = 1"] -.-> U2["e^(i*pi/2) = i"]
        U2 -.-> U3["e^(i*pi) = -1"]
        U3 -.-> U4["e^(i*3pi/2) = -i"]
        U4 -.-> U1
    end
    subgraph "Applications"
        A1["Euler's formula:<br/>e^(i*theta) = cos + i*sin"]
        A2["DFT uses roots of unity:<br/>e^(2*pi*i*k/N)"]
        A3["RoPE uses rotation:<br/>q * e^(i*m*theta)"]
    end
    U1 --> A1
    U1 --> A2
    U1 --> A3
```

```figure
roots-of-unity
```

## Construí-lo

### Passo 1: Classe complexa

Construir uma classe de números complexos que suporta a aritmética, magnitude, fase e conversão entre formas retangulares e polares.

```python
import math

class Complex:
    def __init__(self, real, imag=0.0):
        self.real = real
        self.imag = imag

    def __add__(self, other):
        return Complex(self.real + other.real, self.imag + other.imag)

    def __mul__(self, other):
        r = self.real * other.real - self.imag * other.imag
        i = self.real * other.imag + self.imag * other.real
        return Complex(r, i)

    def __truediv__(self, other):
        denom = other.real ** 2 + other.imag ** 2
        r = (self.real * other.real + self.imag * other.imag) / denom
        i = (self.imag * other.real - self.real * other.imag) / denom
        return Complex(r, i)

    def magnitude(self):
        return math.sqrt(self.real ** 2 + self.imag ** 2)

    def phase(self):
        return math.atan2(self.imag, self.real)

    def conjugate(self):
        return Complex(self.real, -self.imag)
```

### Passo 2: Conversão polar e fórmula de Euler

```python
def to_polar(z):
    return z.magnitude(), z.phase()

def from_polar(r, theta):
    return Complex(r * math.cos(theta), r * math.sin(theta))

def euler(theta):
    return Complex(math.cos(theta), math.sin(theta))
```

Verificar: `euler(theta).magnitude()`Deve ser sempre 1.0. `euler(0)`deve dar (1, 0). `euler(pi)`deve dar (-1, 0).

### Passo 3: rotação

A rotação de um ponto$(x, y)$por ângulo $\theta$é uma multiplicação complexa:

```python
point = Complex(3, 4)
rotated = point * euler(math.pi / 4)
```

A magnitude permanece a mesma, só o ângulo muda.

### Passo 4: DFT da aritmética complexa

```python
def dft(signal):
    N = len(signal)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            total = total + Complex(signal[n], 0) * euler(angle)
        result.append(total)
    return result
```

É o que eu faço .$O(N^2)$DFT. Cada saída $X[k]$é a soma das amostras de sinal multiplicada por raízes de unidade.

### Passo 5: DFT inverso

O DFT inverso reconstrui o sinal original a partir de seu espectro. As únicas mudanças a partir do DFT para a frente: inverte o sinal no exponente e divide por $N$- Não .

```python
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
```

Aplique DFT, depois IDFT, e você retorna o sinal original à precisão da máquina.

### Passo 6: Raízes da unidade

```python
def roots_of_unity(N):
    return [euler(2 * math.pi * k / N) for k in range(N)]
```

Verificar duas propriedades:
- Cada raiz tem magnitude exatamente 1.
- A soma de tudo .$N$raízes são zero (eles são anulados por simetria).

Estas propriedades são o que torna o DFT invertível. As raízes da unidade formam uma base ortogonais para o domínio de frequência.

## Usá-lo

Python tem suporte integrado a números complexos.`j`representa a unidade imaginária.

```python
z = 3 + 2j
w = 1 + 4j

print(z + w)
print(z * w)
print(abs(z))

import cmath
print(cmath.phase(z))
print(cmath.exp(1j * cmath.pi))
```

Para matrizes, numpy lida com números complexos nativamente:

```python
import numpy as np

z = np.array([1+2j, 3+4j, 5+6j])
print(np.abs(z))
print(np.angle(z))
print(np.conj(z))
print(np.real(z))
print(np.imag(z))

signal = np.sin(2 * np.pi * 5 * np.linspace(0, 1, 128))
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(128, d=1/128)
```

## Envia-o

Corra .`code/complex_numbers.py`ou `npx tsx code/complex_numbers.ts`para gerar `outputs/skill-complex-arithmetic.md`- Não .

## Exercícios

1. **Complex arithmetic by hand.**Computação$(2 + 3i)(4 - i)$e verifique com o código.$(5 + 2i) / (1 - 3i)$Desenhe ambos os resultados no plano complexo e verifique se a multiplicação girou e escalaram o primeiro número.

2. **Rotation sequence.**Comece com o ponto .$(1, 0)$Multiplicar por $e^{i\pi/6}$Verifique se voltou para o seu local.$(1, 0)$Imprimir as coordenadas em cada passo e confirmar que eles rastream um 12-gon regular.

3. **DFT of a known signal.**Criar um sinal que seja a soma de $\sin(2\pi \cdot 3t)$E ...$0.5 \sin(2\pi \cdot 7t)$Verifique se o espectro de magnitude tem picos nas frequências 3 e 7, com o pico em 7 sendo metade da altura do pico em 3.

4. **Roots of unity visualization.**Calcule as 8a raízes da unidade, verifique se somam a zero, verifique se multiplicando qualquer raiz pela raiz primitiva$e^{2\pi i/8}$dá a próxima raiz.

5. **Rotation matrix equivalence.**Para 10 ângulos aleatórios e 10 pontos aleatórios, verifique se a multiplicação complexa dá o mesmo resultado que a multiplicação de matriz-vector com a matriz de rotação 2x2.

### Indicios

**Exercise 1.**Expandir o produto com $i^2 = -1$, então divide multiplicando o topo e o fundo pelo conjugado $1 + 3i$Verifique o produto com`Complex(2, 3) * Complex(4, -1)`O seu`magnitude()`Deve ser igual ao produto das duas magnitudes, e o seu`phase()`deve ser igual à soma das duas fases.

**Exercise 2.**Faça o passo com `euler(math.pi / 6)`Em cada etapa, verifique se a magnitude permanece 1 e que o ângulo cresce em 30 graus.

**Exercise 3.**Faça os pontos de tempo com $t = n/32$e ligar .`dft`Olhe apenas para os canhões 0 a 15, porque a metade superior é uma imagem espelhada.$k$para um seno de amplitude $A$É o que é$AN/2$, então espere cerca de 16 no bin 3 e cerca de 8 no bin 7.

**Exercise 4.**Liga-me .`roots_of_unity(8)`E adicionar as raízes: a magnitude da soma deve ser próxima de 0. Divida cada raiz pela raiz anterior e verifique se cada resultado é igual `euler(2 * math.pi / 8)`- Não .

**Exercise 5.**A matriz de rotação é [[cos t, -sin t], [sin t, cos t]]. Para cada ângulo e ponto, calcular `euler(t) * Complex(x, y)`e o produto da matriz, então registar a maior diferença absoluta.$10^{-15}$- Não .

## Termos-chave

| Term | What it means |
|------|---------------|
| Complex number | A number $a + bi$ where $a$ is the real part, $b$ is the imaginary part, and $i^2 = -1$ |
| Imaginary unit | The number $i$, defined by $i^2 = -1$. Not imaginary in the philosophical sense -- it is a rotation operator |
| Complex plane | The 2D plane where the x-axis is real and the y-axis is imaginary. Also called the Argand plane |
| Magnitude (modulus) | The distance from the origin: $\sqrt{a^2 + b^2}$. Written as $\lvert z \rvert$ |
| Phase (argument) | The angle from the positive real axis: $\mathop{\mathrm{atan2}}(b, a)$. Written as $\arg(z)$ |
| Conjugate | The mirror image across the real axis: conjugate of $a + bi$ is $a - bi$ |
| Polar form | Expressing $z$ as $r e^{i\theta}$ instead of $a + bi$. Makes multiplication easy |
| Euler's formula | $e^{i\theta} = \cos\theta + i \sin\theta$. Connects exponentials to trigonometry |
| Phasor | A rotating complex number $e^{i\omega t}$ representing a sinusoidal signal |
| Roots of unity | The $N$ complex numbers $e^{2\pi i k/N}$ for $k = 0$ to $N-1$. $N$ equally spaced points on the unit circle |
| DFT | Discrete Fourier Transform. Decomposes a signal into complex sinusoidal components using roots of unity |
| RoPE | Rotary Position Embedding. Uses complex multiplication to encode relative position in transformer attention |

## Mais leitura

- [Visual Introduction to Euler's Formula](https://betterexplained.com/articles/intuitive-understanding-of-eulers-formula/)- construi intuição geométrica sem notação pesada
- [Su et al.: RoFormer (2021)](https://arxiv.org/abs/2104.09864)- o papel que introduz a rotativa de posições de inserção com rotações complexas
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)- o papel transformador original com codificações posicionais sinusoidais
- [3Blue1Brown: Euler's formula with introductory group theory](https://www.youtube.com/watch?v=mvmuCPvRoWQ)- explicação visual do porquê $e^{i\pi} = -1$
- [Needham: Visual Complex Analysis](https://global.oup.com/academic/product/visual-complex-analysis-9780198534464)- o melhor tratamento visual de números complexos, cheio de conhecimentos geométricos
- [Strang: Introduction to Linear Algebra, Ch. 10](https://math.mit.edu/~gs/linearalgebra/)- números complexos no contexto da álgebra linear e dos valores próprios
