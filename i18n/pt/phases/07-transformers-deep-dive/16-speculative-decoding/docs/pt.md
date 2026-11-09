# Descodagem especulativa  Esboço, Verificação, Repetição

> A descodificação autoregressiva é serial. Cada token espera para o anterior. A descodificação especulativa quebra a cadeia: um modelo barato elabora N tokens, o modelo caro verifica todos os N em uma passagem para frente. Quando o projeto é correto, você pagou um grande avanço para N gerações.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## O problema

Uma amostragem de 70B LLM um token leva ~30 ms em um H100. Um modelo de projeto 3B leva ~3 ms. Se deixarmos o projeto 3B 5 tokens à frente, então executar o 70B * uma vez * para verificar todos os 5, o total é $5 \times 3 + 30 = 45$ms para até 5 tokens aceites  versus `5×30 = 150 ms`É o passo completo da descodificação especulativa: troca uma pequena quantidade extra de memória GPU (modelo de projeto) por 24× menor latência de decodificação.

O truque tem de preservar a distribuição. A amostragem especulativa, introduzida por Leviathan et al. (2023) e por Chen et al. simultaneamente, garante que a sequência de saída é **identically distributed**Não há troca de qualidade, só mais rápido.

Quatro famílias de pares de verificadores de rascunho dominam a inferência de 2026:

1. **Vanilla speculative (Leviathan 2023).**Modelo de projeto separado (por exemplo, Llama 3 1B) + verificador (por exemplo, Llama 3 70B).
2. **Medusa (Cai 2024).**Múltiples cabeças de decodificação no verificador prevê posições `t+1..t+k`Não há modelo de projeto separado.
3. **EAGLE family (Li 2024, 2025).**Draft leve que reutiliza os estados ocultos do verificador; taxa de aceitação mais próxima do que a baunilha; 34× típico.
4. **Lookahead decoding (Fu 2024).**Iteração Jacobi, não é necessário nenhum modelo de projeto, auto-especulação, nicho, mas livre de dependência.

Cada estaca de inferências de produção em 2026 vai enviar decodificação especulativa por padrão. vLLM, TensorRT-LLM, SGLang e llama.cpp todos suportam pelo menos baunilha + EAGLE-2.

## O conceito

### O algoritmo central

Dado um verificador $M_q$e um esboço mais barato $M_p$- Não .

1. Deixe-me .$x_1 \ldots x_k$ser o prefixo já decodificado.
2. **Draft**: utilização $M_p$Proporcionar autoregressivamente $d_{k+1}, d_{k+2}, \ldots, d_{k+N}$com probabilidades de projeto $p_1 \ldots p_N$- Não .
3. **Verify in parallel**- Não .$M_q$Uma vez por todas .$x_1 \ldots x_k, d_{k+1}, \ldots, d_{k+N}$, obtendo probabilidades de verificação $q_1 \ldots q_{N+1}$para posições $k+1 \ldots k+N+1$- Não .
4. **Accept/reject each draft token left to right**: para cada $i$, aceitar com probabilidade .$\min(1, q_i(d_i) / p_i(d_i))$- Não .
5. Em primeira rejeição na posição $j$: amostra $t_j$da distribuição "residual" $(q_j - p_j)_+$Todos os projetos depois de$j$são descartadas.
6. Sobre aceitar tudo .$N$: amostra um token extra $t_{N+1}$de$q_{N+1}$(o token de bônus gratuito).

O truque de distribuição residual é a visão matemática que mantém a saída distribuída exatamente como se $M_q$Tinha uma amostra de zero.

### O que determina a aceleração

Deixe-me .$\alpha$= taxa de aceitação esperada por token de projeto.$c$= relação custo entre o projecto e o verificador.

- A geração ingênua faz uma chamada de modelo grande por token.
- O especulativo faz uma chamada de modelo grande por dia .$(1 - \alpha^{N+1}) / (1 - \alpha) \approx 1/(1-\alpha)$Tokens quando $\alpha$É alto.

Regra típica de um "$\alpha = 0.75$E ...$N = 5$O custo do projeto é 5x barato. O total do relógio de parede cai cerca de 2,5x.

