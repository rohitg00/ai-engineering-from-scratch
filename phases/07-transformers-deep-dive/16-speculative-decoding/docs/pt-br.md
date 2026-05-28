# Speculative Decoding — Rascunho, Verificação, Repita

> Decodificação autoregressiva é serial. Cada token espera o anterior. Speculative decoding quebra a cadeia: um modelo barato rascunha N tokens, o modelo caro verifica todos os N em uma forward pass. Quando o rascunho tá certo, você pagou uma forward grande por N gerações.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 07 (GPT Causal LM), Fase 7 · 12 (KV Cache & Flash Attention)
**Tempo:** ~60 minutos

## O Problema

Um LLM de 70B amostrando um token leva ~30 ms num H100. Um modelo draft de 3B leva ~3 ms. Se deixarmos o 3B rascunhar 5 tokens à frente, e depois rodar o 70B *uma vez* pra verificar todos os 5, o total é `5×3 + 30 = 45 ms` pra até 5 tokens aceitos — contra `5×30 = 150 ms` pra geração direta. Esse é o pitch completo do especificaçãoulative-decoding: troque uma quantidade extra de memória GPU (modelo draft) por latência de decode 2–4× menor.

O truque tem que preservar a distribuição. O especificaçãoulative sampling, introduzido por Leviathan et al. (2023) e por Chen et al. simultaneamente, garante que a sequência de saída é **identicamente distribuída** ao que o modelo grande teria produzido sozinho. Sem tradeoff de qualidade. Só mais rápido.

Quatro famílias de pares draft-verificador dominam a inferência em 2026:

1. **Speculative vanilla (Leviathan 2023).** Modelo draft separado (ex: Llama 3 1B) + verificador (ex: Llama 3 70B).
2. **Medusa (Cai 2024).** Múltiplas heads de decodificação no verificador predizem posições `t+1..t+k` em paralelo. Sem modelo draft separado.
3. **Família EAGLE (Li 2024, 2025).** Draft leve que reutiliza os estados ocultos do verificador; taxa de aceitação mais alta que vanilla; tipicamente 3–4×.
4. **Lookahead decoding (Fu 2024).** Iteração Jacobi; não precisa de modelo draft nenhum. Auto-especificaçãoulation. Nicho mas sem dependências.

Toda pilha de inferência em produção em 2026 já traz especificaçãoulative decoding por padrão. vLLM, TensorRT-LLM, SGLang, e llama.cpp todos suportam pelo menos vanilla + EAGLE-2.

## O Conceito

### O algoritmo central

Dado um verificador `M_q` e um draft mais barato `M_p`:

1. Sejam `x_1..x_k` o prefixo já decodificado.
2. **Rascunho**: use `M_p` pra propor autoregressivamente `d_{k+1}, d_{k+2}, ..., d_{k+N}` com probabilidades de rascunho `p_1..p_N`.
3. **Verifica em paralelo**: rode `M_q` uma vez em `x_1..x_k, d_{k+1}, ..., d_{k+N}`, obtendo probabilidades do verificador `q_1..q_{N+1}` pra posições `k+1..k+N+1`.
4. **Aceita/rejeita cada token rascunhado da esquerda pra direita**: pra cada `i`, aceita com probabilidade `min(1, q_i(d_i) / p_i(d_i))`.
5. Na primeira rejeição na posição `j`: amostra `t_j` da distribuição "residual" `(q_j - p_j)_+` normalizada. Todos os rascunhos depois de `j` são descartados.
6. Ao aceitar todos os `N`: amostra um token extra `t_{N+1}` de `q_{N+1}` (o bônus grátis).

O truque da distribuição residual é o insight matemático que mantém a saída distribuída exatamente como se `M_q` tivesse amostrado do zero.

### O que determina a aceleração

Seja `α` = taxa de aceitação esperada por token rascunhado. Seja `c` = proporção de custo draft:verificador. Por passo:

- Geração ingênua faz 1 chamada do modelo grande por token.
- Speculative faz 1 chamada do modelo grande por `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` tokens quando `α` é alto.

Regra prática típica com `α = 0.75` e `N = 5`: 3× menos chamadas do modelo grande. Custo do draft é 5× menor. Tempo total cai ~2.5×.

**α depende de:**

