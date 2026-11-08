# A Transformação de Fourier

> Cada sinal é uma soma de ondas sinusais.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 1, Lessons 01-04, 19 (complex numbers)
**Time:** ~90 minutes

## Objetivos de aprendizagem

- Implementar o DFT a partir do zero e verificá-lo em relação ao $O(N \log N)$Cooley-Tukey FFT
- Interpreta os coeficientes de frequência: extrair amplitude, fase e espectro de potência de um sinal
- Aplicar o teorema de convolução para realizar convolução através da multiplicação FFT
- Conectar a decomposição de frequência de Fourier para transformar codificadores posicionais e camadas de convolução CNN

## O problema

Uma gravação de áudio é uma sequência de medições de pressão ao longo do tempo. Um preço de ação é uma sequência de valores ao longo de dias. Uma imagem é uma grade de intensidades de pixels sobre o espaço. Todos estes são dados no domínio do tempo (ou domínio do espaço). Você vê valores mudando em algum índice.

Mas muitos padrões são invisíveis no domínio do tempo. Este sinal de áudio é um tom puro ou um acorde? Este preço das ações tem um ciclo semanal? Esta imagem tem uma textura repetitiva? Estas perguntas são sobre o conteúdo de frequência, e o domínio do tempo o oculta.

A transformação de Fourier converte dados do domínio do tempo para o domínio da frequência. Ele pega um sinal e o decompõe em ondas sinusais de diferentes frequências. Cada onda sinusa tem uma amplitude (quão forte é) e uma fase (onde começa).

Isto é importante para a ML porque o pensamento do domínio de frequência aparece em todos os lugares. As redes neurais convolucionais executam convolução, que é multiplicação no domínio de frequência. Os codificadores posicionais transformadores usam a decomposição de frequência para representar a posição. Os modelos de áudio (reconhecimento de fala, geração de música) operam em espectrogramas - representações de frequência do som. Os modelos de séries temporais procuram padrões periódicos. Entender a transformação de Fourier dá-lhe o vocabulário para trabalhar com todos estes.

## O conceito

### A definição de DFT

Dado$N$amostras $x[0], x[1], \ldots, x[N-1]$, a Transformação de Fourier Discreta produz $N$coeficientes de frequência $X[0], X[1], \ldots, X[N-1]$- Não .

```math
X[k] = \sum_{n=0}^{N-1} x[n] \, e^{-2\pi i k n/N} \qquad \text{for } k = 0, 1, \ldots, N-1
```

Cada um .$X[k]$É um número complexo.$\lvert X[k] \rvert$é proporcional à amplitude de frequência $k$Sem normalização, um sino real de amplitude.$A$Que cai exactamente no bin .$k$dá$\lvert X[k] \rvert = AN/2$, então divide por $N/2$Para ler a amplitude.$\angle X[k]$Diz-lhe a fase de compensação dessa frequência.

A principal ideia:$e^{-2\pi i k n/N}$é um fator rotativo em frequência $k$O DFT calcula a correlação entre o sinal e cada um dos $N$Se o sinal contém energia em frequência$k$Se não, é quase zero.

### O que significa cada coeficiente

**$X[0]$: the DC component.**Esta é a soma de todas as amostras -- proporcional à média. Representa a constante (frequência zero) de compensação do sinal.

```math
X[0] = \sum_{n=0}^{N-1} x[n] \, e^0 = \text{sum of all samples}
```

**$X[k]$ for $1 \le k \le N/2$: positive frequencies.** $X[k]$representa frequência $k$Ciclos por $N$amostras.$k$significa uma frequência mais elevada (oscillação mais rápida).

**$X[N/2]$: the Nyquist frequency.**A maior frequência que pode representar com $N$Por cima disso, temos alias -- frequências altas mascaradas como baixas.

