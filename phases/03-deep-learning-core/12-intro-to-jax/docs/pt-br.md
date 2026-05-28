# Introdução ao JAX

> PyTorch muta tensores. TensorFlow constrói grafos. JAX compila funções puras. Essa última coisa muda como você pensa sobre deep learning.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Aulas 01-10 da Fase 03, NumPy básico
**Tempo:** ~90 minutos

## Objetivos de Aprendizado

- Escrever código de rede neural usando a API funcional do JAX (jax.numpy, jax.grad, jax.jit, jax.vmap)
- Explicar a diferença-chave de design entre mutação ansiosa do PyTorch e o modelo de compilação funcional do JAX
- Aplicar compilação jit e vectorização vmap pra acelerar loops de treino comparados com Python ingênuo
- Treinar uma rede simples em JAX e contrastar o gerenciamento explícito de estado com a abordagem orientada a objetos do PyTorch

## O Problema

Você sabe como construir redes neurais em PyTorch. Define um `nn.Module`, chama `.backward()`, avança o otimizador. Funciona.

Mas PyTorch tem uma restrição no seu DNA: ele rastreia operações ansiosamente, uma por vez, em Python. Cada `tensor + tensor` é um disparo de kernel separado. Isso funciona até você precisar treinar um modelo de 540 bilhões de parâmetros em 2.048 TPUs. Aí a sobrecarga te mata.

Google DeepMind treina Gemini em JAX. Anthropic treinou Claude em JAX. Eles escolheram JAX porque ele trata seu loop de treino como um programa compilável, não uma sequência de chamadas Python.

JAX é NumPy com três superpoderes: diferenciação automática, compilação JIT pra XLA e vectorização automática.

## O Conceito

### A Filosofia JAX

JAX é um framework funcional. Sem classes, sem estado mutável, sem método `.backward()`. Em vez disso:

| PyTorch | JAX |
|---------|-----|
| Classe `nn.Module` com estado | Função pura: `f(params, x) -> y` |
| `loss.backward()` | `jax.grad(loss_fn)(params, x, y)` |
| Execução ansiosa | Compilação JIT via XLA |
| `for x in batch:` loop manual | `jax.vmap(f)` vectorização automática |
| `model.parameters()` mutável | pytree imutável de arrays |

### jax.numpy: A Superfície Familiar

JAX reimplementa a API do NumPy em aceleradores:

```python
import jax.numpy as jnp

a = jnp.array([1.0, 2.0, 3.0])
b = jnp.array([4.0, 5.0, 6.0])
c = jnp.dot(a, b)
```

Uma diferença crítica: arrays JAX são imutáveis. Sem `a[0] = 5`. Em vez disso: `a = a.at[0].set(5)`.

### jax.grad: Autodiff Funcional

PyTorch anexa gradientes a tensores. JAX anexa gradientes a funções.

```python
import jax

def f(x):
    return x ** 2

df = jax.grad(f)
df(3.0)
```

### jit: Compilar pra XLA

```python
@jax.jit
def train_step(params, x, y):
    loss = loss_fn(params, x, y)
    return loss
```

Na primeira chamada, JAX rastreia a função — registra quais operações acontecem, sem executá-las. Depois passa o rastreamento pro XLA, o compilador do Google pra TPUs e GPUs.

Quando JIT ajuda:
- Passos de treino (mesma computação repetida milhares de vezes)
- Inferência (mesmo modelo, entradas diferentes)
- Qualquer função chamada mais de uma vez com entradas de forma similar

### vmap: Vectorização Automática

Você escreve uma função que processa uma amostra. `vmap` eleva pra processar um lote:

```python
batch_predict = jax.vmap(predict, in_axes=(None, 0))
```

Isso não é açúcar sintático. `vmap` gera código vectorizado fundido que roda 10-100x mais rápido que um loop Python. E compõe com `jit` e `grad`:

```python
per_example_grads = jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0))
```

Gradientes por amostra. Uma linha. Isso é quase impossível em PyTorch sem truques.

### pmap: Paralelismo de Dados entre Dispositivos

```python
parallel_step = jax.pmap(train_step, axis_name='devices')
```

### Pytrees: A Estrutura de Dados Universal

JAX opera em "pytrees" — combinações aninhadas de listas, tuplas, dicts e arrays. Seus parâmetros de modelo são um pytree:

