# Avaliação — FID, CLIP Score, Preferência Humana

> Todo ranking de modelo generativo cita FID, CLIP score e uma taxa de vitória de arena de preferência humana. Cada número tem um modo de falha que um pesquisador determinado pode explorar. Se você não conhece os modos de falha, não consegue distinguir uma melhoria real de uma execução explorada.

**Tipo:** Construir
**Linguagens:** Python
**Pré-requisitos:** Fase 8 · 01 (Taxonomia), Fase 2 · 04 (Métricas de Avaliação)
**Tempo:** ~45 minutos

## O Problema

Um modelo generativo é julgado por *qualidade de amostra* e *aderência à condicionalização*. Nenhuma tem medida de forma fechada. Seu modelo precisa renderizar 10.000 imagens; algo precisa atribuir números a elas; você precisa confiar nos números entre famílias de modelos, entre resoluções, entre arquiteturas. Três métricas sobreviveram ao gauntlet de 2014-2026:

- **FID (Fréchet Inception Distance).** Uma distância entre duas distribuições — real e gerada — no espaço de features de uma rede Inception. Quanto menor, melhor.
- **CLIP score.** Similaridade cosseno entre o embedding CLIP-image de uma imagem gerada e o embedding CLIP-text de um prompt. Quanto maior, melhor. Mede aderência ao prompt.
- **Preferência humana.** Confronte dois modelos no mesmo prompt, tenha humanos (ou um modelo de classe GPT-4) escolher o melhor, agregue em um score Elo.

Você também verá: IS (inception score, largamente aposentado), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Cada um corrige uma falha do anterior.

## O Conceito

![FID, CLIP e preferência: três eixos, modos de falha diferentes](../assets/evaluation.svg)

### FID — qualidade de amostra

Heusel et al. (2017). Passos:

1. Extraia features Inception-v3 (2048-D) para N imagens reais e N geradas.
2. Ajuste uma gaussiana em cada pool: calcule média `μ_r, μ_g` e covariância `Σ_r, Σ_g`.
3. FID = `||μ_r - μ_g||² + Tr(Σ_r + Σ_g - 2 · (Σ_r · Σ_g)^0,5)`.

Interpretação: distância Fréchet entre duas gaussianas multivariadas no espaço de features. Menor = distribuições mais similares.

Modos de falha:
- **Viesado para N pequeno.** FID é média-quadrada sobre a distribuição de features — N pequeno subestima a covariância, dá FID falsamente baixo. Sempre use N ≥ 10.000.
- **Dependente do Inception.** Inception-v3 foi treinado no ImageNet. Domínios distantes do ImageNet (rostos, arte, imagens de texto) produzem FID sem significado. Use um extrator de features eespecificaçãoífico do domínio.
- **Exploração.** Sobreadaptação ao prior do Inception dá FID baixo sem melhoria de qualidade visual. Supere com CMMD (abaixo).

### CLIP score — aderência ao prompt

Radford et al. (2021). Para uma imagem gerada + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

Média sobre 30k imagens geradas → um escalar comparável entre modelos.

Modos de falha:
- **Cegueiras próprias do CLIP.** CLIP tem raciocínio composicional fraco ("um cubo vermelho sobre uma esfera azul" frequentemente falha). Modelos podem ter boa pontuação no CLIP score sem realmente seguir prompts complexos.
- **Viés de prompts curtos.** Prompts curtos têm mais correspondências CLIP-image na natureza. Prompts mais longos têm CLIP scores mecanicamente mais baixos.
- **Exploração de prompt.** Incluir "alta qualidade, 4k, obra-prima" no prompt infla o CLIP score sem melhorar a ligação texto-imagem.

CMMD (Jayasumana et al., 2024) corrige alguns desses: usa features CLIP em vez de Inception, máxima discrepância de média em vez de Fréchet. Melhor para detectar diferenças sutis de qualidade.

### Preferência humana — o ground truth

Escolha um conjunto de prompts. Gere com o modelo A e o modelo B. Mostre pares para humanos (ou um forte LLM juiz). Agregue vitórias em um score Elo ou Bradley-Terry. Benchmarks:

- **PartiPrompts (Google):** 1.600 prompts diversos, 12 categorias.
- **HPSv2:** 107k anotações humanas, amplamente usado como proxy automatizado.
- **ImageReward:** 137k pares preferência prompt-imagem, licença MIT.
- **PickScore:** treinado no Pick-a-Pic com 2,6M de preferências.
- **Arenas de imagem estilo Chatbot-Arena:** https://imagearena.ai/ e outros.

Modos de falha:
- **Variância do juiz.** Não-eespecificaçãoialistas têm preferências diferentes de eespecificaçãoialistas. Use os dois.
- **Distribuição de prompts.** Prompts selecionados favorecem uma família. Sempre documente.
- **Exploração de reward por LLM-juiz.** GPT-4-juiz é enganado por saídas bonitas mas erradas. Triangule com humanos.

## Use em conjunto

Um relatório de avaliação de produção deve incluir:

1. FID em 10-30k amostras contra uma distribuição real de teste (qualidade de amostra).
2. CLIP score / CMMD nas mesmas amostras vs seus prompts (aderência).
3. Taxa de vitória em arena cega vs o modelo anterior (preferência geral).
4. Análise de modos de falha: 50 saídas amostradas aleatoriamente, sinalizadas para problemas conhecidos (anatomia de mãos, renderização de texto, contagem consistente de objetos).