**$X[k]$ for $N/2 < k < N$: negative frequencies.**Para sinais de valor real,$X[N-k] = \overline{X[k]}$As frequências negativas são imagens espelhadas das positivas.$N/2 + 1$- os coeficientes.

### DFT inverso

O DFT inverso reconstitui o sinal original a partir dos seus coeficientes de frequência:

```math
x[n] = \frac{1}{N} \sum_{k=0}^{N-1} X[k] \, e^{2\pi i k n/N} \qquad \text{for } n = 0, 1, \ldots, N-1
```

As únicas diferenças do DFT de futuro: o sinal no exponente é positivo (não negativo), e há um $1/N$fator de normalização.

O DFT inverso é uma reconstrução perfeita. Não há informação perdida. Você pode ir de domínio de tempo para domínio de frequência e de volta sem qualquer erro. O DFT é uma mudança de base - ele reexprime a mesma informação em um sistema de coordenadas diferente.

### A FFT: a acelerar

O DFT tal como definido acima é $O(N^2)$: para cada um $N$Os coeficientes de saída são somados.$N$amostras de entrada.$N$= 1 milhão, isto é $10^{12}$Operações.

A Transformação de Fourier Rápida (FFT) calcula o mesmo resultado em $O(N \log N)$- Para o ...$N$= 1 milhão, que é cerca de 20 milhões de operações em vez de um trilhão.

O algoritmo Cooley-Tukey (o FFT mais comum) funciona dividindo e conquistando:

1. Dividir o sinal em amostras indexadas e paradas.
2. Calcule o DFT de cada metade de forma recorrente.
3. Combine as duas DFTs de meia dimensão usando "fatores de bico" $e^{-2\pi i k/N}$- Não .

```math
\begin{aligned}
X[k] &= E[k] + e^{-2\pi i k/N} \, O[k] && \text{for } k = 0, \ldots, N/2 - 1 \\
X[k + N/2] &= E[k] - e^{-2\pi i k/N} \, O[k] && \text{for } k = 0, \ldots, N/2 - 1 \\[6pt]
\text{where } E &= \text{DFT of even-indexed samples} \\
O &= \text{DFT of odd-indexed samples}
\end{aligned}
```

A simetria significa que cada nível de recursão faz$O(N)$Trabalho, e há$\log_2(N)$Níveis.$O(N \log N)$- Não .

```mermaid
graph TD
    subgraph "8-point FFT (Cooley-Tukey)"
        X["x[0..7]<br/>8 samples"] -->|"split even/odd"| E["Even: x[0,2,4,6]"]
        X -->|"split even/odd"| O["Odd: x[1,3,5,7]"]
        E -->|"4-pt FFT"| EK["E[0..3]"]
        O -->|"4-pt FFT"| OK["O[0..3]"]
        EK -->|"combine with twiddle factors"| XK["X[0..7]"]
        OK -->|"combine with twiddle factors"| XK
    end
    subgraph "Complexity"
        C1["DFT: O(N^2) = 64 multiplications"]
        C2["FFT: O(N log N) = 24 multiplications"]
    end
```

O radix-2 FFT construído aqui é mais rápido quando o comprimento do sinal é um poder de 2. Sempre que um sub-problema tem comprimento ímpar, ele cai de volta à planície `dft`, por isso os sinais são muitas vezes empurrados a zero para a próxima potência de 2 para a velocidade.`numpy.fft`Os algoritmos de radix mistos são mais rápidos em longitudes com pequenos fatores primos.

### Análise espectral

O **power spectrum**É o que é$\lvert X[k] \rvert^2$- a magnitude quadrada de cada coeficiente de frequência.

O **phase spectrum**É o que é$\angle X[k]$Para a maioria das tarefas de análise, você se importa com o espectro de potência e ignora a fase.

