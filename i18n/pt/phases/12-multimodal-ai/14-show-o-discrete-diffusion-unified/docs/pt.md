# Modelos unificados de exibição e difusão discreta

> A transfusão mistura representações contínuas e discretas. Show-o (Xie et al., agosto 2024) vai pelo outro lado: tokens de texto usam previsão causal do próximo token, tokens de imagem usam difusão discreta mascarada no espírito do MaskGIT. Ambos sentam-se dentro de um transformador com uma máscara híbrida de atenção. O resultado unifica VQA, texto-para-imagem, inpainting e geração de modalidade mista em uma espinha dorsal, um tokenizer por modalidade, uma formulação de perda (next-token estendido para previsão mascarada). Esta lição segue o design Show-o  por que a difusão discreta mascarada é um gerador de imagem paralelo, em poucos passos  e contrasta com Transfusão e Emu3.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## Objetivos de aprendizagem

- Explicar a difusão discreta mascarada: o cronograma que mascara os tokens uniformemente e então pede ao transformador para recuperá-los.
- Compare a descodificação de imagem paralela (Show-o, MaskGIT) com a descodificação de imagem autoregressiva (Chameleon, Emu3) em velocidade e qualidade.
- Nomear as quatro tarefas que o Show-o realiza num único ponto de controlo: geração de texto, VQA, T2I, pintura de imagem.
- Escolha um cronograma de enmascaramento (cosinoso, linear, truncado) e racionalize o seu efeito sobre a qualidade da amostra.

## O problema

A transfusão funciona com dois perdas de treinamento, mas tem dinâmica mais complicada. A perda contínua de difusão vive em uma escala numérica diferente da perda discreta de NTP.

A resposta de Show-o: mantenha ambas as modalidades discretas (como o Camelão), mas gerar imagens em paralelo através de difusão discreta mascarada em vez de sequencialmente.

## O conceito

### Dispersão discreta mascarada (MaskGIT)

