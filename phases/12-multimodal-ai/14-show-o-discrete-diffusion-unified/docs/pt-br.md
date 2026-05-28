# Show-o e Modelos Unificados por Difusão Discreta

> Transfusion mistura representações contínuas e discretas. Show-o (Xie et al., agosto 2024) vai pelo outro lado: tokens de texto usam previsão causal de próximo token, tokens de imagem usam difusão discreta mascarada no espírito do MaskGIT. Os dois ficam dentro de um transformer com máscara híbrida de attention. O resultado unifica VQA, texto-para-imagem, inpainting e geração de modalidade mista em uma backbone, um tokenizer por modalidade, uma formulação de loss (next-token estendido pra previsão mascarada). Esta aula caminha pelo design do Show-o — por que difusão discreta mascarada é um gerador paralelo de poucos passos — e contrasta com Transfusion e Emu3.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, sampler de difusão discreta mascarada)
**Pré-requisitos:** Fase 12 · 13 (Transfusion)
**Tempo:** ~120 minutos

## Objetivos de Aprendizado

- Explicar difusão discreta mascarada: o cronograma que mascara tokens uniformemente e depois pede pro transformer recuperá-los.
- Comparar decodificação paralela de imagem (Show-o, MaskGIT) com decodificação autoregressiva de imagem (Chameleon, Emu3) em velocidade e qualidade.
- Nomear as três tarefas que o Show-o lida em um checkpoint: T2I, VQA, inpainting de imagem.
- Escolher um cronograma de mascaramento (cosseno, linear, truncado) e raciocinar sobre seu efeito na qualidade das amostras.

## O Problemo

O treinamento com duas losses do Transfusion funciona, mas tem dinâmicas mais complicadas — a loss de difusão contínua vive em uma escala numérica diferente da loss NTP discreta. Equilibrar pesos de loss é busca de hiperparâmetro. A arquitetura é efetiva mas complexa.

Resposta do Show-o: mantenha ambas modalidades discretas (como Chameleon), mas gere imagens em paralelo via difusão discreta mascarada ao invés de sequencialmente. O objetivo de treinamento vira uma previsão de token mascarado única que generaliza a previsão de próximo token naturalmente.

## O Conceito

### Difusão discreta mascarada (MaskGIT)

O truque original do MaskGIT de Chang et al. (2022) é elegante. Começa de uma imagem totalmente mascarada (cada token é o id especial `<MASK>`). A cada step, prevê todos os tokens mascarados em paralelo, depois mantém os top-K previsões mais confiantes e re-mascara o resto. Depois de ~8-16 iterações, todos os tokens estão preenchidos. O cronograma de quantos tokens desmascarar por step é ajustado — cronogramas cosseno funcionam bem.

Treinamento é simples: amostra uma razão de mascaramento uniformemente de [0, 1], aplica nos tokens VQ da imagem, treina o transformer pra recuperar os mascarados. Exatamente o que BERT fez pra texto, escalado pra geração de imagem.

### Show-o: um transformer, máscara híbrida

Show-o coloca MaskGIT dentro de um transformer de modelo de linguagem causal. A máscara de attention é:

- Tokens de texto: causal (LLM padrão).
- Tokens de imagem: completamente bidirecionais dentro do bloco de imagem (pra que os tokens mascarados possam ver todos os outros tokens de imagem durante a previsão).
- Texto-para-imagem: texto olha pra imagens anteriores, imagem olha pra texto anterior.

Treinamento alterna entre:
1. NTP padrão em sequências de texto.
2. Amostras T2I: texto → imagem com tokens de imagem mascarados, loss de previsão de token mascarado.
3. Amostras VQA: imagem → texto com tokens de texto mascarados (na verdade é só NTP).

A loss unificada é entropia cruzada em tokens `<MASK>`, que cobre tanto NTP de texto (só o último token é "mascarado") quanto difusão mascarada de imagem (subconjunto aleatório é mascarado).

### Amostragem paralela

Show-o gera uma imagem em ~16 steps ao invés de ~1000 (autoregressivo por token) ou ~20 (difusão). A cada step, prevê todos os tokens mascarados em paralelo; confirma os top-K confiantes; repete.

Comparação:
- Chameleon / Emu3 (autoregressivo sobre tokens): N_tokens passos forward, tipicamente 1024-4096 por imagem.
- Transfusion (difusão contínua): ~20 steps, cada um um passo completo do transformer.
- Show-o (difusão discreta mascarada): ~16 steps, cada um um passo completo do transformer.

Show-o é mais rápido que Chameleon em modelos de escala similar, mais ou menos empata com Transfusion em contagem de steps com custo por step menor (logits de vocabulário discreto vs loss MSE contínua).

### Tarefas em um checkpoint