```math
\begin{aligned}
\text{Power at frequency } k: \quad P[k] &= |X[k]|^2 = \mathop{\mathrm{Re}}(X[k])^2 + \mathop{\mathrm{Im}}(X[k])^2 \\
\text{Phase at frequency } k: \quad \phi[k] &= \mathop{\mathrm{atan2}}(\mathop{\mathrm{Im}}(X[k]), \mathop{\mathrm{Re}}(X[k]))
\end{aligned}
```

### Resolução de frequência

A resolução de frequência do DFT depende do número de amostras $N$e a taxa de amostragem $f_s$- Não .

```math
\begin{aligned}
\text{Frequency of bin } k: \quad & f_k = k \cdot f_s / N \\
\text{Frequency resolution:} \quad & \Delta f = f_s / N \\
\text{Maximum frequency:} \quad & f_{\max} = f_s / 2 \quad \text{(Nyquist)}
\end{aligned}
```

Para resolver duas frequências próximas, é preciso mais amostras. Para capturar frequências altas, é preciso uma taxa de amostragem mais alta.

### O teorema da convolução

Este é um dos resultados mais importantes no processamento de sinais e diretamente relevante para as emissoras de televisão.

**Convolution in the time domain equals pointwise multiplication in the frequency domain.**

```math
\begin{aligned}
& x * h = \text{IFFT}(\text{FFT}(x) \cdot \text{FFT}(h)) \\[4pt]
& \text{where } * \text{ is convolution and } \cdot \text{ is element-wise multiplication}
\end{aligned}
```

Por que isso importa:

- Convolução direta de dois sinais de comprimento $N$E ...$M$- Toma .$O(NM)$Operações.
- Convolução baseada em FFT $O(N \log N)$Transformar ambos, multiplicar, transformar de volta.
- Para núcleos grandes, a convolução FFT é dramaticamente mais rápida.
- É exatamente o que acontece nas camadas convolucionais com grandes campos receptivos.

Nota: o DFT calcula a convulsão circular (o sinal envolve-se). Para a convulsão linear (sem envolvimento), pad zero para ambos os sinais de comprimento $N + M - 1$antes da computação.

```mermaid
graph LR
    subgraph "Time Domain"
        TA["Signal x[n]"] -->|"convolve (slow: O(NM))"| TC["Output y[n]"]
        TB["Filter h[n]"] -->|"convolve"| TC
    end
    subgraph "Frequency Domain"
        FA["FFT(x)"] -->|"multiply (fast: O(N))"| FC["FFT(x) * FFT(h)"]
        FB["FFT(h)"] -->|"multiply"| FC
        FC -->|"IFFT"| FD["y[n]"]
    end
    TA -.->|"FFT"| FA
    TB -.->|"FFT"| FB
    FD -.->|"same result"| TC
```

### Janela

O DFT assume que o sinal é periódico - trata o $N$A diferença entre a frequência de um sinal e a frequência de um sinal é que o sinal não começa e termina no mesmo valor, o que cria uma discontinuidade na fronteira, que aparece como um conteúdo de alta frequência falso.

A janela reduz a fuga diminuindo o sinal para zero em ambas as extremidades antes de calcular o DFT.

Janela comum:

| Window | Shape | Main lobe width | Side lobe level | Use case |
|--------|-------|----------------|-----------------|----------|
| Rectangular | Flat (no window) | Narrowest | Highest (-13 dB) | When signal is exactly periodic in N samples |
| Hann | Raised cosine | Moderate | Low (-31 dB) | General purpose spectral analysis |
| Hamming | Modified cosine | Moderate | Lower (-42 dB) | Audio processing, speech analysis |
| Blackman | Triple cosine | Wide | Very low (-58 dB) | When side lobe suppression is critical |

```math
\begin{aligned}
\text{Hann window:} \quad & w[n] = 0.5 \left(1 - \cos\frac{2\pi n}{N-1}\right) \\
\text{Hamming window:} \quad & w[n] = 0.54 - 0.46 \cos\frac{2\pi n}{N-1}
\end{aligned}
```

