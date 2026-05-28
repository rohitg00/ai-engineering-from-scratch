# Leis de Escala

> O paper Kaplan de 2020 disse: modelo maior, perda menor. O paper Hoffmann de 2022 disse: você estava sub-treinando. Compute vai em dois baldes — parâmetros e tokens — e a divisão não é óbvia.

**Tipo:** Aprender
**Linguagens:** Python
**Pré-requisitos:** Fase 7 · 05 (Transformer Completo), Fase 7 · 07 (GPT)
**Tempo:** ~45 minutos

## O Problema

Quando você tem C FLOPs de compute de treinamento e quer o melhor modelo, enfrenta dois controles:

1. **Quantos parâmetros (N)?** Modelo maior, mais capacidade.
2. **Quantos tokens de treinamento (D)?** Mais dados, melhor uso da capacidade.

FLOPs escalam aproximadamente como `6 × N × D`. Você pode empurrar N pra cima e D pra baixo, ou D pra cima e N pra baixo. Qual é melhor?

Antes de 2022, a resposta era "empurre N forte." GPT-3 (2020) tinha 175B parâmetros treinados em ~300B tokens. Uma razão de cerca de 1,7 tokens por parâmetro. As leis de escala Kaplan confirmavam isso.

Hoffmann et al. (2022), treinando uma família pequena de modelos chamada Chinchilla, encontrou algo diferente: razão ótima é mais próxima de **20 tokens por parâmetro**. GPT-3 estava 10× sub-treinado. Chinchilla (70B params, 1,4T tokens) venceu GPT-3 (175B, 300B tokens) em todo benchmark com 2,5× menos custo de inferência.

2026 é o mundo de Chinchilla — com uma reviravolta importante. Llama 3 8B foi treinado em 15 trilhões de tokens, uma razão de 1.875 tokens por parâmetro. Noventa e quatro vezes além do ótimo de Chinchilla. Custo de inferência importa mais que custo de treinamento pra modelos que serão usados em escala, então overt-treinar (além de Chinchilla) pra uma pegada menor implantável é o padrão de 2026.

## O Conceito

![Curvas Chinchilla: perda vs compute em várias razões N/D](../assets/scaling-laws.svg)

### A lei de Hoffmann

Do paper Chinchilla, perda segue:

```
L(N, D) = A / N^α + B / D^β + E
```

- `N` = parâmetros (sem embeddings).
- `D` = tokens de treinamento.
- `α ≈ 0,34`, `β ≈ 0,28` (aproximadamente simétricos).
- `E ≈ 1,69`, o teto de perda irredutível.
- `A ≈ 406`, `B ≈ 411`.

Dois termos competem entre si conforme você escala. Derive em relação a `N` em compute fixo (C = 6ND) e resolva:

```
N_opt ≈ 0.6 × (C/6)^0.5
D_opt ≈ 0.6 × (C/6)^0.5
D_opt / N_opt ≈ 20
```

Compute-ótimo: 20 tokens por parâmetro.

### Por que overt-treinar mesmo assim

Chinchilla-ótimo minimiza perda de treinamento por FLOP de treinamento. Mas você paga custo de treinamento uma vez; custo de inferência pra sempre.

Pra um chatbot que serve um trilhão de tokens por mês, inferência domina custo total. Abordagem da Llama: treinar menor, mais tempo. 8B em 15T tokens é profundamente otimizado pra inferência:

- Cabe em GPUs de consumidor.
- Latência é fração de um 70B Chinchilla-ótimo.
- Qualidade é próxima o suficiente pra maioria das tarefas.

Paper do DeepMind de 2024 ("Over-training is the new optimal") formalizou isso. Pra cargas dominadas por inferência, a razão certa é mais próxima de 100–500 tokens por parâmetro dependendo do volume de servir.

### Emergência vs suavidade

Alegação: certas habilidades (aritmética, raciocínio multi-passo, seguir cadeia de raciocínio) "emergem" repentinamente em certa escala.

Schaeffer et al. (2023) argumentou que isso é artefato de medição: métricas emergentes usam pontuação descontínua (match exato, acurácia no limiar) que esconde melhoria suave nos logits subjacentes. Métricas contínuas (entropia cruzada) mostram curvas suaves.

Em 2026 o consenso é: previsões via perda contínua são confiáveis. Saltos em benchmarks são frequentemente artefatos do avaliador. Planeje orçamentos contra métricas contínuas.

### O quadro de 2026

Leis de escala ainda funcionam, mas:

| Fator | Mudou como |
|-------|-----------|
| Qualidade dos dados | Curar tokens "bons" (estilo Phi) desloca curvas em >2× compute efetivo |
| MoE | Params totais se desacoplam de FLOPs ativos; leis de escala por FLOP ativo |
| Pós-treinamento | Algumas habilidades (seguir instruções, código) deslocam com SFT+RLHF mais que pré-treinamento |
| Multimodalidade | Tokens de imagem + texto escalam juntos; curvas separadas por modalidade |
| Dados sintéticos | Modelos geram dados de treinamento; compute efetivo pode compor |

O otimizador Muon (Kimi Moonlight, 2024) mostrou ganho de ~2× em compute efetivo sobre AdamW em dados equivalentes. Alguns treinos de 2026 usam Muon por padrão. Muda a constante absoluta na lei de escala, não sua forma.

## Construindo

