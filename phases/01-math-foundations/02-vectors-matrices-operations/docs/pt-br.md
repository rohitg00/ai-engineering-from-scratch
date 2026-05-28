# Vetores, Matrizes e Operações

> Toda rede neural é só multiplicação de matrizes com etapas extras.

**Tipo:** Construir
**Linguagens:** Python, Julia
**Pré-requisitos:** Fase 1, Aula 01 (Intuição de Álgebra Linear)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Construir uma classe Matrix com operações elemento-a-elemento, multiplicação de matrizes, transposta, determinante e inversa
- Distinguir multiplicação elemento-a-elemento de multiplicação de matrizes e explicar quando cada uma se aplica
- Implementar uma única camada densa de rede neural (`relu(W @ x + b)`) usando apenas a classe Matrix do zero
- Explicar as regras de broadcasting e como a adição de bias funciona em frameworks de rede neural

## O Problemo

Você quer construir uma rede neural. Você lê o código e vê isso:

```
output = activation(weights @ input + bias)
```

Aquele `@` é multiplicação de matrizes. Os `weights` são uma matriz. O `input` é um vetor. Se você não sabe o que essas operações fazem, essa linha é mágica. Se sabe, é o forward pass inteiro de uma camada em três operações.

Cada imagem que o modelo processa é uma matriz de valores de pixel. Cada embedding de palavra é um vetor. Cada camada de toda rede neural é uma transformação de matriz. Você não consegue construir sistemas de IA sem ser fluente em operações com matrizes, assim como não consegue programar sem entender variáveis.

Esta aula constrói essa fluência do zero.

## O Conceito

### Vetores: listas ordenadas de números

Um vetor é uma lista de números com direção e magnitude. Na IA, vetores representam pontos de dados, features ou parâmetros.

```
v = [3, 4]        -- um vetor 2D
w = [1, 0, -2]    -- um vetor 3D
```

Um vetor 2D `[3, 4]` aponta para as coordenadas (3, 4) em um plano. Seu comprimento (magnitude) é 5 (o triângulo 3-4-5).

### Matrizes: grades de números

Uma matriz é uma grade 2D. Linhas e colunas. Uma matriz m x n tem m linhas e n colunas.

```
A = | 1  2  3 |     -- matriz 2x3 (2 linhas, 3 colunas)
    | 4  5  6 |
```

Em redes neurais, matrizes de pesos transformam vetores de entrada em vetores de saída. Uma camada com 784 entradas e 128 saídas usa uma matriz de pesos de 128x784.

### Por que o formato importa

Multiplicação de matrizes tem uma regra rígida: `(m x n) @ (n x p) = (m x p)`. As dimensões internas devem coincidir.

```
(128 x 784) @ (784 x 1) = (128 x 1)
  pesos       entrada       saída

Dimensões internas: 784 = 784  -- válido
```

Se você recebe erro de incompatibilidade de formato no PyTorch, é por isso.

### Mapa das operações

| Operação | O que faz | Uso em rede neural |
|-----------|-------------|-------------------|
| Soma | Combina elemento-a-elemento | Adicionar bias à saída |
| Multiplicação por escalar | Escala cada elemento | taxa de aprendizado * gradientes |
| Multiplicação de matrizes | Transforma vetores | forward pass da camada |
| Transposta | Troca linhas e colunas | retropropagacao |
| Determinante | Resumo em um único número | Verificando invertibilidade |
| Inversa | Desfaz uma transformação | Resolvendo sistemas lineares |
| Identidade | Matriz que não faz nada | Inicialização, conexões residuais |

### Multiplicação elemento-a-elemento vs multiplicação de matrizes

Essa distinção confunde iniciantes o tempo todo.

Elemento-a-elemento: multiplica posições correspondentes. Ambas as matrizes devem ter o mesmo formato.

```
| 1  2 |   | 5  6 |   | 5  12 |
| 3  4 | * | 7  8 | = | 21 32 |
```

Multiplicação de matrizes: produtos escalares de linhas e colunas. As dimensões internas devem coincidir.

```
| 1  2 |   | 5  6 |   | 1*5+2*7  1*6+2*8 |   | 19  22 |
| 3  4 | @ | 7  8 | = | 3*5+4*7  3*6+4*8 | = | 43  50 |
```

Operações diferentes, resultados diferentes, regras diferentes.

### Broadcasting