Aplicar a janela multiplicando-a por elemento com o sinal antes do DFT: `X = DFT(x * w)`- Não .

### Propriedades DFT

| Property | Time Domain | Frequency Domain |
|----------|-------------|-----------------|
| Linearity | $ax + by$ | $aX + bY$ |
| Time shift | $x[n - k]$ | $X[f] e^{-2\pi i f k/N}$ |
| Frequency shift | $x[n] e^{2\pi i f_0 n/N}$ | $X[f - f_0]$ |
| Convolution | $x * h$ | $X \cdot H$ (pointwise) |
| Multiplication | $x \cdot h$ (pointwise) | $X * H$ (circular convolution, scaled by $1/N$) |
| Parseval's theorem | $\sum \lvert x[n] \rvert^2$ | $\frac{1}{N} \sum \lvert X[k] \rvert^2$ |
| Conjugate symmetry (real input) | $x[n]$ real | $X[k] = \overline{X[N-k]}$ |

O teorema de Parseval diz que a energia total é a mesma em ambos os domínios.

### Conexão a codificações posicionais

O Transformer original usa codificações posicionais sinusoidais:

```math
\begin{aligned}
PE(pos, 2i) &= \sin\left(pos / 10000^{2i/d_{\text{model}}}\right) \\
PE(pos, 2i+1) &= \cos\left(pos / 10000^{2i/d_{\text{model}}}\right)
\end{aligned}
```

Cada par de dimensões .$(2i, 2i+1)$Oscila em uma frequência diferente. As frequências são espaçadas geométricamente de alta (dimensão 0,1) para baixa (última dimensão). Isso dá a cada posição um padrão único em todas as bandas de frequência - semelhante à forma como os coeficientes de Fourier identificam um sinal de forma única.

As principais propriedades que isto fornece:

- **Uniqueness:**Não há duas posições com a mesma codificação.
- **Bounded values:**O pecado e o cos estão sempre dentro.$[-1, 1]$- Não .
- **Relative position:**A codificação da posição $p+k$pode ser expressa como uma função linear da codificação em posição $p$O modelo pode aprender a atender a posições relativas.

### Conexão com as CNNs

Uma camada de convolução aplica um filtro aprendido (núcleo) à entrada deslizando-o através do sinal ou imagem.

Pelo teorema da convolução, isto é equivalente a:
1. FFT a entrada
2. FFT o núcleo
3. Multiplicar no domínio de frequência
4. Se o resultado for

As implementações padrão da CNN usam convolução direta (mais rápida para pequenos kernels 3x3). Mas para kernels grandes ou convolução global, as abordagens baseadas em FFT são significativamente mais rápidas. Algumas arquiteturas (como FNet) substituem a atenção inteiramente por FFT, alcançando precisão competitiva com $O(N \log N)$Em vez de$O(N^2)$complexidade.

### Espectogramas e a Transforma Fourier de Curto Tempo

Um único FFT dá-lhe o conteúdo de frequência de todo o sinal, mas não lhe diz nada sobre quando essas frequências ocorrem.

A Transformação de Fourier de Tempo Curto (STFT) resolve isso computação de FFTs em janelas sobrepostas do sinal. O resultado é um espectrograma: uma representação 2D com tempo em um eixo e frequência no outro. A intensidade em cada ponto mostra a energia na frequência naquele momento.

```
STFT procedure:
1. Choose a window size (e.g., 1024 samples)
2. Choose a hop size (e.g., 256 samples -- 75% overlap)
3. For each window position:
   a. Extract the windowed segment
   b. Apply a Hann/Hamming window
   c. Compute FFT
   d. Store the magnitude spectrum as one column of the spectrogram
```

Os espectrogramas são a representação padrão de entrada para modelos de áudio ML. Os modelos de reconhecimento de fala (Whisper, DeepSpeech) operam em espectrogramas mel - espectrogramas com frequências mapeadas na escala mel, que melhor se encaixa na percepção de pitch humana.

