# Mixture of Experts (MoE)

> Um transformer dense de 70B ativa cada parâmetro pra cada token. Um MoE de 671B ativa só 37B por token e vence em todo benchmark. Esparsidade é a ideia de escala mais importante da década.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 05 (Transformer Completo), Fase 7 · 07 (GPT)
**Tempo:** ~45 minutos

## O Problema

FLOPs na inferência de um transformer dense igualam sua contagem de parâmetros (vezes 2 pro forward pass). Escale um modelo dense e cada token paga a conta inteira. Em 2024 a fronteira batia num muro de compute: pra ser significativamente mais inteligente, você precisava de FLOPs exponencialmente mais por token.

Mixture of Experts quebra esse vínculo. Substitua cada FFN por `E` experts independentes + um router que escolhe `k` experts por token. Parâmetros totais = `E × tamanho_FFN`. Parâmetros ativos por token = `k × tamanho_FFN`. Configuração típica de 2026: `E=256`, `k=8`. Armazenamento escala com `E`, compute escala com `k`.

A fronteira de 2026 é quase totalmente MoE: DeepSeek-V3 (671B total / 37B ativos), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss. No ranking independente da Artificial Analysis, os 10 melhores modelos open source são todos MoE.

## O Conceito

![Camada MoE: router seleciona k de E experts por token](../assets/moe.svg)

### A troca de FFN

Bloco transformer dense:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

Bloco MoE:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Cada expert é uma FFN independente (tipicamente SwiGLU). O router é uma única camada linear. Cada token escolhe suas próprias `k` experts e recebe uma mistura ponderada de suas saídas.

### O problema de balanceamento de carga

Se o router joga 90% dos tokens pela expert 3, as outras experts passam fome. Três correções já tentadas:

1. **Perda auxiliar de balanceamento de carga** (Switch Transformer, Mixtral). Adiciona penalidade proporcional à variância no uso das experts. Funciona, mas adiciona um hiperparâmetro e um segundo sinal de gradiente.
2. **Capacidade de expert + descarte de tokens** (Switch inicial). Cada expert processa no máximo `C × N/E` tokens; tokens de overflow pulam a camada. Prejudica qualidade.
3. **Balanceamento sem perda auxiliar** (DeepSeek-V3). Adiciona um viés aprendido por expert que desloca a seleção top-k do router. Viés é atualizado fora da perda de principal. Sem penalidade no objetivo principal. Grande desbloqueio de 2024.

Abordagem do DeepSeek-V3: depois de cada passo de treinamento, pra cada expert, verifique se seu uso está acima ou abaixo do alvo. Ajuste o viés em `±γ`. Seleção usa `scores + bias`. Probabilidades de experts usadas pro gating são os `scores` brutos inalterados. Desacopla roteamento de expressão.

### Experts compartilhadas

DeepSeek-V2/V3 também divide experts em *compartilhadas* e *roteadas*. Todo token passa por todas as experts compartilhadas. Experts roteadas são escolhidas via top-k. Experts compartilhadas capturam conhecimento comum; experts roteadas se eespecificaçãoializam. V3 roda 1 expert compartilhada + top-8 de 256 roteadas.

### Experts de granulação fina

MoE clássico (GShard, Switch): cada expert é tão larga quanto uma FFN completa. `E` é pequeno (8–64), `k` é pequeno (1–2).

MoE moderno de granulação fina (DeepSeek-V3, Qwen-MoE): cada expert é mais estreita (1/8 do tamanho da FFN). `E` é grande (256+), `k` é maior (8+). Mesmo número total de parâmetros, mas combinações escalam muito mais rápido. `C(256, 8) = 400 trilhões` possíveis "experts" por token. Qualidade sobe, latência fica plana.

### O perfil de custo

Por token, por camada:

| Config | Params ativos / token | Params totais |
|--------|-----------------------|---------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 vence Llama 3 70B (dense) em quase todo benchmark fazendo **menos FLOPs ativos por token**. Mais parâmetros = mais conhecimento. Mais FLOPs ativos = mais compute por token. MoE desacopla os dois.

### O custo: memória

Todas as experts ficam na GPU independentemente de quais disparam. Um modelo de 671B precisa ~1,3 TB de VRAM pra pesos em fp16. Implantação MoE de fronteira requer paralelismo de experts — distribua experts em GPUs,rote tokens pela rede. Latência é dominada pela comunicação all-to-all, não a matmul.

