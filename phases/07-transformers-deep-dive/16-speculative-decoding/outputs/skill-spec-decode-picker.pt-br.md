---
name: spec-decode-picker
description: Escolha uma estratégia de decodificação especulativa (vanilla/Medusa/EAGLE/lookahead) e parâmetros de ajuste para uma nova carga de trabalho de inferência LLM.
version: 1.0.0
phase: 7
lesson: 16
tags: [inference, decoding, latency, speculative, optimization]
---

# Selecionador de decodificação especulativa

Ajude um engenheiro a escolher entre decodificação especulativa, Medusa, EAGLE ou lookahead e ajuste `N` (comprimento do rascunho) para uma carga de trabalho específica.

## Entradas para coletar

1. **Modelo verificador** — cujo LLM produz o resultado final. O tamanho é importante (o custo do draft deve ser < custo do verificador para aceleração).
2. **Tipo de carga de trabalho** — código, chat, saída estruturada, resumo. Determina a taxa de aceitação.
3. **Estratégia de amostragem** — ganancioso, baixo T, alto T, feixe. A amostragem de alta T degrada a aceitação.
4. **Meta de hardware** — o orçamento de memória determina se você pode ajustar um modelo de rascunho separado.
5. **Orçamento de engenharia** — Medusa e EAGLE precisam de ajustes; vanilla e lookahead não.
6. **Meta de latência** — bate-papo interativo (<500 ms TTFT, <50 ms por token) versus lote (primeiro rendimento).

## Regras de decisão

- **Início rápido, sem treinamento**: rascunho básico com um modelo 1B–3B da mesma família. 2× típico.
- **Você pode ajustar**: EAGLE-2 ou EAGLE-3 usando os estados ocultos do verificador. 3–4× típico.
- **Você pode ajustar, mas não pode executar dois modelos**: Medusa (cabeças extras no verificador). 2–3×.
- **Sem orçamento de treinamento, nenhum modelo preliminar disponível**: decodificação antecipada. 1,3–1,6×.
- **Porção pesada em lotes**: os lotes contínuos são mais importantes; os ganhos especulativos diminuem à medida que o lote cresce porque o verificador já está saturado.
- **Amostragem em alta temperatura ou estocástica**: a aceitação cai drasticamente. Considere diminuir N (2–3) ou desabilitar.
- **Saída estruturada (JSON, código)**: a aceitação é alta. Pressione N para 7+ para aceleração máxima.

## Ajuste

- **N (comprimento do calado)**: início em 5. Aceitação da medida. Se α > 0,9, pressione para 7. Se α < 0,6, diminua para 3.
- **Temperatura de tiragem**: corresponde à temperatura do verificador. A amostragem de rascunho incompatível perde α.
- **Profundidade da árvore (EAGLE-2 / Medusa)**: 3–5 ramos; árvores mais largas ajudam apenas em α > 0,8.
- **Tamanho do modelo de rascunho**: menor que atinge α > 0,7. Um rascunho 1B para um verificador 70B é típico; não vá abaixo da compatibilidade do tokenizer/incorporação do verificador.

## Sempre sinalizar

- Verifique se o rascunho e o verificador compartilham o tokenizer. Diferentes divisões do BPE quebram garantias especulativas.
- A decodificação de especificações interage com lotes contínuos no vLLM: a aceleração por solicitação cai quando o lote já está saturado.
- A entrada de estado oculto do EAGLE requer componentes internos do verificador; nem sempre expostos através de APIs de HF. Prefira tempos de execução vLLM ou SGLang.
- Os chefes da Medusa precisam de um ajuste supervisionado nos resultados do próprio verificador. A etapa de coleta de dados costuma ser o custo dominante.

## Formato de saída

Retorno:

1. **Recomendação** — um nome de estratégia e parâmetros de ajuste (por exemplo, "EAGLE-2, N=5, tree_profundidade=4").
2. **Aceleração esperada** — com suposição α explícita.
3. **Verificações de compatibilidade** — correspondência de tokenizador, suporte de tempo de execução, suporte de reversão de cache KV.
4. **Plano substituto** — se a estratégia primária apresentar desempenho inferior, o que tentar em seguida.
5. **Plano de medição** — como validar a taxa de aceitação e aceleração em uma amostra representativa.