### Aliasing

Se um sinal contém frequências acima $f_s/2$(a frequência de Nyquist), amostragem a taxa $f_s$O sinal de 90 Hz amostragado a 100 Hz parece idêntico ao sinal de 10 Hz. Não há forma de distinguir-los das amostras sozinhas.

```
Example:
  True signal: 90 Hz sine wave
  Sampling rate: 100 Hz
  Apparent frequency: 100 - 90 = 10 Hz

  The samples from the 90 Hz signal at 100 Hz sampling rate
  are identical to the samples from a 10 Hz signal.
  No amount of math can recover the original 90 Hz.
```

É por isso que os conversores analógicos para digitais incluem filtros anti-aliasing que removem as frequências acima de Nyquist antes da amostragem.

### A colcha zero não aumenta a resolução

Um equívoco comum: empolgar um sinal antes de FFT melhora a resolução de frequência. Não. O empolgar zero interpola entre os recipientes de frequência existentes, dando-lhe um espectro mais liso. Mas não pode revelar detalhes de frequência que não estavam presentes nas amostras originais.

A verdadeira resolução de frequência depende apenas do tempo de observação $T = N / f_s$Para resolver duas frequências separadas por$\Delta f$, você precisa pelo menos$T = 1 / \Delta f$Nenhuma quantidade de empolgação de zero altera este limite fundamental.

```figure
fourier-synthesis
```

## Construí-lo

### Passo 1: DFT a partir do zero

O $O(N^2)$A DFT segue diretamente a partir da definição.

```python
import math

class Complex:
    ...

def dft(x):
    N = len(x)
    result = []
    for k in range(N):
        total = Complex(0, 0)
        for n in range(N):
            angle = -2 * math.pi * k * n / N
            w = Complex(math.cos(angle), math.sin(angle))
            xn = x[n] if isinstance(x[n], Complex) else Complex(x[n])
            total = total + xn * w
        result.append(total)
    return result
```

### Passo 2: DFT inverso

A mesma estrutura, exponente positivo, dividido por $N$- Não .

```python
def idft(X):
    N = len(X)
    result = []
    for n in range(N):
        total = Complex(0, 0)
        for k in range(N):
            angle = 2 * math.pi * k * n / N
            w = Complex(math.cos(angle), math.sin(angle))
            total = total + X[k] * w
        result.append(Complex(total.real / N, total.imag / N))
    return result
```

### Passo 3: FFT (Cooley-Tukey)

O FFT recorrente requer poder de 2 comprimento. Dividido em par e ímpar, recorrente, combinar com fatores de torcida.

```python
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
        twiddle = Complex(math.cos(angle), math.sin(angle))
        t = twiddle * odd[k]
        result[k] = even[k] + t
        result[k + N // 2] = even[k] - t
    return result
```

### Passo 4: Auxiliares de análise espectral

```python
def power_spectrum(X):
    return [xk.real ** 2 + xk.imag ** 2 for xk in X]

def convolve_fft(x, h):
    N = len(x) + len(h) - 1
    padded_N = 1
    while padded_N < N:
        padded_N *= 2

    x_padded = x + [0.0] * (padded_N - len(x))
    h_padded = h + [0.0] * (padded_N - len(h))

    X = fft(x_padded)
    H = fft(h_padded)

    Y = [xk * hk for xk, hk in zip(X, H)]

    y = idft(Y)
    return [y[n].real for n in range(N)]
```

## Usá-lo

Para o trabalho real, use o FFT da numpy, que é apoiado por bibliotecas C altamente otimizadas.

```python
import numpy as np

signal = np.sin(2 * np.pi * 5 * np.arange(256) / 256)
spectrum = np.fft.fft(signal)
freqs = np.fft.fftfreq(256, d=1/256)

power = np.abs(spectrum) ** 2

positive_freqs = freqs[:len(freqs)//2]
positive_power = power[:len(power)//2]
```