Veja `code/main.py`. Implementamos a equação de perda Chinchilla e resolvemos pra `(N, D)` compute-ótimo em vários orçamentos de compute.

### Passo 1: perda Chinchilla

```python
def chinchilla_loss(N, D, A=406.4, B=410.7, alpha=0.34, beta=0.28, E=1.69):
    return A / N ** alpha + B / D ** beta + E
```

Plote `L` como contorno sobre `(N, D)` em `C = 6ND` fixo. Encontre o mínimo.

### Passo 2: fronteira compute-ótima

Pra orçamentos de compute de `1e17` a `1e25` FLOPs, encontre `(N, D)` que minimizam perda sujeitas a `6ND = C`. Verifique a razão `D/N ≈ 20`.

### Passo 3: custo de overt-treinar

Calcule a perda extra que você paga pra treinar um modelo 10× menor (1/10 do N ótimo, 10× o D ótimo). Reporta economia de FLOPs de inferência (proporcional a N) em troca.

### Passo 4: comparar com modelos reais

Insira pares `(N, D)` conhecidos pra GPT-3, Chinchilla, Llama 3 8B, DeepSeek-V3 (params ativos) e compare perda prevista vs reportada.

## Usando

Você provavelmente não vai treinar um modelo de fronteira sozinho. Mas leis de escala dizem:

1. **Se seu fine-tune tem dados suficientes.** Se seus dados eespecificaçãoíficos da tarefa estão abaixo de 20 tokens por param do modelo base, espere saturação em algum piso de perda.
2. **Se deve escolher um modelo base maior.** Se você gasta todo orçamento em inferência, prefira um modelo menor e mais treinado.
3. **Onde os retornos diminuem.** Além de 1000× do ótimo Chinchilla, mudanças em log-perda viram ruído.

**A trajetória de pesquisa em 2026:**

- **Regime com dados limitados.** A web tem um número finito de tokens de alta qualidade (~5–10 trilhões de inglês após filtragem). Pré-treinamento de fronteira está se aproximando desse teto. Dados sintéticos, multilíngue, multimodal e fine-tuning com RLHF em escala são as próximas alavancas.
- **Truques multiplicadores de compute.** Otimizador Muon, MoE, melhor curadoria de dados — cada um muda as constantes absolutas, não a assimptota.
- **Leis de escala pra RL.** Questão aberta. Evidências iniciais sugerem lei de potência em amostras de RL mas com expoentes muito diferentes que pré-treinamento.

## Entregando

Veja `outputs/skill-training-budget-estimator.md`. A skill escolhe `(N, D, horas, GPU)` pra um novo treinamento dado orçamento de compute, restrições de implantação e perda alvo.

## Exercícios

1. **Fácil.** Rode `code/main.py`. Imprima `(N, D)` ótimo de Chinchilla pra orçamentos de compute `1e20`, `1e22`, `1e24`. Compare com a tabela de modelos reais.
2. **Médio.** Implemente a curva de Hoffmann perda-função-de-compute. Plote perda vs `log10(C)` pra fronteira compute-ótima. Identifique quando a lei prevê que precisaríamos de `>10^28` FLOPs pra redução de 0,1 na entropia cruzada.
3. **Difícil.** Ajuste sua própria lei de escala em 5 tiny modelos (100K a 10M params) treinados no mesmo dataset. Estime `α` e `E`. Quão bem seus expoentes combinam com os publicados?

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|--------------------------|
| Parâmetros (N) | "Tamanho do modelo" | Contagem de pesos sem embedding; determina capacidade. |
| Tokens (D) | "Dados de treinamento" | Número de tokens de treinamento vistos; determina quão bem os parâmetros são usados. |
| Compute (C) | "FLOPs gastos" | Aproximadamente `6 × N × D` pra um transformer padrão. |
| Chinchilla-ótimo | "D/N ≈ 20" | Razão que minimiza perda por FLOP de pré-treinamento. |
| Overt-treinar | "Além do Chinchilla" | Gastar FLOPs extras de treinamento pra economizar FLOPs de inferência; D/N >> 20. |
| Perda irredutível | "O piso" | O termo `E` na lei de escala; a entropia dos dados em si. |
| Capacidade emergente | "Saltos súbitos em escala" | Frequentemente artefato do avaliador; perda contínua é suave. |
| Compute efetivo | "Multiplicador de eficiência" | Melhores dados / otimizador / arquitetura multiplicam o alcance de um FLOP. |

## Leituras Complementares

- [Kaplan et al. (2020). Scaling Laws for Neural Language Models](https://arxiv.org/abs/2001.08361) — primeiro paper de leis de escala; sub-treinado.
- [Hoffmann et al. (2022). Training Compute-Optimal Large Language Models](https://arxiv.org/abs/2203.15556) — Chinchilla.
- [Schaeffer et al. (2023). Are Emergent Abilities of Large Language Models a Mirage?](https://arxiv.org/abs/2304.15004) — emergência como artefato de medição.
- [Sardana, Frankle (2024). Beyond Chinchilla-Optimal: Accounting for Inference in Language Model Scaling Laws](https://arxiv.org/abs/2401.00448) — por que o overt-treinamento da Llama é certo pra sua carga.
- [Jordan et al. (2024). Muon: An optimizer for hidden layers in neural networks](https://kellerjordan.github.io/posts/muon/) — multiplicador de 2× de compute.