Quando você adiciona um vetor de bias a uma matriz de saídas, os formatos não coincidem. Broadcasting estica o array menor pra caber.

```
| 1  2  3 |   +   [10, 20, 30]
| 4  5  6 |

Broadcasting estica o vetor pelas linhas:

| 1  2  3 |   | 10  20  30 |   | 11  22  33 |
| 4  5  6 | + | 10  20  30 | = | 14  25  36 |
```

Todo framework moderno faz isso automaticamente. Entender evita confusão quando os formatos parecem errados mas o código roda.

## Construa

### Passo 1: Classe Vector

```python
class Vector:
    def __init__(self, data):
        self.data = list(data)
        self.size = len(self.data)

    def __repr__(self):
        return f"Vector({self.data})"

    def __add__(self, other):
        return Vector([a + b for a, b in zip(self.data, other.data)])

    def __sub__(self, other):
        return Vector([a - b for a, b in zip(self.data, other.data)])

    def __mul__(self, scalar):
        return Vector([x * scalar for x in self.data])

    def dot(self, other):
        return sum(a * b for a, b in zip(self.data, other.data))

    def magnitude(self):
        return sum(x ** 2 for x in self.data) ** 0.5
```

### Passo 2: Classe Matrix com operações centrais

```python
class Matrix:
    def __init__(self, data):
        self.data = [list(row) for row in data]
        self.rows = len(self.data)
        self.cols = len(self.data[0])
        self.shape = (self.rows, self.cols)

    def __repr__(self):
        rows_str = "\n  ".join(str(row) for row in self.data)
        return f"Matrix({self.shape}):\n  {rows_str}"

    def __add__(self, other):
        return Matrix([
            [self.data[i][j] + other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def __sub__(self, other):
        return Matrix([
            [self.data[i][j] - other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def scalar_multiply(self, scalar):
        return Matrix([
            [self.data[i][j] * scalar for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def element_wise_multiply(self, other):
        return Matrix([
            [self.data[i][j] * other.data[i][j] for j in range(self.cols)]
            for i in range(self.rows)
        ])

    def matmul(self, other):
        return Matrix([
            [
                sum(self.data[i][k] * other.data[k][j] for k in range(self.cols))
                for j in range(other.cols)
            ]
            for i in range(self.rows)
        ])

    def transpose(self):
        return Matrix([
            [self.data[j][i] for j in range(self.rows)]
            for i in range(self.cols)
        ])

    def determinant(self):
        if self.shape == (1, 1):
            return self.data[0][0]
        if self.shape == (2, 2):
            return self.data[0][0] * self.data[1][1] - self.data[0][1] * self.data[1][0]
        det = 0
        for j in range(self.cols):
            minor = Matrix([
                [self.data[i][k] for k in range(self.cols) if k != j]
                for i in range(1, self.rows)
            ])
            det += ((-1) ** j) * self.data[0][j] * minor.determinant()
        return det

    def inverse_2x2(self):
        det = self.determinant()
        if det == 0:
            raise ValueError("Matriz é singular, não existe inversa")
        return Matrix([
            [self.data[1][1] / det, -self.data[0][1] / det],
            [-self.data[1][0] / det, self.data[0][0] / det]
        ])

    @staticmethod
    def identity(n):
        return Matrix([
            [1 if i == j else 0 for j in range(n)]
            for i in range(n)
        ])
```

### Passo 3: Veja funcionando

```python
A = Matrix([[1, 2], [3, 4]])
B = Matrix([[5, 6], [7, 8]])

print("A + B =", (A + B).data)
print("A @ B =", A.matmul(B).data)
print("A^T =", A.transpose().data)
print("det(A) =", A.determinant())
print("A^-1 =", A.inverse_2x2().data)

I = Matrix.identity(2)
print("A @ A^-1 =", A.matmul(A.inverse_2x2()).data)
```

### Passo 4: Conecte a redes neurais

```python
import random

inputs = Matrix([[0.5], [0.8], [0.2]])
weights = Matrix([
    [random.uniform(-1, 1) for _ in range(3)]
    for _ in range(2)
])
bias = Matrix([[0.1], [0.1]])

def relu_matrix(m):
    return Matrix([[max(0, val) for val in row] for row in m.data])

pre_activation = weights.matmul(inputs) + bias
output = relu_matrix(pre_activation)

print(f"Formato da entrada: {inputs.shape}")
print(f"Formato dos pesos: {weights.shape}")
print(f"Formato da saída: {output.shape}")
print(f"Saída: {output.data}")
```

