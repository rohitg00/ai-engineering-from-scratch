# A Transformada Fourier

> Todo sinal é uma soma de ondas senoidais. A transformada Fourier diz quais.

**Tipo:** Construção
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 01-04, 19 (números complexos)
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Implementar DFT do zero e verificar contra FFT Cooley-Tukey O(N log N)
- Interpretar coeficientes de frequência: extrair amplitude, fase e eespecificaçãotro de potência
- Aplicar o teorema da convolução para performar convolução via multiplicação FFT
- Conectar decomposição de frequência Fourier a codificações posicionais de transformers e camadas convolucionais CNN

## O Problema

Uma gravação de áudio é uma sequência de medições de pressão ao longo do tempo. Um preço de ação é uma sequência de valores ao longo dos dias. Uma imagem é uma grade de intensidades de pixel ao longo do espaço. Todos são dados no domínio do tempo.

Mas muitos padrões são invisíveis no domínio do tempo. A transformada Fourier converte dados do domínio do tempo para o domínio da frequência.

Isso importa para ML porque pensamento em domínio de frequência aparece em todo lugar. CNNs performam convolução (multiplicação no domínio de frequência). Codificações posicionais de transformers usam decomposição de frequência. Modelos de áudio operam em eespecificaçãotrogramas.

## O Conceito

### Definição da DFT

Dadas N amostras x[0], ..., x[N-1], a DFT produz N coeficientes de frequência:

```
X[k] = sum_{n=0}^{N-1} x[n] * e^(-2*pi*i*k*n/N)
```

Cada X[k] é um número complexo. |X[k]| diz a amplitude. angle(X[k]) diz a fase.

### O que cada coeficiente significa

- **X[0]:** componente DC (soma de todas amostras)
- **X[k] para 1 <= k <= N/2:** frequências positivas
- **X[N/2]:** frequência de Nyquist
- **X[k] para N/2 < k < N:** frequências negativas (espelho das positivas)

### DFT Inversa

Reconstrói o sinal original dos coeficientes de frequência. Reconstrução perfeita.

### FFT: tornando rápido

DFT é O(N^2). FFT Cooley-Tukey é O(N log N). Divide e conquiste: separe pares/ímpares, recurse, combine com fatores de torção.

### Teorema da Convolução

**Convolução no domínio do tempo = multiplicação pontual no domínio da frequência.**

Convolução direta: O(N*M). FFT: O(N log N). Fundamental para CNNs.

### Janelamento

Reduz vazamento eespecificaçãotral aplicando uma função de janela (Hann, Hamming, Blackman) antes da DFT.

### STFT e Eespecificaçãotrogramas

A STFT calcula FFTs em janelas sobrepostas. Resultado: eespecificaçãotrograma (2D: tempo x frequência). Entrada padrão para modelos de áudio ML.

### Aliasing

Se o sinal contém frequências acima de fs/2, amostragem cria cópias aliasing. Filtros anti-aliasing removem antes de amostrar.

## Construa

### Passo 1: DFT do zero

```python
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

### Passo 2: FFT (Cooley-Tukey)

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

## Termos-Chave

| Termo | Significado |
|-------|-------------|
| DFT | Converte N amostras temporais em N coeficientes de frequência |
| FFT | Algoritmo O(N log N) para computar DFT |
| DFT Inversa | Reconstrói sinal temporal dos coeficientes |
| Bico de frequência | Cada índice k representa frequência k*fs/N Hz |
| Eespecificaçãotro de potência | \|X[k]\|^2, distribuição de energia |
| Vazamento eespecificaçãotral | Conteúdo espúrio devido a tratar sinal não-periódico como periódico |
| Teorema da convolução | Convolução temporal = multiplicação pontual na frequência |
| Aliasing | Frequências acima de Nyquist aparecem como frequências baixas |

## Leitura Adicional

- [3Blue1Brown: But what is the Fourier Transform?](https://www.youtube.com/watch?v=spUNpyF58BY)
- [Lee-Thorp et al.: FNet (2021)](https://arxiv.org/abs/2105.03824)
- [DSP Guide](http://www.dspguide.com/)
