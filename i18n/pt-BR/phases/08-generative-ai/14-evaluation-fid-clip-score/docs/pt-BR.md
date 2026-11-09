# Avaliação  FID, CLIP Score, Preferência Humana

> Cada quadro de classificação de modelos geracionais cita o FID, a pontuação CLIP e uma taxa de vitória de uma arena de preferência humana. Cada número tem um modo de falha que um pesquisador determinado pode jogar.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 01 (Taxonomy), Phase 2 · 04 (Evaluation Metrics)
**Time:** ~45 minutes

## O problema

Um modelo gerativo é julgado em * qualidade de amostra * e * adesão de condicionamento *. Nem tem uma medida de forma fechada. Seu modelo tem que renderizar 10.000 imagens; algo tem que atribuí-las números; você tem que confiar nos números em todas as famílias de modelos, em todas as resoluções, em todas as arquiteturas. Três métricas sobreviveram ao guante 2014-2026.

- **FID (Fréchet Inception Distance).**Distância entre duas distribuições  reais e geradas  no espaço de recursos de uma rede de iniciação.
- **CLIP score.**A semelhança cosínea entre a incorporação de imagem CLIP de uma imagem gerada e a incorporação de texto CLIP de um prompt. Mais alto é melhor. Medidas de adesão de prompt.
- **Human preference.**Coloque dois modelos frente a frente no mesmo prompt, faça com que os humanos (ou um modelo de classe GPT-4) escolham o melhor, agregando para uma pontuação Elo.

Você também verá: IS (pontuação inicial, em grande parte aposentado), KID, CMMD, ImageReward, PickScore, HPSv2, MJHQ-30k. Cada corrigir para um fracasso do anterior.

## O conceito

![FID, CLIP, and preference: three axes, different failure modes](../assets/evaluation.svg)

### Qualidade da amostra

Heusel et al. (2017). Passo:

1. Extrair recursos Inception-v3 (2048-D) para N imagens reais e N geradas.
2. Aplique um Gaussian a cada piscina: média de cálculo $\mu_r, \mu_g$e covariância $\Sigma_r, \Sigma_g$- Não .
3. $\text{FID} = \lVert \mu_r - \mu_g \rVert^2 + \mathop{\mathrm{Tr}}\left(\Sigma_r + \Sigma_g - 2 \cdot (\Sigma_r \cdot \Sigma_g)^{0.5}\right)$- Não .

Interpretação: Distância de Fréchet entre dois Gaussianos multivariados no espaço de características.

Modos de falha:
- **Biased on small N.**FID é o quadrado médio sobre a distribuição de características  pequena N subestima covariância, dá falsamente baixo FID. Sempre use $N \ge 10{,}000$- Não .
- **Inception-dependent.**Inception-v3 foi treinado na ImageNet. Domínios longe da ImageNet (faces, arte, imagens de texto) produzem FID sem sentido. Use um extractor de recursos específico de domínio.
- **Gaming.**O excesso de montagem ao prévio de iniciação dá uma baixa FID sem melhoria da qualidade visual.

### Ponto CLIP  adesão rápida

Radford et al. (2021). Para uma imagem gerada + prompt:

```
clip_score = cos_sim( CLIP_image(x_gen), CLIP_text(prompt) )
```

Uma média de 30k imagens geradas → um escala comparável entre os modelos.

Modos de falha:
- **CLIP's own blind spots.**O CLIP tem um raciocínio composto fraco ("um cubo vermelho em uma esfera azul" muitas vezes falha). Os modelos podem classificar bem no resultado do CLIP sem realmente seguir instruções complexas.
- **Short prompt bias.**As instruções curtas têm mais coincidências de imagem CLIP na natureza.
- **Prompt gaming.**Incluindo "alta qualidade, 4k, obra-prima" no prompt infla a pontuação CLIP sem melhorar a ligação imagem-texto.

CMMD (Jayasumana et al., 2024) corrige algumas destas: utiliza recursos CLIP em vez de Inception, discrepância máxima-média em vez de Fréchet. Melhor na detecção de diferenças de qualidade sutis.

### Preferência humana  a verdade fundamental