```python
params = {
    'layer1': {'w': jnp.zeros((784, 256)), 'b': jnp.zeros(256)},
    'layer2': {'w': jnp.zeros((256, 128)), 'b': jnp.zeros(128)},
    'layer3': {'w': jnp.zeros((128, 10)),  'b': jnp.zeros(10)},
}
```

### Funcional vs Orientado a Objetos

PyTorch armazena estado dentro de objetos. JAX usa funções puras com estado explícito:

```python
# PyTorch
class Model(nn.Module):
    def __init__(self):
        self.linear = nn.Linear(784, 10)
    def forward(self, x):
        return self.linear(x)

# JAX
def predict(params, x):
    return jnp.dot(x, params['w']) + params['b']
```

### Ecossistema JAX

| Biblioteca | Papel | Estilo |
|-----------|-------|--------|
| **Flax** (Google) | Camadas de rede neural | `nn.Module` com estado explícito |
| **Equinox** (Patrick Kidger) | Camadas de rede neural | Baseado em pytree, Pythonico |
| **Optax** (DeepMind) | Otimizadores + agendamentos LR | Transformações de gradiente compostas |
| **Orbax** (Google) | Checkpointing | Salvar/restaurar pytrees |

### Quando Usar JAX vs PyTorch

| Fator | JAX | PyTorch |
|-------|-----|---------|
| Suporte TPU | Primeira classe (Google construiu ambos) | Mantido pela comunidade |
| Suporte GPU | Bom (CUDA via XLA) | Melhor da classe (CUDA nativo) |
| Debug | Difícil (rastreamento + compilação) | Fácil (ansioso, linha por linha) |
| Ecossistema | Focado em pesquisa | Massivo (HuggingFace, etc.) |
| Prototipagem | Mais lento (sobrecarga funcional) | Mais rápido (mutar e seguir) |

A resposta honesta: use PyTorch a menos que tenha uma razão eespecificaçãoífica pra usar JAX. Essas razões são: acesso a TPU, necessidade de gradientes por amostra, treino multi-dispositivo em escala massiva, ou trabalhar no Google/DeepMind/Anthropic.

### Números Aleatórios no JAX

JAX não tem estado aleatório global. Toda operação aleatória requer uma PRNG key explícita:

```python
key = jax.random.PRNGKey(42)
key1, key2 = jax.random.split(key)
w = jax.random.normal(key1, shape=(784, 256))
```

## Construa

### Passo 1: Setup e Dados

```python
import jax
import jax.numpy as jnp
from jax import random
import optax

def get_mnist_data():
    from sklearn.datasets import fetch_openml
    mnist = fetch_openml('mnist_784', version=1, as_frame=False, parser='auto')
    X = mnist.data.astype('float32') / 255.0
    y = mnist.target.astype('int')
    X_train, X_test = X[:60000], X[60000:]
    y_train, y_test = y[:60000], y[60000:]
    return X_train, y_train, X_test, y_test
```

### Passo 2: Inicializar Parâmetros

```python
def init_params(key):
    k1, k2, k3 = random.split(key, 3)
    scale1 = jnp.sqrt(2.0 / 784)
    scale2 = jnp.sqrt(2.0 / 256)
    scale3 = jnp.sqrt(2.0 / 128)
    params = {
        'layer1': {
            'w': scale1 * random.normal(k1, (784, 256)),
            'b': jnp.zeros(256),
        },
        'layer2': {
            'w': scale2 * random.normal(k2, (256, 128)),
            'b': jnp.zeros(128),
        },
        'layer3': {
            'w': scale3 * random.normal(k3, (128, 10)),
            'b': jnp.zeros(10),
        },
    }
    return params
```

### Passo 3: Passo Direto

```python
def forward(params, x):
    x = jnp.dot(x, params['layer1']['w']) + params['layer1']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer2']['w']) + params['layer2']['b']
    x = jax.nn.relu(x)
    x = jnp.dot(x, params['layer3']['w']) + params['layer3']['b']
    return x

def loss_fn(params, x, y):
    logits = forward(params, x)
    one_hot = jax.nn.one_hot(y, 10)
    return -jnp.mean(jnp.sum(jax.nn.log_softmax(logits) * one_hot, axis=-1))
```

### Passo 4: Passo de Treino Compilado com JIT