Para análise espectral mais avançada e para análise de janelas:

```python
from scipy.signal import windows, stft

window = windows.hann(256)
windowed = signal * window
spectrum = np.fft.fft(windowed)
```

Para convulsão:

```python
from scipy.signal import fftconvolve

result = fftconvolve(signal, kernel, mode='full')
```

Para os espectrogramas:

```python
from scipy.signal import stft

frequencies, times, Zxx = stft(signal, fs=sample_rate, nperseg=256)
spectrogram = np.abs(Zxx) ** 2
```

A matriz do espectrograma tem forma (n_frequências, n_time_frames). Cada coluna é o espectro de potência em uma janela de tempo.

## Envia-o

Corra .`code/fourier.py`para gerar `outputs/prompt-spectral-analyzer.md`A versão do TypeScript,`code/fourier.ts`, escreve o mesmo ficheiro.

## Exercícios

1. **Pure tone identification.**Crie um sinal com uma única onda sinusal em uma freqüência desconhecida (entre 1 e 50 Hz), amostragem a 128 Hz por 1 segundo. Use o seu DFT para identificar a frequência. Verifique as correspondências da resposta. Agora adicione ruído gaussiano com desvio padrão 0,5 e repita. Como o ruído afeta o espectro?

2. **FFT vs DFT verification.**Gerenar um sinal aleatório de comprimento 64.$O(N^2){}$Verifique se todos os coeficientes correspondem a dentro de 1e-10. Tempo funciona em ambos os sinais de comprimento 256, 512, 1024, e 2048.

3. **Convolution theorem proof by example.**Crie o sinal x = [1, 2, 3, 4, 0, 0, 0, 0] e filtre h = [1, 1, 1, 0, 0, 0, 0, 0]. Calcule sua convolução circular diretamente (loop aninhado). Em seguida, compute-o através de FFT (transformação, multiplicação, transformação inversa). Verifique a correspondência dos resultados. Agora, faça a convolução linear com pad zero apropriadamente.

4. **Windowing effects.**Crie um sinal que seja a soma de duas ondas sinusais a 10 Hz e 12 Hz (muito perto). Mostre a 128 Hz por 1 segundo. Calcule o espectro de potência sem janela, janela Hann e janela Hamming. Qual janela torna mais fácil distinguir os dois picos? Por quê?

5. **Positional encoding analysis.**Gerar as codificações posicionais sinusoidais para d_modelo = 128 e max_pos = 512. Para cada par de posições $(p_1, p_2)$, calcular o produto de pontos de suas codificações. Mostrar que o produto de pontos depende apenas de$\lvert p_1 - p_2 \rvert$O que acontece com o produto de pontos à medida que a distância aumenta?

### Indicios

**Exercise 1.**Com 128 amostras em 1 segundo, bin $k$É o que é$k$Hz, então para uma frequência inteira o índice do maior valor em canhões 1 a 63 é a frequência.`generate_signal`E ...`magnitude_spectrum`Depois de adicionar ruído, verifique se o pico está no mesmo lixo enquanto os outros sacos subem.

**Exercise 2.**Use uma potência de dois comprimentos, porque `fft`Divide o sinal em duas partes.`max(abs(a - b))`A taxa de tempo deve aumentar aproximadamente a$N / \log_2 N$- Não .

**Exercise 3.**Para a convolução circular, calcular $y[n] = \sum_k h[k] x[(n-k) \bmod 8]$- por mão$n$= 0, 1 e 2, e comparar os três primeiros valores de `convolve_direct`E ...`convolve_fft`A convulsão linear tem comprimento 4 + 3 - 1 = 6, por isso verifique primeiro se o comprimento 8 já é longo o suficiente.