Show-o suporta quatro tarefas na inferência, selecionadas pelo formato do prompt:

- Geração de texto: saída de texto autoregressiva padrão.
- VQA: imagem pra dentro, texto pra fora.
- T2I: texto pra dentro, imagem pra fora via difusão discreta mascarada.
- Inpainting: imagem com alguns tokens mascarados, preencher.

A capacidade de inpainting vem de graça do treinamento de previsão mascarada. Mascara uma região do grid de tokens VQ, alimenta o resto mais um prompt de texto, prevê os tokens mascarados.

### Cronograma de mascaramento

O cronograma de quantos tokens desmascarar por step molda a qualidade. Show-o recomenda cosseno:

```
mask_ratio(t) = cos(pi * t / (2 * T))   # t = 0..T
```

No step 0, todos os tokens mascarados (razão 1.0). No step T, nenhum mascarado. Cosseno concentra massa nas razões intermediárias onde a previsão é mais informativa. Cronogramas lineares também funcionam, mas estagnam mais rápido.

### Show-o2

Show-o2 (follow-up de 2025, arXiv 2506.15564) escala Show-o: LLM base maior, tokenizer melhor, cronograma de mascaramento melhorado. Mesmo padrão arquitetural.

### Onde Show-o se encaixa

Na taxonomia de 2026:

- Tokens discretos + NTP: Chameleon, Emu3. Simples mas inferência lenta.
- Tokens discretos + difusão mascarada: Show-o, MaskGIT, LlamaGen, Muse. Amostragem paralela, ainda com perdas pelo tokenizer.
- Contínuo + difusão: Transfusion, MMDiT, DiT. Maior qualidade, treinamento mais complexo.
- Contínuo + fluxo-matching num VLM: JanusFlow, InternVL-U. Mais recentes.

Escolha por tarefa: Show-o quando você quer T2I + inpainting + VQA em um modelo open com velocidade razoável; Transfusion quando qualidade é primordial e você pode bancar a tubulação de duas losses.

## Use

`code/main.py` simula a amostragem do Show-o:

- Um grid toy de 16 tokens VQ.
- Um "transformer" mock que prevê logits baseado em um prompt e os tokens atualmente desmascarados.
- Amostragem mascarada paralela em 8 steps com cronograma cosseno.
- Imprime estados intermediários (evolução do padrão de máscara) e tokens finais.

Rode e observe a máscara se dissolver step a step.

## Implemente

Esta aula produz `outputs/skill-unified-gen-model-picker.md`. Dado um produto que precisa tanto de compreensão (VQA, legendagem) quanto geração (T2I, inpainting) com restrição de pesos abertos, escolhe entre família Show-o, família Transfusion/MMDiT e família Emu3 / Chameleon com trade-offs concretos.

## Exercícios

1. Difusão discreta mascarada amostra em ~16 steps. Por que não 1? O que quebra se você desmascara tudo no step 0?

2. Inpainting é de graça com difusão mascarada. Proponha um caso de uso de produto (real ou hipotético) onde o inpainting do Show-o supera um modelo especializado.

3. Cronograma cosseno vs cronograma linear: trace o número de tokens desmascarados por step pra T=8. Qual é mais equilibrado?

4. Uma imagem Show-o de 512x512 tem 1024 tokens. Com vocabulário K=16384, o modelo emite 1024 * log2(16384) = 14.336 bits (~1.75 KiB) de dados. Stable Diffusion produz 512*512*24 bits = 6.291.456 bits (~768 KiB) de pixels brutos. Qual é a razão de compressão e que qualidade ela compra?

5. Leia LlamaGen (arXiv:2406.06525). Como o modelo autoregressivo de imagem condicional de classe do LlamaGen é diferente da abordagem mascarada do Show-o?

## Termos-Chave

| Termo | O que a galera diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Difusão discreta mascarada | "Estilo MaskGIT" | Treinamento pra prever tokens mascarados; na inferência, desmascara iterativamente as previsões mais confiantes |
| Cronograma cosseno | "Cronograma de desmascarar" | Decaimento da razão de máscara ao longo dos steps de inferência; concentra crescimento de confiança no meio |
| Decodificação paralela | "Todos os tokens ao mesmo tempo" | Cada step prevê a sequência completa de tokens mascarados em um passo forward, depois confirma os top-K |
| Attention híbrida | "Causal + bidirecional" | Máscara causal sobre tokens de texto e bidirecional dentro de blocos de imagem |
| Inpainting | "Geração de preenchimento" | Condiciona uma imagem com alguns tokens mascarados, prevê os que faltam; de graça do objetivo de treinamento |
| Taxa de compromisso | "Top-K por step" | Quantos tokens são declarados "prontos" por iteração; controla trade-off inferência vs qualidade |

## Leitura Complementar

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