Isso é uma camada densa: `output = relu(W @ x + b)`. Toda camada densa em toda rede neural faz exatamente isso.

## Use

NumPy faz tudo acima em menos linhas e ordens de grandeza mais rápido.

```python
import numpy as np

A = np.array([[1, 2], [3, 4]])
B = np.array([[5, 6], [7, 8]])

print("A + B =\n", A + B)
print("A * B (elemento-a-elemento) =\n", A * B)
print("A @ B (multiplicação de matrizes) =\n", A @ B)
print("A^T =\n", A.T)
print("det(A) =", np.linalg.det(A))
print("A^-1 =\n", np.linalg.inv(A))
print("I =\n", np.eye(2))

inputs = np.random.randn(3, 1)
weights = np.random.randn(2, 3)
bias = np.array([[0.1], [0.1]])
output = np.maximum(0, weights @ inputs + bias)

print(f"\nCamada de rede neural: {weights.shape} @ {inputs.shape} = {output.shape}")
print(f"Saída:\n{output}")
```

O operador `@` em Python chama `__matmul__`. NumPy implementa com rotinas BLAS otimizadas escritas em C e Fortran. Mesma matemática, 100x mais rápido.

Broadcasting no NumPy:

```python
matrix = np.array([[1, 2, 3], [4, 5, 6]])
bias = np.array([10, 20, 30])
print(matrix + bias)
```

NumPy automaticamente faz broadcasting do bias 1D nas duas linhas. É assim que funciona a adição de bias em todo framework de rede neural.

## Entregue

Esta aula produz um prompt para ensinar operações de matrizes através de intuição geométrica. Veja `outputs/prompt-matrix-operations.md`.

A classe Matrix construída aqui é a base para o mini framework de rede neural que construímos na Fase 3, Aula 10.

## Exercícios

1. **Verifique a inversa.** Multiplique `A @ A.inverse_2x2()` e confirme que você recebe a matriz identidade. Tente com três matrizes 2x2 diferentes. O que acontece quando o determinante é zero?

2. **Implemente inversa 3x3.** Estenda a classe Matrix para computar inversas para matrizes 3x3 usando o método do adjunto. Teste contra `np.linalg.inv` do NumPy.

3. **Construa uma rede de duas camadas.** Usando apenas sua classe Matrix (sem NumPy), crie uma rede neural de duas camadas: entrada (3) -> oculta (4) -> saída (2). Inicialize pesos aleatórios, rode um forward pass e verifique se todos os formatos estão corretos.

## Termos Chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|----------------------|
| Vetor | "Uma seta" | Uma lista ordenada de números. Na IA: um ponto em espaço de alta dimensão. |
| Matriz | "Uma tabela de números" | Uma transformação linear. Mapeia vetores de um espaço para outro. |
| Multiplicação de matrizes | "Só multiplicar os números" | Produtos escalares entre cada linha da primeira matriz e cada coluna da segunda. Ordem importa. |
| Transposta | "Inverter" | Trocar linhas e colunas. Transforma uma matriz m x n em n x m. Crítica na retropropagacao. |
| Determinante | "Algum número da matriz" | Mede quanto a matriz escala a área (2D) ou volume (3D). Zero significa que a transformação esmaga uma dimensão. |
| Inversa | "Desfazer a matriz" | A matriz que reverte a transformação. Só existe quando o determinante não é zero. |
| Matriz identidade | "A matriz chata" | Equivalente a multiplicar por 1. Usada em conexões residuais (ResNets). |
| Broadcasting | "Mágica de formato" | Estica um array menor para coincidir com um maior repetindo ao longo das dimensões faltantes. |
| Elemento-a-elemento | "Multiplicação normal" | Multiplica posições correspondentes. Ambos os arrays devem ter o mesmo formato (ou serem broadcastable). |

## Leitura Complementar

- [3Blue1Brown: Essência de Álgebra Linear](https://www.3blue1brown.com/topics/linear-algebra) — intuição visual para cada operação coberta aqui
- [Documentação do NumPy sobre broadcasting](https://numpy.org/doc/stable/user/basics.broadcasting.html) — as regras exatas que o NumPy segue
- [Revisão de Álgebra Linear do Stanford CS229](http://cs229.stanford.edu/section/cs229-linalg.pdf) — referência concisa para álgebra linear eespecificaçãoífica de ML