**Exercise 4.**Utilização`hann_window`- Não .`hamming_window`- Não .`apply_window`, e `power_spectrum`, e contar os picos separados entre 9 e 13 Hz. Tanto 10 Hz quanto 12 Hz completam ciclos inteiros em 1 segundo, de modo que nenhuma janela pode parecer melhor. Repita com 10,5 Hz e 12,5 Hz para ver o vazamento que as janelas reduzem.

**Exercise 5.**Calcule cada codificação com `positional_encoding(pos, 128)`. Compare o produto ponto para posições (0, 10) com o produto ponto para (100, 110): os dois valores devem corresponder a cerca de 1e-10.$\lvert p_1 - p_2 \rvert$Para um fixo$p_1$- Não .

## Termos-chave

| Term | What it means |
|------|---------------|
| DFT (Discrete Fourier Transform) | Converts $N$ time-domain samples into $N$ frequency-domain coefficients. Each coefficient is the correlation with a complex sinusoid at that frequency |
| FFT (Fast Fourier Transform) | An $O(N \log N)$ algorithm to compute the DFT. The Cooley-Tukey algorithm splits even/odd indices recursively |
| Inverse DFT | Reconstructs the time-domain signal from frequency coefficients. Same formula as DFT with flipped exponent sign and $1/N$ scaling |
| Frequency bin | Each index $k$ in the DFT output represents frequency $k f_s/N$ Hz. The "bin" is the discrete frequency slot |
| DC component | $X[0]$, the zero-frequency coefficient. Proportional to the signal mean |
| Nyquist frequency | $f_s/2$, the maximum frequency representable at sampling rate $f_s$. Frequencies above this alias |
| Power spectrum | $\lvert X[k] \rvert^2$, the squared magnitude of each frequency coefficient. Shows energy distribution across frequencies |
| Phase spectrum | $\angle X[k]$, the phase offset of each frequency component. Often ignored in analysis |
| Spectral leakage | Spurious frequency content caused by treating a non-periodic signal as periodic. Reduced by windowing |
| Window function | A tapering function (Hann, Hamming, Blackman) applied before DFT to reduce spectral leakage |
| Twiddle factor | The complex exponential $e^{-2\pi i k/N}$ used to combine sub-DFTs in the FFT butterfly computation |
| Convolution theorem | Convolution in time domain equals pointwise multiplication in frequency domain. Fundamental to signal processing and CNNs |
| Circular convolution | Convolution where the signal wraps around. This is what the DFT naturally computes |
| Linear convolution | Standard convolution without wraparound. Achieved by zero-padding before DFT |
| Parseval's theorem | Total energy is preserved through the Fourier transform. $\sum \lvert x[n] \rvert^2 = \frac{1}{N} \sum \lvert X[k] \rvert^2$ |
| Aliasing | When frequencies above Nyquist appear as lower frequencies due to insufficient sampling rate |

## Mais leitura

- [Cooley & Tukey: An Algorithm for the Machine Calculation of Complex Fourier Series (1965)](https://www.ams.org/journals/mcom/1965-19-090/S0025-5718-1965-0178586-1/)- o papel original da FFT que mudou a computação
- [3Blue1Brown: But what is the Fourier Transform?](https://www.youtube.com/watch?v=spUNpyF58BY)- a melhor introdução visual às transformações de Fourier
- [Lee-Thorp et al.: FNet: Mixing Tokens with Fourier Transforms (2021)](https://arxiv.org/abs/2105.03824)- substitui a auto-atenção pela FFT nos transformadores
- [Smith: The Scientist and Engineer's Guide to Digital Signal Processing](http://www.dspguide.com/)- livro de texto online gratuito que abrange em profundidade a FFT, a análise das janelas e os espectros
- [Vaswani et al.: Attention Is All You Need (2017)](https://arxiv.org/abs/1706.03762)- codificadores posicionais sinusoidais derivados da decomposição de frequência de Fourier
- [Radford et al.: Whisper (2022)](https://arxiv.org/abs/2212.04356)- reconhecimento de voz utilizando espectrogramas mel como representação de entrada