**$\alpha$ depends on:**

- O que é o projeto que aproxima o verificador?$\alpha$- Não, não.
- Estratégia de decodificação.$\alpha$- Amostragem de temperatura: mais difícil de combinar; queda na aceitação.
- Tipo de tarefa: código e saída estruturada aceitam mais (predicável); escrita criativa em forma livre aceita menos.

### Medusa  projectos sem modelo de projecto

Medusa substitui o modelo de projeto por cabeças de saída extra no verificador.`t`- Não .

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

Cada cabeça sai suas próprias logites. Na inferência você amostra de cada cabeça para obter uma sequência candidata, em seguida, verifique com uma passagem para a frente usando um esquema de atenção de árvore que considera todas as continuações candidatas de uma vez.

Pros: nenhum segundo modelo. Cons: adiciona parâmetros treinables; precisa de uma fase de ajuste fino supervisionado (~ 1B tokens); taxa de aceitação é um pouco menor do que a vanilha especulativa com um bom esboço.

### A ÁGuila  melhor desenho reutilizando estados ocultos

A EAGLE-1/2/3 (Li et al., 20242025) torna o modelo de projeto um pequeno transformador (tipicamente de 1 camada) que ingere os estados ocultos da última camada do verificador. Como o rascunho vê a representação de características do verificador, suas previsões se correlacionam fortemente com a distribuição de saída do verificador. As taxas de aceitação subem de ~ 0,6 (vanilha) para 0,85+. Estas são taxas por token em benchmarks de chat, com um esboço treinado em dados de chat correspondentes. No que diz respeito ao tráfego de produção mista, a fase 17 · 05 prevê um tráfego de 0,6 a 0,8 para a EAGLE-3, e o tráfego de domínio pode ser menor.

A EAGLE-3 (2025) adicionou a busca de árvores sobre as continuações candidatos.

### A dança do cache KV

Feeds de verificação $N$O projeto de tokens para o verificador em uma passagem avançada.$N$Se alguns rascunhos forem rejeitados, você deve rolar o cache de volta ao comprimento de prefixo aceito.

