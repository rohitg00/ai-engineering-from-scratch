---
name: skill-jax-patterns
description: Padrões de programação funcional em JAX – quando e como usar grad, jit, vmap e pmap
version: 1.0.0
phase: 3
lesson: 12
tags: [jax, functional-programming, autodiff, compilation, vectorization]
---

# Padrões Funcionais JAX

JAX transforma funções puras. Cada padrão abaixo segue uma regra: escreva uma função que receba entradas e retorne saídas, sem efeitos colaterais. Então transforme-o.

## As Quatro Transformações

### grad – Diferencie uma função

```python
grads = jax.grad(loss_fn)(params, x, y)
loss, grads = jax.value_and_grad(loss_fn)(params, x, y)
```

Use quando: você precisar de gradientes para otimização.
Restrição: a função deve retornar um escalar. Para saídas não escalares, use `jax.jacobian`.

### jit – Compila uma função

```python
fast_fn = jax.jit(f)
```

Use quando: a função será chamada mais de uma vez com entradas do mesmo formato.
Restrição: nenhum fluxo de controle Python que dependa de valores rastreados. Use `jax.lax.cond` para condicionais, `jax.lax.scan` para loops.

### vmap -- Vetoriza uma função

```python
batch_fn = jax.vmap(f, in_axes=(None, 0))
```

Use quando: você escreveu uma função para um exemplo e precisa que ela funcione em lotes.
`in_axes` especifica qual eixo de argumento será agrupado. `None` significa não fazer lote (transmitir).

### pmap -- Paralelizar entre dispositivos

__CODE_BLOCO_3__

Use quando: você tem várias GPUs/TPUs e deseja paralelismo de dados.
Dentro da função, `jax.lax.pmean(x, 'devices')` faz a média entre dispositivos.

## Regras de composição

Transforma a composição. A ordem é importante:

```python
per_example_grads = jax.jit(jax.vmap(jax.grad(loss_fn), in_axes=(None, 0, 0)))
```

Lendo da direita para a esquerda: pegue o gradiente de loss_fn, vetorize os exemplos, compile o resultado.

Composições válidas:
- `jit(grad(f))` -- cálculo de gradiente compilado
- `jit(vmap(f))` -- computação em lote compilada
- `vmap(grad(f))` -- gradientes por exemplo
- `pmap(jit(f))` -- computação compilada paralelamente
- `grad(jit(f))` -- gradiente da função compilada (igual a jit(grad(f)))

## Padrão de gerenciamento de parâmetros

Os parâmetros JAX são pytrees (dictos aninhados de matrizes):

__CODE_BLOCO_5__

Atualize todos os parâmetros de uma vez:
```python
params = jax.tree.map(lambda p, g: p - lr * g, params, grads)
```

Parâmetros de contagem:
```python
n_params = sum(p.size for p in jax.tree.leaves(params))
```

## Gerenciamento de chaves PRNG

JAX requer chaves aleatórias explícitas:

```python
key = jax.random.PRNGKey(0)
key, subkey = jax.random.split(key)
noise = jax.random.normal(subkey, shape)
```

Para múltiplas operações aleatórias, divida uma vez:
__CODE_BLOCO_9__

Nunca reutilize uma chave. Sempre divida antes de usar.

## Erros Comuns

1. **Matrizes mutantes dentro de jit**: matrizes JAX são imutáveis. Use `x.at[i].set(v)` em vez de `x[i] = v`.

2. **Usando Python print dentro de jit**: `print` é executado durante o rastreamento, não na execução. Use `jax.debug.print("{}", x)`.

3. **Python if/for dentro de jit em valores rastreados**: Use `jax.lax.cond`, `jax.lax.switch`, `jax.lax.scan`, `jax.lax.fori_loop`.

4. **Esquecendo `.block_until_ready()`**: JAX usa envio assíncrono. Para benchmarking, chame `.block_until_ready()` para aguardar a conclusão real.

5. **Reutilizando chaves PRNG**: Duas operações com a mesma chave produzem os mesmos valores "aleatórios". Sempre divida.

6. **Estado global em funções jitadas**: As variáveis ​​globais são capturadas no momento do rastreamento. As alterações após o rastreamento são invisíveis. Passe tudo como argumentos.

## Lista de verificação de decisão

1. A função é chamada mais de uma vez? Adicione `@jax.jit`.
2. Precisa de gradientes? Enrole com `jax.grad` ou `jax.value_and_grad`.
3. Ele processa um exemplo, mas você tem um lote? Finalize com `jax.vmap`.
4. Você tem vários dispositivos? Finalize com `jax.pmap`.
5. Utiliza aleatoriedade? Passe as chaves PRNG explicitamente.
6. Possui fluxo de controle Python em valores de array? Substitua por primitivas `jax.lax`.

## Quando usar JAX

Use JAX quando:
- Você precisa de gradientes por exemplo (privacidade diferencial, informações de Fisher)
- Você está treinando em TPUs (JAX é o framework nativo)
- Você precisa de derivadas de ordem superior (Hessianos, Jacobianos)
- Você deseja compilar toda a etapa de treinamento em um único kernel
- Sua equipe está no Google DeepMind ou Anthropic

Use PyTorch quando:
- Você quer o maior ecossistema (HuggingFace, torchvision, Lightning)
- Você prioriza a facilidade de depuração em vez da velocidade bruta
- Você está implantando em GPUs NVIDIA com TorchServe/Triton
- Você está contratando (existem mais desenvolvedores PyTorch)
- Você deseja iterar rapidamente em novas arquiteturas