Escolha um conjunto de instruções. Gerencie com o modelo A e o modelo B. Mostre pares para os seres humanos (ou um forte juiz de LLM).

- **PartiPrompts (Google)**1.600 indicações diversas, 12 categorias.
- **HPSv2**: 107 mil anotações humanas, amplamente utilizadas como proxy automatizado.
- **ImageReward**137K pares de preferências de imagem rápida, licenciados pelo MIT.
- **PickScore**- formação em preferências de Pick-a-Pic 2.6M.
- **Chatbot-Arena-style image arenas**- Não .https://imagearena.ai/E outros.

Modos de falha:
- **Judge variance.**Os não-especialistas têm preferências diferentes das dos especialistas.
- **Prompt distribution.**As instruções escolhidas favorem uma família.
- **LLM-judge reward hacking.**O juiz GPT-4 é enganado por resultados bonitos, mas errados.

## Utilização conjunta

Um relatório de avaliação da produção deve incluir:

1. FID em amostras de 10 a 30 mil em relação a uma distribuição real prolongada (qualidade da amostra).
2. Ponto CLIP / CMMD nas mesmas amostras versus as suas indicações (adherença).
3. Taxa de vitória em uma arena cegar em relação ao modelo anterior (preferência geral).
4. Análise do modo de falha: 50 saídas randomizadas, marcadas por problemas conhecidos (anatomia da mão, renderização de texto, contagem consistente de objetos).

Qualquer métrica é uma mentira. Três métricas corroboradoras + revisão qualitativa são uma alegação.

```figure
gx-fid-distributions
```

## Construí-lo

`code/main.py`Implementa a agregação de FID, CLIP-score-like e Elo em "vectores de características" sintéticos (usamos vectores 4D como substitutos para características de Inception).

- Calculação FID em um pequeno N e em um grande N  o viés.
- "Colocação CLIP" como similaridade cosínea entre as pools de características.
- Regra de atualização de Elo a partir de um fluxo de preferências sintéticas.

### Passo 1: FID em quatro linhas

```python
def fid(real_features, gen_features):
    mu_r, cov_r = mean_and_cov(real_features)
    mu_g, cov_g = mean_and_cov(gen_features)
    mean_diff = sum((a - b) ** 2 for a, b in zip(mu_r, mu_g))
    trace_term = trace(cov_r) + trace(cov_g) - 2 * sqrt_cov_product(cov_r, cov_g)
    return mean_diff + trace_term
```

### Passo 2: Similaridade cosínica de estilo CLIP

```python
def clip_like(image_feat, text_feat):
    dot = sum(a * b for a, b in zip(image_feat, text_feat))
    norm = math.sqrt(dot_self(image_feat) * dot_self(text_feat))
    return dot / max(norm, 1e-8)
```

### Passo 3: Agregação de Elo

```python
def elo_update(r_a, r_b, winner, k=32):
    expected_a = 1 / (1 + 10 ** ((r_b - r_a) / 400))
    actual_a = 1.0 if winner == "a" else 0.0
    r_a_new = r_a + k * (actual_a - expected_a)
    r_b_new = r_b - k * (actual_a - expected_a)
    return r_a_new, r_b_new
```

## Encurralagens

- **FID at N=1000.**Os documentos que relatam baixa N FID estão a jogar.
- **Comparing FID across resolutions.**O tamanho de 299×299 da Inception altera a distribuição de recursos.
- **Reporting one seed.**Faça 3 sementes no mínimo.
- **CLIP score inflation via negative prompts.**Alguns canais aumentam o CLIP, ajustando o sinal de sinal.
- **Elo bias from prompt overlap.**Se ambos os modelos viram um prompt de referência durante o treinamento, o Elo não tem sentido.
- **Human eval paid-crowd skew.**Prolíficos, os anotadores MTurk tendem a ser mais jovens / amigáveis à tecnologia.

## Usá-lo

Protocolo de avaliação da produção em 2026:

| Pillar | Minimum | Recommended |
|--------|---------|-------------|
| Sample quality | FID on 10k vs held-out real | + CMMD on 5k + FID on subset per category |
| Prompt adherence | CLIP score on 30k | + HPSv2 + ImageReward + VQA-style question answering |
| Preference | 200 blinded pairs vs baseline | + 2000 paired human + LLM-judge + Chatbot Arena |
| Failure analysis | 50 hand-flagged | 500 hand-flagged + automated safety classifier |