```python
@jax.jit
def train_step(params, opt_state, x, y):
    loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
    updates, opt_state = optimizer.update(grads, opt_state, params)
    params = optax.apply_updates(params, updates)
    return params, opt_state, loss

@jax.jit
def accuracy(params, x, y):
    logits = forward(params, x)
    preds = jnp.argmax(logits, axis=-1)
    return jnp.mean(preds == y)
```

### Passo 5: Loop de Treino

```python
optimizer = optax.adam(learning_rate=1e-3)

X_train, y_train, X_test, y_test = get_mnist_data()
X_train, X_test = jnp.array(X_train), jnp.array(X_test)
y_train, y_test = jnp.array(y_train), jnp.array(y_test)

key = random.PRNGKey(0)
params = init_params(key)
opt_state = optimizer.init(params)

batch_size = 128
n_epochs = 10

for epoch in range(n_epochs):
    key, subkey = random.split(key)
    perm = random.permutation(subkey, len(X_train))
    X_shuffled = X_train[perm]
    y_shuffled = y_train[perm]

    epoch_loss = 0.0
    n_batches = len(X_train) // batch_size
    for i in range(n_batches):
        start = i * batch_size
        xb = X_shuffled[start:start + batch_size]
        yb = y_shuffled[start:start + batch_size]
        params, opt_state, loss = train_step(params, opt_state, xb, yb)
        epoch_loss += loss

    train_acc = accuracy(params, X_train[:5000], y_train[:5000])
    test_acc = accuracy(params, X_test, y_test)
    print(f"Epoch {epoch + 1:2d} | Loss: {epoch_loss / n_batches:.4f} | "
          f"Train Acc: {train_acc:.4f} | Test Acc: {test_acc:.4f}")
```

10 épocas. ~97% de acurácia de teste.

## Entregue

**Instalação:**
```bash
pip install jax jaxlib optax flax
```

Pra suporte GPU:
```bash
pip install jax[cuda12]
```

Esta aula produz:
- `outputs/prompt-jax-optimizer.md` — um prompt pra escolher a configuração certa de otimizador JAX
- `outputs/skill-jax-patterns.md` — uma habilidade cobrindo padrões funcionais no JAX

## Exercícios

1. Adicione dropout ao MLP. No JAX, dropout requer uma PRNG key — passe uma key pelo passo direto e divida pra cada camada de dropout.
2. Use `jax.vmap` pra computar gradientes por amostra pra um lote de 32 imagens MNIST.
3. Substitua a função manual de forward por uma `mlp_forward(params, x)` genérica que funcione pra qualquer número de camadas.
4. Faça benchmark do passo de treino com e sem `@jax.jit`. Cronometre 100 passos de cada.
5. Implemente clipping de gradiente compondo `optax.chain(optax.clip_by_global_norm(1.0), optax.adam(1e-3))`.

## Termos-Chave

| Termo | O que o pessoal diz | O que realmente significa |
|-------|---------------------|--------------------------|
| XLA | "A coisa que deixa JAX rápido" | Algebra Linear Acelerada — um compilador que funde operações e gera kernels GPU/TPU otimizados |
| JIT | "Compilação just-in-time" | JAX rastreia a função na primeira chamada, compila pra XLA e roda a versão compilada nas chamadas seguintes |
| Função pura | "Sem efeitos colaterais" | Uma função onde a saída depende só das entradas — sem estado global, sem mutação |
| vmap | "Auto-batching" | Transforma uma função que processa uma amostra em uma que processa um lote, sem reescrever |
| pmap | "Auto-paralelismo" | Replica uma função entre múltiplos dispositivos e divide o lote de entrada |
| Pytree | "Dict aninhado de arrays" | Qualquer estrutura aninhada de listas, tuplas, dicts e arrays que JAX pode percorrer e transformar |
| Flax | "nn.Module do JAX" | A biblioteca de rede neural do Google pra JAX |
| Optax | "Biblioteca de otimizadores do JAX" | Uma biblioteca composta de transformações de gradiente |

## Leituras Complementares

- Documentação JAX: https://jax.readthedocs.io/ — os docs oficiais, com tutoriais excelentes sobre grad, jit e vmap
- Comparação JAX vs PyTorch: https://colinraffel.com/blog/a-brief-tour-of-forward-and-reverse-mode-automatic-differentiation.html
- Tutorial Flax: https://flax.readthedocs.io/en/latest/ getting_started.html
- Exemplos JAX no GitHub: https://github.com/google/jax/tree/main/examples