- Quão bem o draft aproxima o verificador. Mesma família / mesmos dados de treino aumentam α significativamente.
- Estratégia de decodificação. Draft greedy contra verificador greedy: α alto. Amostragem com temperatura: mais difícil de combinar; aceitação cai.
- Tipo de tarefa. Código e saída estruturada aceitam mais (previsível); escrita criativa livre aceita menos.

### Medusa — rascunhos sem modelo draft

Medusa substitui o modelo draft por heads extras de saída no verificador. Na posição `t`:

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Cada head gera seus próprios logits. Na inferência você amostra de cada head pra obter uma sequência candidata, depois verifica com uma forward pass usando um esquema de tree-attention que considera todas as continuações candidatas de uma vez.

Prós: sem segundo modelo. Contras: adiciona parâmetros treináveis; precisa de uma etapa de fine-tuning supervisionado (~1B tokens); taxa de aceitação é um pouco menor que especificaçãoulative vanilla com um bom draft.

### EAGLE — draft melhor reutilizando estados ocultos

EAGLE-1/2/3 (Li et al., 2024–2025) torna o modelo draft um transformer minúsculo (tipicamente 1 camada) que ingere os estados ocultos da última camada do verificador. Como o draft vê a representação de features do verificador, suas predições se correlacionam fortemente com a distribuição de saída do verificador. Taxas de aceitação sobem de ~0.6 (vanilla) pra 0.85+.

EAGLE-3 (2025) adicionou busca em árvore sobre continuações candidatas. vLLM e SGLang trazem EAGLE-2/3 como o pathway especificação padrão pra Llama 3/4 e Qwen 3.

### A dança do KV cache

Verificação alimenta `N` tokens rascunhados no verificador em uma forward pass. Isso estende o KV cache do verificador em `N` entradas. Se alguns rascunhos são rejeitados, você precisa desfazer o cache pro comprimento de prefixo aceito.

Implementações em produção (o `--especificaçãoulative-model` do vLLM, o LookaheadDecoder do TensorRT-LLM) lidam com isso usando buffers KV temporários. Escreve primeiro, commita na aceitação. Não é conceitualmente difícil, mas é chato.

## Construindo

Veja `code/main.py`. Implementamos o algoritmo central de especificaçãoulative sampling (etapa de rejeição + distribuição residual) com:

- Um "modelo grande" que é um softmax determinístico sobre uma distribuição codificada à mão (pra que possamos verificar a matemática de aceitação analiticamente).
- Um "modelo draft" que é uma perturbação do modelo grande.
- Um loop de aceitação/rejeição que produz a mesma distribuição marginal que amostragem direta.

### Passo 1: a etapa de rejeição

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` é um número aleatório uniforme. `q_prob` é a probabilidade do verificador pro token rascunhado. `p_prob` é a probabilidade do modelo draft. O teorema de Leviathan é que essa decisão Bernoulli, seguida de amostragem da residual na rejeição, preserva exatamente a distribuição do verificador.

### Passo 2: distribuição residual

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Subtraia `p` de `q` elemento a elemento, corte valores negativos pra zero, re-normalize. Amostra disso em qualquer rejeição.

### Passo 3: um passo especificaçãoulative

```python
def especificação_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

Cinco aceitos → um bônus → seis tokens produzidos em uma pass do verificador.

### Passo 4: meça a taxa de aceitação

Rode 10.000 passos especificaçãoulative em diferentes níveis de qualidade de draft. Plote a taxa de aceitação vs. divergência KL entre distribuições draft e verificador. Você deve ver uma relação monótona limpa.

### Passo 5: verifique equivalência de distribuição

Empiricamente: o histograma de tokens produzidos pelo loop especificaçãoulative deve bater com o histograma produzido por amostragem direta do verificador. Esse é o teorema de Leviathan na prática. Um teste chi-quadrado confirma dentro do erro de amostragem.

## Usando

Produção:

```bash
# vLLM com EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --especificaçãoulative-model /models/llama-3.1-eagle-70b \
    --especificaçãoulative-draft-tensor-parallel-size 1 \
    --num-especificaçãoulative-tokens 5

# vLLM com modelo draft vanilla
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --especificaçãoulative-model meta-llama/Llama-3.2-1B-Instruct \
    --num-especificaçãoulative-tokens 5
```

