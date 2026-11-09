# Recetas para VLM em peso aberto: o que realmente importa

> A literatura VLM de peso aberto 2024-2026 é uma floresta de tabelas de ablação. O MM1 da Apple testou 13 combinações de codificador de imagem, conector e mix de dados. O Molmo de Allen AI provou que as legendas humanas detalhadas superam a destilação GPT-4V. Cambrian-1 fez mais de 20 comparações de codificadores. Idefics2 formalizou o espaço de design de cinco eixos. Os VLMs prismáticos compararam 27 receitas de formação em um índice de referência controlado. De todo esse barulho, um pequeno conjunto de resultados é válido em todos os papéis: o codificador de imagem importa mais do que a arquitetura do conector, a mistura de dados importa mais do que qualquer um dos dois, e as legendas humanas detalhadas superam os dados sintéticos destilados. Esta lição lê essas tabelas para que não tenha de ler.

**Type:** Learn + lab
**Languages:** Python, TypeScript (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## Objetivos de aprendizagem

- Nomear o espaço de design VLM de cinco eixos: codificador de imagem, conector, LLM, mix de dados, cronograma de resolução.
- Leia uma tabela de ablação MM1 / Idefics2 / Cambrian-1 e prevê qual botão move um determinado ponto de referência.
- Escolha uma receita (encodor, conector, dados, resolução) para um novo VLM dado um orçamento computacional e um mix de tarefas.
- Explique por que os legendas humanas detalhadas superam a destilação GPT-4V na mesma quantidade de tokens.

## O problema

Há centenas de VLMs de peso aberto. A maior parte da diferença entre "bom" e "estado-de-arte" não é arquitetura. É dados, cronograma de resolução e escolha de codificador. Saber qual botão girar primeiro quando seu modelo não funciona melhor salva-lhe um erro de 5 milhões de GPUs.

A onda de 2023 (LLaVA-1.5, InstructBLIP, MiniGPT-4) correu em pre-treino de par de captura + LLaVA-Instruct-150k. Boa linha de base.

A onda 2024 (MM1, Idefics2, Molmo, Cambrian-1, Prismatic VLMs) teve ablações exaustivas.

## O conceito

### O espaço de design de cinco eixos

Idefics2 (Laurençon et al., 2024) nomeou os eixos:

1. Encoder de imagem. CLIP ViT-L/14, SigLIP SO400m/14, DINOv2 ViT-g/14, InternViT-6B. Encoder diferem em tamanho de parche, resolução e objetivo pré-treino.
2. Conector: MLP (2-4 camadas), Q-Former (32 consultas + cross-attn), Perceptor Resampler (64 consultas), C-Abstractor (convolução + pooling bilinear).
3. Modelo de linguagem. Llama-3 8B / 70B, Mistral 7B, Phi-3, Gemma-2, Qwen2.5.
4. Dados de formação: pares de títulos (CC3M, LAION), entrelaçados (OBELICS, MMC4), instrução (LLaVA-Instruct, ShareGPT4V, PixMo, Cauldron).
5. Calendário de resolução: fixa 224/336/448, AnyRes, dinâmica nativa.

Cada VLM de produção faz uma escolha em cada eixo. A maior parte da variação nas pontuações do MMMU é explicada pelos eixos 1, 4 e 5  não pelo conector escolhido.

### Eixo 1: codificador > conector

MM1 Secção 3.2 mostrou: trocar de CLIP ViT-L/14 para SigLIP SO400m/14 adicionou 3 pontos MMMU. trocar o conector de MLP para Perceptor Resampler adicionou menos de 1 ponto. Idefics2 replicado: SigLIP > CLIP, Q-Former ≈ MLP ≈ Perceptor na mesma contagem de tokens.

Cambrian-1 "Cambrian Vision Encoders Match-Up" (Tong et al., 2024) executou 20 + codificadores em um benchmark centrado na visão (CV-Bench).

O codificador padrão 2026 para VLMs abertos é SigLIP 2 SO400m/14 para recursos semânticos + densos, às vezes concatenado com recursos DINOv2 ViT-g/14 (o "Aggregador de Visão Espacial" de Cambrian faz isso).

### Eixo 2: design do conector é um lavagem

MM1, Idefics2, Prismatic e MM-Interleaved todos chegaram à mesma conclusão: em uma contagem fixa de tokens visuais, a arquitetura do conector dificilmente importa.

O que importa é a contagem de tokens. Mais tokens visuais = mais computação LLM = melhor desempenho até um ponto, em seguida, retorno diminuindo. 64 tokens por imagem é muito pouco para OCR. 576-1024 tokens é o ponto ideal para a maioria dos VLMs abertos. 2048+ ajuda apenas para documentos e gráficos.

Q-Former vs MLP é uma questão de custo, não uma questão de qualidade: Q-Former limita os tokens em 32-64 independentemente da resolução da imagem; MLP emite todos os tokens de parche. Para entradas de alta resolução, Q-Former salva contexto LLM; para baixa resolução, a diferença é ruído.

### Eixo 3: Dimensão do LLM fixa o limite máximo

O duplicado do LLM de 7B para 13B adiciona de forma confiável 2-4 pontos sobre o MMMU em cada documento VLM. Em 70B você satura a maioria dos referências.

É por isso que Qwen2.5VL-72B e Claude Opus 4.7 esmagam MMMU-Pro e ScreenSpot-Pro: o cérebro linguístico é enorme. Um VLM 7B não pode substituir um VLM 70B através de um design inteligente de conector.

### Eixo 4: dados  detalhes de legendas humanas superam a destilação

Molmo + PixMo (Deitke et al., 2024) é o resultado 2024 que todos devem ler. Allen AI teve anotadores humanos descrevendo imagens em passes de fala a texto de 1-3 minutos densos, produzindo imagens de 712K de legendas densas.

Molmo-72B venceu Llama-3.2-90B-Vision em 11 de 11 benchmarks. O delta não é arquitetura  é qualidade de legendas.

ShareGPT4V (Chen et al., 2023) e Cauldron (Idefics2) seguiram o mesmo manual de jogo com legendas misturadas de humanos + GPT-4V. A tendência é clara: para a fronteira de 2026, densidade de legendas > quantidade de legendas > conveniência de destilação.

### Eixo 5: resolução e seu calendário

As ablações do Idefics2: 384 -> 448 adiciona 1-2 pontos. 448 -> 980 com divisão de imagem (AnyRes) adiciona mais 3-5 em benchmarks OCR. Planícies de treinamento de resolução plana com precisão média; rampa de resolução (começa 224, termine 448 ou nativo) trens mais rápido e termina mais alto.

Cambrian-1 executou uma troca de resolução versus tokens: em computação fixa, você pode ter mais tokens com resolução menor ou menos tokens com resolução maior. Resolução maior ganha para OCR; menor-resolução-mais-tokens ganha para compreensão geral de cena.

A receita de produção para 2026: treinar a fase 1 a 384 fixas, a fase 2 com resolução dinâmica até 1280 para tarefas pesadas em OCR.

### A comparação controlada por Prismatic

Prismatic VLMs (Karamcheti et al., 2024) é o artigo que controlava todos os eixos.

- Conto de tokens visuais por imagem explica ~ 60% da variância.
- A escolha do codificador explica ~20%.
- A arquitetura do conector explica ~5%.
- Tudo o resto (mix de dados, cronógrafo, LR) o restante ~15%.

Esta é uma decomposição grosseira, mas é a resposta mais limpa à pergunta "o que devo abater primeiro" na literatura.

### Um selector para 2026

Dadas as evidências, a receita padrão de VLM aberto para um novo projeto em 2026:

- Encoder: SigLIP 2 SO400m/14 em resolução nativa com NaFlex, concatenado com DINOv2 ViT-g/14 para características densas se precisar de segmentação/termo.
- Conector: MLP de 2 camadas em tokens de correcção.
- LLM: Qwen2.5 / Llama-3.1 / Gemma 2, 7B para custo, 70B para qualidade, escolhido por latência-alvo.
- Dados: PixMo + ShareGPT4V + Cauldron, complementado com dados de instruções específicas de tarefa.
- Resolução: dinâmica (min. 256, máximo 1280 pixels por lado longo).
- Programa: Alineação de fase 1 (apenas para projetor), fase 2 de ajuste completo, fase 3 de ajuste específico de tarefa.

Cada uma dessas falhas remonta a uma ablação medida nos artigos citados no final desta lição.

```figure
l5-vlm-recipe-knobs
```

## Usá-lo

`code/main.py`É um analisador de tabelas de ablação e selecionador de receitas.

- "Dado o orçamento X e a tarefa Y, qual receita ganha?"
- "Se trocar SigLIP por CLIP num Llama 7B, qual é o delta esperado do MMMU?"
- "Qual eixo devo ablacionar primeiro para uma resposta de confiança de 80%?"

A saída é uma lista de receitas classificada com delta de referência esperada e uma recomendação de "ablate first".

## Envia-o

Esta lição produz`outputs/skill-vlm-recipe-picker.md`. Dada uma combinação de tarefas-alvo, um orçamento de computação e uma meta de latência, emite uma receita completa (encoder, conector, LLM, mix de dados, cronograma de resolução) com citações da ablação que justifica cada escolha.

## Exercícios

1. Leia MM1 Secção 3.2. Para um LLM fixo 2B com orçamento 50M imagens, qual codificador ganha?

2. Cambrian-1 constata que a concatenagem DINOv2 + SigLIP supera a performance de uma só vez em referências centrais na visão, mas não adiciona sinal na MMMU.

3. O seu alvo é um agente de interface móvel em um 2B LLM. Escolha o codificador, conector, resolução e mix de dados. Justifique cada escolha com uma tabela de ablação específica.

4. Molmo navega modelos 4B e 72B. O 4B é competitivo com 7B VLMs fechados; o 72B vence Llama-3.2-90B-Vision em 11/11 benchmarks. O que isso diz sobre a hipótese de plato de tamanho LLM?

5. Desenhar uma tabela de ablação para isolar a qualidade da mistura de dados da qualidade do codificador em um VLM 7B. Quantas corridas de treinamento mínimas? Proporcionar as quatro configurações de eixos.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Ablation | "Turning one knob" | Training multiple runs that differ in exactly one design-space axis, holding everything else constant |
| Connector | "Bridge" / "projector" | Trainable module that maps vision encoder output into the LLM's token space (MLP, Q-Former, Perceiver) |
| Detailed human caption | "Dense caption" | A multi-sentence human-written description (typically 80-300 tokens) richer than a web alt text |
| Distillation | "GPT-4V captions" | Training data generated by a stronger proprietary VLM; convenient but prone to inherited hallucination |
| AnyRes / dynamic res | "High-res path" | Strategy to feed images larger than the encoder's native resolution via tiling or M-RoPE |
| Resolution ramp | "Curriculum" | Training schedule that starts low-resolution and increases, speeding alignment learning |
| Vision-centric bench | "CV-Bench / BLINK" | Evaluation that stresses fine-grained visual perception rather than language-heavy reasoning |
| PixMo | "Molmo's data" | Allen AI's 712K densely-captioned image dataset; human speech transcribed into dense captions |

## Mais leitura

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