O truque original Chang et al. (2022) MaskGIT é elegante. Comece com uma imagem totalmente mascarada (cada token é o especial `<MASK>`Em cada etapa, prevê todos os tokens mascarados em paralelo, em seguida, mantenha as previsões mais confiantes do top-K e re-mascarar o resto. Após ~ 8-16 iterações, todos os tokens são preenchidos. O cronograma de quantos tokens desmascarar por etapa é sintonizado.

O treinamento é simples: amostrar uma proporção de mascaramento uniformemente a partir de [0, 1], aplicá-lo aos tokens VQ da imagem, treinar o transformador para recuperar os mascarados.

### Show-o: um transformador, máscara híbrida

O show-o coloca o MaskGIT dentro de um transformador de modelo de linguagem causal.

- Tokens de texto: causal (MLL padrão).
- Tokens de imagem: bidirecionais completos dentro do bloco de imagem (para que os tokens mascarados possam ver todos os outros tokens de imagem durante a previsão).
- Texto-a-imagem: texto atende às imagens anteriores, imagem atende ao texto anterior.

Formação alternada entre:
1. NTP padrão em sequências de texto.
2. T2I amostras: texto → imagem com tokens de imagem mascarados, perda de previsão de tokens mascarados.
3. amostras de VQA: imagem → texto com tokens de texto mascarados (na verdade apenas NTP).

A perda unificada é a entropia cruzada em`<MASK>`Tokens, que abrange tanto o texto NTP (apenas o último token é "mascarado") como a difusão mascarada de imagem (subconjunto aleatório é mascarado).

### Amostragem paralela

Show-o gera uma imagem em ~16 passos em vez de ~1000 (autoregressivo por token) ou ~20 (difusão). Em cada passo, prevê todos os tokens mascarados em paralelo; comprometa o top-K confiante; repita.

Comparar:
- Chameleon / Emu3 (autoregressivo sobre tokens): N_tokens passes para a frente, normalmente 1024-4096 por imagem.
- Transfusão (difusão contínua): ~ 20 passos, cada um com um transformer completo.
- Show-o (difusão discreta mascarada): ~ 16 passos, cada um com passagem de transformador completo.

O Show-o é mais rápido do que o Chameleon em modelos de escala similar, correspondendo aproximadamente ao número de etapas da Transfusão com menor custo por etapa (logits de vocabulário discreto vs perda contínua de MSE).

### Funções num único ponto de controlo

Show-o suporta quatro tarefas na inferência, selecionadas por formato prompt:

- Geração de texto: saída de texto autoregressivo padrão.
- Imagem, mensagem.
- T2I: entrada de texto, saída de imagem através de difusão discreta mascarada.
- Imagem com alguns tokens enmascarados, preencher.

A capacidade de pintura vem gratuitamente do treinamento de previsão mascarada. Mascarar uma região da grade de tokens VQ, alimentar o resto mais um prompt de texto, prever os tokens mascarados.

### Programa de enmascaramento

O cronograma de quantos tokens devem ser desmascarados por passo forma a qualidade.

```math
\text{mask\_ratio}(t) = \cos\left(\frac{\pi t}{2T}\right) \qquad t = 0, \ldots, T
```

No passo 0, todos os tokens são mascarados (ratio 1.0).$T$O cosino concentra a massa em proporções de médio alcance onde a previsão é mais informativa.

### - O2

Show-o2 (2025 acompanhamento, arXiv 2506.15564) escalas Show-o: maior base de LLM, melhor tokenizer, melhor cronograma de máscara.

### Onde o Show-o está sentado

Na taxonomia de 2026:

- Tokens discretos + NTP: camaleão, Emu3.
- Tokens discretos + difusão mascarada: Show-o, MaskGIT, LlamaGen, Muse. Amostração paralela, ainda perdida pelo tokenizer.
- Transfusão contínua + difusão: Transfusão, MMDiT, DiT. Formação de alta qualidade, mais complexa.
- Combinação contínua + fluxo em um VLM: JanusFlow, InternVL-U. Mais recente.

Selecionar por tarefa: Show-o quando quiser T2I + inpainting + VQA em um modelo aberto com velocidade razoável; Transfusão quando a qualidade é primordial e você pode pagar a canalização de duas perdas.

```figure
masked-diffusion-unmask
```

## Usá-lo

`code/main.py`Simula a amostragem de show-o:

- Uma grade de brinquedos de 16 tokens VQ.
- Um falso "transformador" que prevê logits com base em um prompt e os tokens atualmente desmascarados.
- Amostragem paralela mascarada em 8 etapas com cronograma cosínico.
- Imprime os estados intermediários (evolução de padrão de máscara) e os tokens finais.

- É melhor. - Vamos, vamos.

## Envia-o

Esta lição produz`outputs/skill-unified-gen-model-picker.md`. Tendo em conta um produto que necessita de compreensão (VQA, subtítulos) e geração (T2I, inpainting) com restrições de peso aberto, escolha entre a família Show-o, a família Transfusion/MMDiT e a família Emu3/Chameleon com compensações concretas.

## Exercícios

1. Mascaradas amostras de difusão discreta em ~16 passos. Por que não 1? O que se rompe se você desmascarar tudo no passo 0?

2. A pintura é gratuita com difusão mascarada. Propõe um caso de utilização do produto (real ou hipotético) em que a pintura do Show-o seja superior a um modelo especializado.

3. Calendário cosínico vs calendário linear: rastrear o número de tokens desmascarados por passo para T=8. Qual é mais equilibrado?

4. Uma imagem de 512x512 mostra-o é 1024 tokens.$K=16384$, o modelo emite$1024 \cdot \log_2(16384) = 14{,}336$Bit (~ 1,75 KiB) de dados. Estabilidade de difusão de 512 * 512 * 24 bits = 6.291.456 bits (~ 768 KiB) de pixels brutos. Qual é a relação de compressão e que qualidade compra?

5. Leia LlamaGen (arXiv:2406.06525). Como o modelo de imagem autoregressiva condicional de classe do LlamaGen é diferente da abordagem mascarada do Show-o?

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Training to predict masked tokens; at inference, iteratively unmask the most-confident predictions |
| Cosine schedule | "Unmask schedule" | Decay of mask ratio over inference steps; concentrates confidence growth at mid-range |
| Parallel decoding | "All tokens at once" | Every step predicts the full sequence of masked tokens in one forward pass, then commits top-K |
| Hybrid attention | "Causal + bidirectional" | Mask that is causal over text tokens and bidirectional within image blocks |
| Inpainting | "Fill-in generation" | Condition on an image with some tokens masked, predict the missing ones; free from the training objective |
| Commitment rate | "Top-K per step" | How many tokens are declared "done" per iteration; controls inference vs quality trade-off |

## Mais leitura

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