Qualquer métrica isolada é uma mentira. Três métricas corroboradas + revisão qualitativa é uma afirmação.

## Construa

`code/main.py` implementa FID, pontuação similar a CLIP, e agregação Elo em "vectores de features" sintéticos (usamos vetores 4D como substitutos de features Inception). Você vê:

- Cálculo de FID em N pequeno e em N grande — o viés.
- "CLIP score" como similaridade cosseno entre pools de features.
- Regra de atualização Elo de um stream de preferências sintético.

### Passo 1: FID em quatro linhas

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Passo 2: similaridade cosseno estilo CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Passo 3: agregação Elo

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Armadilhas

- **FID com N=1000.** Heurística é não-confiável abaixo de N=10k. Papers reportando FID de baixo N estão explorando.
- **Comparando FID entre resoluções.** O resize de 299×299 do Inception muda a distribuição de features. Compare apenas em resolução correspondente.
- **Reportando uma semente.** Rode 3 sementes no mínimo. Reporte std.
- **Inflação de CLIP score via negative prompts.** Alguns pipelines aumentam o CLIP sobreadaptando o prompt. Verifique saturação visual.
- **Viés de Elo por sobreposição de prompts.** Se ambos os modelos viram um prompt de benchmark durante treino, Elo é inútil. Use conjuntos de prompts de teste.
- **Enviesamento de grupo de avaliadores worker pago em avaliação humana.** Anotadores do Prolific, MTurk são tendenciosamente mais jovens / tech-friendly. Misture com eespecificaçãoialistas recrutados de arte/design.

## Use

Protocolo de avaliação de produção em 2026:

|| Pilar | Mínimo | Recomendado ||
||--------|---------|-------------||
|| Qualidade de amostra | FID em 10k vs real de teste | + CMMD em 5k + FID em subconjunto por categoria ||
|| Aderência ao prompt | CLIP score em 30k | + HPSv2 + ImageReward + resposta estilo VQA ||
|| Preferência | 200 pares cegos vs baseline | + 2000 pareados humanos + LLM-juiz + Chatbot Arena ||
|| Análise de falha | 50 sinalizados manualmente | 500 sinalizados + classificador de segurança automatizado ||

Os quatro pilares em um relatório = afirmação. Qualquer um isolado = marketing.

## Entregue

Salve `outputs/skill-eval-report.md`. A skill recebe um novo checkpoint de modelo + baseline e gera um plano de avaliação completo: tamanhos de amostra, métricas, sondas de modos de falha, critérios de aprovação.

## Exercícios

1. **Fácil.** Execute `code/main.py`. Compare FID em N=100 vs N=1000 nas mesmas distribuições sintéticas. Reporte a magnitude do viés.
2. **Médio.** Implemente CMMD a partir de features sintéticas estilo CLIP (veja Jayasumana et al., 2024 para a fórmula). Compare sensibilidade a diferenças de qualidade vs FID.
3. **Difícil.** Replique o setup HPSv2: pegue 1000 pares imagem-prompt de um subconjunto do Pick-a-Pic, faça fine-tune de um pequeno pontuador baseado em CLIP nas preferências, e meça seu acordo com um conjunto de teste.

## Termos Chave

|| Termo | O que as pessoas dizem | O que realmente significa ||
||------|-----------------|-----------------------||
|| FID | "Fréchet Inception Distance" | Distância Fréchet de ajustes gaussianos em features Inception reais vs geradas. ||
|| CLIP score | "Similaridade texto-imagem" | Similaridade cosseno entre embeddings CLIP de imagem e texto. ||
|| CMMD | "Substituto do FID" | MMD de features CLIP; menos viesado, sem假设 gaussiana. ||
|| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlaciona mal em modelos modernos, aposentado. ||
|| HPSv2 / ImageReward / PickScore | "Proxies de preferência treinados" | Pequenos modelos treinados em preferências humanas; usados como juízes automatizados. ||
|| Elo | "Rating de xadrez" | Agregação Bradley-Terry de vitórias pareadas. ||
|| PartiPrompts | "O conjunto de prompts benchmark" | 1.600 prompts selecionados pelo Google em 12 categorias. ||
|| FD-DINO | "Substituto auto-supervisionado" | FD usando features DINOv2; melhor para domínios fora do ImageNet. |

## Nota de produção: avaliação também é uma carga de inferência

Rode FID em 10k amostras significa gerar 10k imagens. Para um SDXL base de 50 passos em 1024² em uma L4, isso são ~11 horas de inferência de requisição única. Orçamentos de avaliação são reais, e o enquadramento é exatamente o cenário de inferência offline (maximize throughput, ignore TTFT):

- **Batch pesado, esqueça latência.** Avaliação offline = batch estático no maior tamanho que cabe em memória. `pipe(...).images` com `num_images_per_prompt=8` em uma H100 de 80GB roda 4-6× mais rápido em tempo de relógio que requisição única.
- **Cache as features reais.** A extração de features do Inception (FID) ou CLIP (CLIP-score, CMMD) sobre o conjunto de referência real roda *uma vez*, é armazenada como `.npz`. Não recalcule por avaliação.

Para portões CI / regressão: rode FID + CLIP score em um subconjunto de 500 amostras por PR (~30 min); rode FID completo de 10k + HPSv2 + Elo toda noite.

## Leituras Complementares

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500) — paper do FID.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) — CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020) — CLIP.
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) — HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) — ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) — PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) — levantamento de modos de falha.