Os quatro pilares num relatório = reivindicação.

## Envia-o

Salvar`outputs/skill-eval-report.md`. A Skill toma um novo ponto de controlo modelo + linha de base e elabora um plano de avaliação completo: tamanhos de amostra, métricas, sondas de modo de falha, critérios de assinatura.

## Exercícios

1. **Easy.**Corra .`code/main.py`. Comparar FID em N=100 vs N=1000 nas mesmas distribuições sintéticas.
2. **Medium.**Implementar CMMD a partir de características sintéticas de estilo CLIP (ver Jayasumana et al., 2024 para a fórmula).
3. **Hard.**Replicar a configuração HPSv2: pegue 1000 pares de imagens de um subconjunto de Pick-a-Pic, ajuste o pequeno marcador baseado em CLIP nas preferências e mensure sua concordância com um conjunto mantido.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| FID | "Fréchet Inception Distance" | Fréchet distance of Gaussian fits to real vs gen Inception features. |
| CLIP score | "Text-image similarity" | Cosine similarity between CLIP image and text embeddings. |
| CMMD | "FID's replacement" | CLIP-feature MMD; less biased, no Gaussian assumption. |
| IS | "Inception score" | Exp KL(p(y|x) || p(y)); correlates poorly on modern models, retired. |
| HPSv2 / ImageReward / PickScore | "Learned preference proxies" | Small models trained on human preferences; used as automatic judges. |
| Elo | "Chess rating" | Bradley-Terry aggregation of pairwise wins. |
| PartiPrompts | "The benchmark prompt set" | 1,600 Google-curated prompts across 12 categories. |
| FD-DINO | "Self-sup replacement" | FD using DINOv2 features; better for out-of-ImageNet domains. |

## Nota de produção: a avaliação é também uma carga de trabalho de inferência

Para uma base SDXL de 50 passos em 10242 em um único L4, isto é ~ 11 horas de inferência de pedido único. Os orçamentos de avaliação são reais, e o enquadramento é exatamente o cenário de inferência offline (máxima o throughput, ignore o TTFT):

- **Batch hard, forget latency.**Avaliação offline = batch estático no maior tamanho que se encaixa na memória. `pipe(...).images`com`num_images_per_prompt=8`num H100 de 80 GB funciona 4 a 6 vezes mais rápido do que um único pedido.
- **Cache the real features.**A extracção da função Inception (FID) ou CLIP (CLIP-score, CMMD) sobre o conjunto de referência real é executada *once*, armazenada como um`.npz`Não recomputem por avaliação.

Para os portões de CI / regressão: executar o FID + CLIP em um subconjunto de 500 amostras por PR (~ 30 min); executar o FID + HPSv2 + Elo completo por noite.

## Mais leitura

- [Heusel et al. (2017). GANs Trained by a Two Time-Scale Update Rule Converge to a Local Nash Equilibrium (FID)](https://arxiv.org/abs/1706.08500)Papel da FID.
- [Jayasumana et al. (2024). Rethinking FID: Towards a Better Evaluation Metric for Image Generation (CMMD)](https://arxiv.org/abs/2401.09603) CMMD.
- [Radford et al. (2021). Learning Transferable Visual Models from Natural Language Supervision (CLIP)](https://arxiv.org/abs/2103.00020)- O que é isso?
- [Wu et al. (2023). HPSv2: A Comprehensive Human Preference Score](https://arxiv.org/abs/2306.09341) HPSv2.
- [Xu et al. (2023). ImageReward: Learning and Evaluating Human Preferences for Text-to-Image Generation](https://arxiv.org/abs/2304.05977) ImageReward.
- [Yu et al. (2023). Scaling Autoregressive Models for Content-Rich Text-to-Image Generation (Parti + PartiPrompts)](https://arxiv.org/abs/2206.10789) PartiPrompts.
- [Stein et al. (2023). Exposing flaws of generative model evaluation metrics](https://arxiv.org/abs/2306.04675) Pesquisa de modo de falha.
