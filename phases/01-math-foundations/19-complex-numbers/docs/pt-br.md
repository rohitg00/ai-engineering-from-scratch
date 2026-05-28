# Números Complexos para IA

> A raiz quadrada de -1 não é imaginária. É a chave para rotações, frequências e metade do processamento de sinais.

**Tipo:** Aprendizado
**Idioma:** Python
**Pré-requisitos:** Fase 1, Lições 01-04 (álgebra linear, cálculo)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Realizar aritmética complexa (adicionar, multiplicar, dividir, conjugar) em formas retangular e polar
- Aplicar fórmula de Euler para converter entre exponenciais complexas e funções trigonométricas
- Implementar a Transformada Fourier Discreta usando raízes complexas da unidade
- Explicar como rotações complexas sustentam RoPE e codificações posicionais sinusoidais em transformers

## O Problema

Você abre um paper sobre transformadas Fourier e tem `i` em todo lugar. Olha codificações posicionais de transformer e vê `sin` e `cos` em diferentes frequências -- as partes real e imaginária de exponenciais complexas.

Números complexos parecem abstratos. Mas não são um truque. São a linguagem natural de rotações e oscilações.

## O Conceito

### O que é um número complexo?

```
z = a + bi
onde:
  a é a parte real
  b é a parte imaginária
  i é a unidade imaginária, definida por i^2 = -1
```

### Aritmética Complexa

**Adição:** Some partes reais, some partes imaginárias.

**Multiplicação:** Use lei distributiva e lembre que i^2 = -1.

**Conjugado:** Inverta o sinal da parte imaginária.

**Divisão:** Multiplique numerador e denominador pelo conjugado do denominador.

### Forma Polar

```
z = r * (cos(theta) + i*sin(theta))
onde:
  r = |z| = sqrt(a^2 + b^2)     (magnitude)
  theta = atan2(b, a)             (fase)
```

Multiplicação em forma polar: multiplique magnitudes, some ângulos.

### Fórmula de Euler

```
e^(i*theta) = cos(theta) + i*sin(theta)
```

A fórmula mais importante desta lição. Quando theta = pi: e^(i*pi) + 1 = 0.

### Conexão com Rotações 2D

Multiplicar (x + yi) por e^(i*theta) rotaciona o ponto (x, y) por ângulo theta.

### Raízes da Unidade

Os N-ésimos pontos igualmente espaçados no círculo unitário. Base da DFT.

### Conexão com Transformers

**Codificações posicionais sinusoidais:** pares sin/cos em diferentes frequências.
**RoPE:** multiplica vetores consulta e key por matrizes de rotação complexas.

## Construa

```python
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

    def magnitude(self):
        return math.sqrt(self.real ** 2 + self.imag ** 2)

    def phase(self):
        return math.atan2(self.imag, self.real)
```

## Termos-Chave

| Termo | Significado |
|-------|-------------|
| Número complexo | a + bi onde i^2 = -1 |
| Plano complexo | Plano 2D com eixo real e imaginário |
| Magnitude | Distância da origem: sqrt(a^2 + b^2) |
| Fase | Ângulo do eixo real positivo |
| Euler | e^(i*theta) = cos(theta) + i*sin(theta) |
| DFT | Transformada Fourier Discreta. Decompor sinal em componentes senoidais |
| RoPE | Embedding Posicional Rotacional. Usa multiplicação complexa |

## Leitura Adicional

- [Visual Introduction to Euler's Formula](https://betterexplained.com/articles/intuitive-understanding-of-eulers-formula/)
- [3Blue1Brown: Euler's formula](https://www.youtube.com/watch?v=mvmuCPvRoWQ)
- [Needham: Visual Complex Analysis](https://global.oup.com/academic/product/visual-complex-analysis-9780198534464)
