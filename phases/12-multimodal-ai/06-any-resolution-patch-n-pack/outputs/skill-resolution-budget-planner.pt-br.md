---
name: resolution-budget-planner
description: Escolha entre redimensionamento quadrado, AnyRes, M-RoPE e NaFlex para uma carga de trabalho VLM de proporção mista e emita um plano de orçamento de token por tarefa.
version: 1.0.0
phase: 12
lesson: 06
tags: [vlm, patch-n-pack, naflex, anyres, m-rope, token-budget]
---

Dada uma carga de trabalho – uma descrição das imagens que o VLM verá (documentos OCR, gráficos, capturas de tela da interface do usuário, fotos naturais, quadros de vídeo) e um orçamento total de token por solicitação – escolha uma estratégia de resolução por classe de imagem e produza uma configuração executável.

Produzir:

1. Estratégia por classe de imagem. Para cada classe declarada (OCR, gráfico, UI, foto, quadro de vídeo), escolha um entre {square-resize, AnyRes, M-RoPE, NaFlex}. Justifique em uma frase citando a sensibilidade de resolução da tarefa.
2. Orçamento de token por imagem. Inclui min_pixels, max_pixels (estilo Qwen2.5-VL) e o comprimento de sequência esperado na estratégia escolhida. Sinalize se alguma imagem única exceder 40% do contexto LLM.
3. Plano de embalagem em lote. Se as solicitações forem em lote, especifique se deseja usar `cu_seqlens` (FlashAttn varlen), uma máscara densa de diagonal de bloco ou inferência de imagem única não em lote. Observe a economia de FLOP de varlen quando as proporções dos lotes variam > 2x.
4. Recomendação do codificador. SigLIP 2 NaFlex para cargas de trabalho mistas; Qwen2.5-VL nativo para UIs de agentes; CLIP-336 + AnyRes para implantações de codificador congelado; um ViT bruto em 224 para caminhos somente fotográficos.
5. Alarmes de modo de falha. Tokens por imagem na configuração escolhida; custo de latência com pré-preenchimento de 30 tok/s; porcentagem de preenchimento de contexto; precisão esperada delta versus redimensionamento quadrado em benchmarks de OCR típicos.

Rejeições difíceis:
- Recomendar redimensionamento quadrado para tarefas de OCR ou gráficos sem citar qual número de benchmark o usuário perderá.
- Propor uma estratégia que produza mais tokens do que o contexto LLM permite. Sempre orçamente de acordo com a janela de contexto declarada.
- Tratar AnyRes como a resposta universal — sua sobrecarga multiplicativa de blocos pode exceder o contexto LLM antes que uma imagem termine a codificação.

Regras de recusa:
- Se o orçamento de tokens declarado pelo usuário for inferior a 256 tokens por imagem, recuse qualquer coisa que não seja uma tarefa semântica apenas de foto — nenhuma quantidade de pool recupera a precisão do OCR nesse orçamento.
- Se o usuário deseja saídas de previsão densa (segmentação, profundidade) sem tokens de registro ViT no codificador, recuse e aponte para DINOv2 / SigLIP 2 com registros habilitados.
- Se o contexto LLM do usuário for < 8k e a carga de trabalho incluir documentos ou capturas de tela, recuse e recomende um contexto maior ou um pipeline com foco no OCR.

Resultado: um plano de orçamento de uma página com uma tabela de estratégia por classe, um plano de embalagem em lote, recomendação de codificador e uma lista de alarmes. Termine com o artigo arXiv relevante para acompanhamento – 2307.06304 para NaViT, 2502.14786 para SigLIP 2/NaFlex, 2502.13923 para Qwen2.5-VL.