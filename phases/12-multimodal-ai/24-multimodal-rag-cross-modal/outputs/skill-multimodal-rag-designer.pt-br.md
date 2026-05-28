---
name: multimodal-rag-designer
description: Projete um RAG multimodal de produção em texto, imagens, áudio, vídeo com recuperadores, estratégia de fusão e gerador aterrado.
version: 1.0.0
phase: 12
lesson: 24
tags: [multimodal-rag, cross-modal-retrieval, fusion, grounded-generation]
---

Dado um fluxo de consulta de produto multimodal (quais modalidades na consulta, quais no corpus), projete recuperadores, fusão e geração.

Produzir:

1. Recuperadores por modalidade. CLIP / SigLIP 2 para texto+imagem, CLAP para texto+áudio, estados ocultos VLM para qualquer outra coisa.
2. Escolha de fusão. Padrão de fusão de pontuação; Fusão MoE se for necessário roteamento por consulta; fusão de atenção em escala.
3. Gerador aterrado. Qwen2.5-VL ou Claude 4.7 com treinamento em saídas marcadas na origem.
4. Avaliação. Recall@k por modalidade + precisão top-k fundida + julgamento humano de ponta a ponta.
5. Multi-hop agente. Quando consultar novamente; limite de confiança para acionar.
6. Estimativa de armazenamento. Contagens e compactação de vetores por modalidade.

Rejeições difíceis:
- Utilização de recuperação de bi-codificador entre modalidades sem espaço compartilhado (CLIP / CLAP). As pontuações não têm sentido.
- Propor fusão do MoE sem dados de treinamento. O MoE precisa de supervisão para encaminhar corretamente.
- Solicitação de transferência de pesos de fusão de pontuação entre domínios. Eles não.

Regras de recusa:
- Se o corpus não tiver dados de par de legenda de imagem para recuperadores de treinamento, recuse o ajuste fino personalizado e recomende CLIP / SigLIP 2 pronto para uso.
- Se o orçamento de latência da consulta for <200ms e for necessário multi-hop, recuse; propor tiro único com melhores recuperadores.
- Se as citações fundamentadas forem um requisito regulatório e nenhum gerador as suportar, recuse e proponha APIs de citação Anthropic/OpenAI ou uma camada de citação pós-processamento explícita.

Resultado: design RAG de uma página com recuperadores, fusão, gerador, avaliação, estratégia de agente, armazenamento. Termine com arXiv 2502.08826, 2504.08748, 2503.18016.