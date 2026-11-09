# Método de gestão

> Um transformador 70B denso ativa todos os parâmetros para cada token. Um 671B MoE ativa apenas 37B por token e o supera em todos os benchmarks.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## O problema

A FLOP de um transformador denso na inferência é igual ao seu número de parâmetros ( vezes 2 para passar para frente). Escala um modelo denso e cada token paga a conta completa. Em 2024 a fronteira estava atingindo uma parede de computação: para ser significativamente mais inteligente, você precisava exponencialmente mais FLOPs por token.

A mistura de especialistas rompe este vínculo.$E$Especialistas independentes + um roteador que escolha $k$- os parâmetros totais = $E \times \text{FFN size}$Parâmetros ativos por token = $k \times \text{FFN size}$. Configuração típica de 2026: $E=256$- Não .$k=8$- Escalas de armazenamento com $E$, calcular escalas com $k$- Não .

A fronteira de 2026 é quase inteiramente MoE: DeepSeek-V3 (671B total / 37B ativo), Mixtral 8×22B, Qwen2.5-MoE, Llama 4, Kimi K2, gpt-oss.

## O conceito

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### O swap FFN

Bloco de transformador denso:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

Bloco de MoE:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

Cada especialista é um FFN independente (tipicamente SwiGLU). O roteador é uma única camada linear.`k`Expertos e obtém uma mistura fechada de suas saídas.

### O problema do equilíbrio de carga

Se o roteador colocar 90% dos tokens através do especialista 3, os outros especialistas morrem de fome.

1. **Auxiliary load-balancing loss**Adicione uma penalidade proporcional à variação no uso especialista. Funciona, mas adiciona um hiperparâmetro e um segundo sinal de gradiente.
2. **Expert capacity + token dropping**Cada perito é o máximo processado.$C \times N/E$Tokens, tokens de sobreflow saltam a camada.
3. **Auxiliary-loss-free balancing**(DeepSeek-V3). Adicione um viés aprendido por perito especialista que muda a seleção top-k do roteador. Viés é atualizado fora da perda de treinamento.

A abordagem do DeepSeek-V3: após cada etapa de formação, para cada especialista, verifique se a sua utilização está acima ou abaixo do objetivo.`±γ`. Utilizações de selecção `scores + bias`As probabilidades de expertos usadas para gating são as principais .`scores`Desacoplamento do encaminhamento da expressão.

### Especialistas partilhados

O DeepSeek-V2/V3 também divide os especialistas em *shared* e *routed*. Cada token passa por todos os especialistas compartilhados. Os especialistas de roteamento são escolhidos através de top-k. Os especialistas compartilhados capturam conhecimento comum; os especialistas de roteamento se especializam. O V3 executa 1 especialista compartilhado mais o top-8 de 256 roteados.

### Especialistas em grãos finos

MoE clássico (GShard, Switch): cada especialista é tão largo quanto um FFN completo. `E`é pequeno (864), `k`é pequena (12).

MoE moderno de grãos finos (DeepSeek-V3, Qwen-MoE): cada especialista é mais estreito (1/8 de tamanho FFN). $E$é grande (256+), $k$Os mesmos parâmetros totais, mas as combinações escalam muito mais rapidamente. $\binom{256}{8} \approx 400$Trilhões de "especialistas" possíveis por token.

### Profil de custos

Por token, por camada:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 supera o Llama 3 70B (denso) em quase todos os índices de referência enquanto faz **fewer active FLOPs per token**Mais parâmetros = mais conhecimento. FLOPs mais ativos = mais computação por token.

### A captura: memória

Todos os especialistas vivem em GPUs independentemente de qual deles disparar. Um modelo 671B precisa de ~1,3 TB de VRAM para pesos fp16.

```figure
expert-routing
```

## Construí-lo

Veja .`code/main.py`Uma camada compacta de MoE em stdlib puro com:

- `n_experts=8`Especialistas em SWIGU (um linear cada, para ilustração)
- Top-k=2 roteamento
- Peso de abertura normalizado de softmax
- Equilíbrio sem perdas auxiliares através de preconceito por perito

`code/main.rs`O Rust é um port Rust com as mesmas funções e demos.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### Passo 1: roteador

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

O preconceito afeta a seleção, não o peso da porta. É o truque DeepSeek-V3  o preconceito corrige o desequilíbrio de carga sem dirigir as previsões do modelo.

### Passo 2: executar 100 tokens através do roteador

A utilização de um sistema de informação de informação de informação de informação é distorcida.`-γ`para especialistas excessivamente utilizados, `+γ`Para o uso de dados de dados, a utilização converge numa distribuição uniforme em algumas iterações.

### Passo 3: Comparação de contagem de parâmetros

Imprima o "equivalente denso" de uma configuração de MoE. DeepSeek-V3-formado: 256 encaminhado + 1 compartilhado, 8 ativo, d_model = 7168.

## Usá-lo

EmbracamentoFace Carregamento:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 Inferência de produção: vLLM suporta roteamento MoE nativo. SGLang tem o caminho paralelo de peritos mais rápido. Ambos processam automaticamente a seleção top-k e o paralelismo de peritos.

**When to pick MoE:**
- Quer qualidade de fronteira a um custo de inferência mais baixo por token.
- Tem a infraestrutura VRAM / especialista paralela.
- A sua carga de trabalho é pesada em tokens (chat, código) e não em contexto (longos documentos).

**When NOT to pick MoE:**
- Deploição de bordo  pagas o armazenamento completo por qualquer FLOP ativo.
- O serviço de roteamento especialista de um único usuário crítico para a latência adiciona custos gerais.
- Modelos pequenos (<7B)  A vantagem de qualidade do MoE só aparece acima de um limiar de cálculo (~ 6B parâmetros ativos).

## Envia-o

Veja .`outputs/skill-moe-configurator.md`A habilidade seleciona o layout de E, k e compartilhado de especialistas para um novo orçamento de parâmetros do MEE, tokens de treinamento e objetivo de implantação.

## Exercícios

1. **Easy.**Corra .`code/main.py`Veja como a atualização de preconceito sem perda auxiliar compensa o uso de especialistas em mais de 50 iterações.
2. **Medium.**Substitua o roteador aprendido por um roteador baseado em hash (determinista, sem aprendizado). Compare qualidade e equilíbrio. Por que o roteador aprendido é melhor?
3. **Hard.**Implementar "routing de parceria de implantação" de estilo GRPO (tructo DeepSeek-V3.2): registro que os especialistas disparam durante a inferência, forçar o mesmo roteamento durante o cálculo de gradientes. Medir o efeito sobre uma configuração de política de gradiente de brinquedo.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## Mais leitura

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538)- A ideia.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961)- Switch, o MoE clássico.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) Mixtral 8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + MoE sem perda auxiliar + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) o papel de balanço baseado em preconceitos.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) o especialista de graus finos + compartilhado dividem os usos do roteador desta aula.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) artigo original de especialistas compartilhados.