Implementações de produção (vLLM's `--speculative-config`O que é que eu quero dizer é que eu não posso fazer isso, mas eu quero que você faça isso.

```figure
draft-verify-tokens
```

## Construí-lo

Veja .`code/main.py`Implementamos o algoritmo de amostragem especulativa central (passo de rejeição + distribuição residual) com:

- Um "modelo grande" que é um determinístico-softmax sobre uma distribuição codificada à mão (para que possamos verificar a aceitação matemática analíticamente).
- Um "modelo de projeto" que é uma perturbação do modelo grande.
- Um ciclo de aceitação/rejeição que produz a mesma distribuição marginal que a amostragem direta.

`code/main.rs`O Rust é um port Rust com as mesmas funções e demos.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Passo 1: o passo de rejeição

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u`é um número aleatório uniforme. `q_prob`é a probabilidade do verificador para o token elaborado. `p_prob`O teorema de Leviathan é que esta decisão de Bernoulli, seguida de amostragem do resíduo na rejeição, preserva a distribuição do verificador exatamente.

### Passo 2: distribuição residual

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

Subtrair`p`de`q`- A partir de um elemento, apertar os valores negativos para zero, renormalizá-los.

### Passo 3: um passo especulativo

```python
def spec_step(prefix, q_model, p_model, N, rng):
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

Cinco aceitos → um bônus → seis tokens produzidos em um passe de verificação.

### Passo 4: medir a taxa de aceitação

Execute 10.000 passos especulativos em diferentes níveis de qualidade do esboço. Taxa de aceitação do esboço versus divergência KL entre distribuições do esboço e verificador. Você deve ver uma relação monótona limpa.

### Passo 5: verificar a equivalência da distribuição

Empiricamente: o histograma de tokens produzido pelo loop especulativo deve corresponder ao histograma produzido pela amostragem diretamente do verificador. Este é o teorema Leviathan na prática. Um teste de chi-quadrado confirma dentro do erro de amostragem.

## Usá-lo

Produção:

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM tem a rota mais rápida de Medusa a partir de meados de 2026. `faster-whisper`Envolve a descodificação especulativa para Whisper-large com um pequeno rascunho.

**Picking a draft:**

| Strategy | When to pick | Speedup |
|----------|--------------|---------|
| Vanilla draft (1B/3B Llama family) | Fast prototype, no training | 1.8–2.3× |
| Medusa heads | You can fine-tune the verifier | 2–3× |
| EAGLE-2 / 3 | Production, max speed | 3–4× |
| Lookahead | No draft, no training, no extra params | 1.3–1.6× |

**When NOT to spec-decode:**

- Geração de sequência única de 15 tokens.
- Amostragem de alta temperatura ($\alpha$- Garrafas).
- Deploições com restrições de memória (modelo de projeto adiciona VRAM).

## Envia-o

Veja .`outputs/skill-spec-decode-picker.md`A habilidade escolhe uma estratégia de descodificação especulativa (vanilha / Medusa / EAGLE / lookhead) e parâmetros de sintonia (N, temperatura de rascunho) para uma nova carga de trabalho de inferência.

## Exercícios

1. **Easy.**Corra .`code/main.py`Confirmar que a distribuição especulativa de tokens corresponde à distribuição direta de amostras do verificador em 50.000 tokens dentro de p = 0,05 por quadrado de chi.
2. **Medium.**A aceleração da trama (tokens por modelo grande para frente) como função de $N$Para$\alpha = 0.5, 0.7, 0.85$Identificar o óptimo .$N$para cada um $\alpha$. (Ponto: tokens esperados por chamada de verificação = $(1 - \alpha^{N+1}) / (1 - \alpha)$.)
3. **Hard.**Implementar uma pequena Medusa: pegue o GPT da lição 14, adicione 3 cabeças de LM extras que prevejam posições t+2, t+3, t+4. Treine em mini-shakespeare com uma perda conjunta de várias cabeças. Compare as taxas de aceitação versus um esboço de vainilha feito truncando o mesmo modelo.
4. **Hard.**Implementar o rollback: comece com um prefixo KV de 10 tokens, entre 5 tokens de rascunho, simule uma rejeição na posição 3. Verifique se a leitura do cache corresponde corretamente ao "prefixo + os primeiros 2 rascunhos aceitos" na próxima iteração.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Draft model | "The cheap one" | A smaller model that proposes candidate tokens; usually 10–50× cheaper than the verifier. |
| Verifier | "The big one" | The target model whose distribution we preserve; runs once per speculative step. |
| Acceptance rate ($\alpha$) | "How often the draft is right" | Per-token probability that the verifier accepts the draft. 0.7–0.9 typical. |
| Residual distribution | "The rejection fallback" | `(q - p)_+` normalized; sampling from this on rejection preserves the verifier's distribution. |
| Bonus token | "The free one" | When all N drafts accepted, sample one more from the verifier's next-step distribution. |
| Medusa | "Draft-less speculative" | Multiple LM heads on the verifier predict positions t+1..t+k in parallel. |
| EAGLE | "Hidden-state draft" | Tiny transformer draft conditioned on the verifier's last-layer hidden states. |
| Lookahead decoding | "Jacobi iteration" | Self-speculation using a fixed-point iteration; no draft model. |
| Tree attention | "Verify many candidates at once" | Branching verification that considers several draft continuations simultaneously. |
| KV rollback | "Undo rejected drafts" | Scratch KV buffer; commit on acceptance, discard on reject. |

## Mais leitura

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) o algoritmo central e o teorema da equivalência.
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) introdução simultânea; prova limpa de rejeição de Bernoulli.
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) Papel Medusa; verificação da atenção à árvore.
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) EAGLE-1; projecto de estado oculto.
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) AGLE-2; profundidade dinâmica da árvore.
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840)- A Eagle-3.
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057)- Olhe para o lado de fora, não há estratégia.
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) referência canónica de produção com as quatro estratégias ligadas.
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) o código de referência para a EAGLE-1/2/3.