TensorRT-LLM tem o pathway Medusa mais rápido até meados de 2026. `faster-whisper` envolve especificaçãoulative decoding pra Whisper-large com um draft pequeno.

**Escolhendo um draft:**

| Estratégia | Quando escolher | Aceleração |
|----------|--------------|---------|
| Draft vanilla (família Llama 1B/3B) | Prototipagem rápida, sem treino | 1.8–2.3× |
| Heads Medusa | Você pode fine-tunar o verificador | 2–3× |
| EAGLE-2 / 3 | Produção, velocidade máxima | 3–4× |
| Lookahead | Sem draft, sem treino, sem params extras | 1.3–1.6× |

**Quando NÃO usar especificaçãoulative decode:**

- Geração de sequência única de 1–5 tokens. Overhead domina.
- Amostragem altamente criativa / alta temperatura (α cai).
- Deploy com memória restrita (modelo draft adiciona VRAM).

## Entregando

Veja `outputs/skill-especificação-decode-picker.md`. A skill escolhe uma estratégia de especificaçãoulative decoding (vanilla / Medusa / EAGLE / lookahead) e parâmetros de ajuste (N, temperatura do draft) pra um novo workload de inferência.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Confirme que a distribuição de tokens especificaçãoulative bate com a distribuição de amostragem direta do verificador em 50.000 tokens com chi-square p > 0.05.
2. **Médio.** Plote a aceleração (tokens por forward do modelo grande) como função de `N` para `α = 0.5, 0.7, 0.85`. Identifique o `N` ótimo pra cada α. (Dica: tokens esperados por chamada de verificação = `(1 - α^{N+1}) / (1 - α)`.)
3. **Difícil.** Implemente um Medusa minúsculo: pegue o GPT capstone da Aula 14, adicione 3 LM heads extras que predizem posições t+2, t+3, t+4. Treine no tinyshakespeare com uma loss multi-head conjunta. Compare taxas de aceitação vs um draft vanilla feito truncando o mesmo modelo.
4. **Difícil.** Implemente rollback: comece com um KV cache de prefixo de 10 tokens, alimente 5 tokens rascunhados, simule uma rejeição na posição 3. Verifique que seu cache lê corretamente "prefixo + 2 primeiros drafts aceitos" na próxima iteração.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|------|-------------|-----------------------|
| Draft model | "O barato" | Modelo menor que propõe tokens candidatos; tipicamente 10–50× mais barato que o verificador. |
| Verifier | "O grande" | Modelo alvo cuja distribuição preservamos; roda uma vez por passo especificaçãoulative. |
| Taxa de aceitação (α) | "Quão souvent o draft tá certo" | Probabilidade por token do verificador aceitar o draft. 0.7–0.9 típico. |
| Distribuição residual | "O reserva de rejeição" | `(q - p)_+` normalizado; amostrar disso na rejeição preserva a distribuição do verificador. |
| Bonus token | "O grátis" | Quando todos os N rascunhos são aceitos, amostra um extra da distribuição do próximo passo do verificador. |
| Medusa | "Speculative sem draft" | Múltiplas LM heads no verificador predizem posições t+1..t+k em paralelo. |
| EAGLE | "Draft por estado oculto" | Transformer minúsculo draft condicionado nos estados ocultos da última camada do verificador. |
| Lookahead decoding | "Iteração Jacobi" | Auto-especificaçãoulation usando iteração de ponto fixo; sem modelo draft. |
| Tree attention | "Verifica vários candidatos de uma vez" | Verificação ramificada que considera várias continuações de draft simultaneamente. |
| Rollback de KV | "Desfaz drafts rejeitados" | Buffer KV temporário; commita na aceitação, descarte na rejeição. |

## Leitura Complementar

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) — o algoritmo central e o teorema de equivalência.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) — introdução simultânea; prova limpa de rejeição Bernoulli.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) — paper do Medusa; verificação por tree-attention.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) — EAGLE-1; draft condicionado por estado oculto.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) — EAGLE-2; profundidade de árvore dinâmica.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) — EAGLE-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) — lookahead, abordagem sem draft.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/especificação_decode.html) — referência canônica de produção com todas as quatro estratégias implementadas.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) — código de referência pra EAGLE-1/2/3.