## Construindo

Veja `code/main.py`. Uma camada MoE compacta em stdlib puro com:

- `n_experts=8` experts estilo SwiGLU (uma linear cada, pra ilustração)
- top-k=2 pra roteamento
- pesos de gating normalizados por softmax
- balanceamento sem perda auxiliar via viés por expert

### Passo 1: o router

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

Viés afeta seleção, não peso do gate. Esse é o truque DeepSeek-V3 — viés corrige desbalanceamento de carga sem direcionar as previsões do modelo.

### Passo 2: rodar 100 tokens pelo router

Rastreie quais experts disparam com que frequência. Sem viés, uso é enviesado. Com um loop de atualização de viés (`-γ` pra experts usadas demais, `+γ` pra subutilizadas), uso converge pra uma distribuição uniforme em poucas iterações.

### Passo 3: comparação de contagem de parâmetros

Imprima o "equivalente dense" de uma configuração MoE. Estilo DeepSeek-V3: 256 roteadas + 1 compartilhada, 8 ativas, d_model=7168. Contagem total de parâmetros é absurda. Contagem ativa é um sétimo de um dense Llama 3 70B.

## Usando

Carregamento HuggingFace:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

Inferência de produção 2026: vLLM suporta roteamento MoE nativamente. SGLang tem o caminho de paralelismo de experts mais rápido. Ambos lidam automaticamente com seleção top-k e paralelismo de experts.

**Quando escolher MoE:**
- Você quer qualidade de fronteira com menor custo de inferência por token.
- Tem a infraestrutura de VRAM / paralelismo de experts.
- Sua carga é pesada em tokens (chat, código) não em contexto (docs longos).

**Quando NÃO escolher MoE:**
- Implantação em borda — você paga armazenamento total pra qualquer FLOP ativo.
- Serviço de latência crítica de usuário único — roteamento de experts adiciona overhead.
- Modelos pequenos (<7B) — vantagem de qualidade do MoE só aparece acima de um threshold de compute (~6B params ativos).

## Entregando

Veja `outputs/skill-moe-configurator.md`. A skill escolhe E, k e layout de experts compartilhadas pra um novo MoE dado orçamento de parâmetros, tokens de treinamento e alvo de implantação.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Observe como a atualização de viés sem perda auxiliar equaliza uso das experts em 50 iterações.
2. **Médio.** Substitua o router aprendido por um router baseado em hash (determinístico, sem aprendizado). Compare qualidade e balanceamento. Por que o router aprendido é melhor?
3. **Difícil.** Implemente roteamento estilo "rollout-matched" de GRPO (truque DeepSeek-V3.2): registre quais experts disparam durante inferência, force o mesmo roteamento durante cálculo de gradiente. Meça o efeito num setup de policy-gradient brinquedo.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Expert | "Uma FFN entre muitas" | Rede feed-forward independente; parâmetros dedicados a uma fatia esparsa da computação FFN. |
| Router | "O gate" | Camada linear minúscula que pontua cada token contra cada expert; seleção top-k. |
| Roteamento top-k | "k experts ativas por token" | Computação FFN de cada token passa exatamente por k experts, ponderadas pelo gate. |
| Perda auxiliar | "Penalidade de balanceamento" | Termo de perda extra que penaliza uso enviesado de experts. |
| Sem perda auxiliar | "O truque do DeepSeek-V3" | Balanceamento via viés por expert na seleção do router apenas; sem gradiente extra. |
| Expert compartilhada | "Sempre ligada" | Expert extra por onde todo token passa; captura conhecimento comum. |
| Paralelismo de experts | "Shardar por expert" | Distribuir experts diferentes em GPUs diferentes; rotear tokens pela rede. |
| Esparsidade | "Params ativos < params totais" | Razão `k × tamanho_expert / (E × tamanho_expert)`; 37/671 ≈ 5,5% pro DeepSeek-V3. |

## Leituras Complementares

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) — a ideia.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) — Switch, o MoE clássico.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) — Mixtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) — MLA + MoE sem perda auxiliar + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) — paper de balanceamento baseado em viés.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) — granulação fina + divisão expert compartilhada que o router desta aula usa.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) — paper original de expert compartilhada.
