---
name: doc-qa
description: Crie um sistema de controle de qualidade de documentos multimodal com visão inicial em 10 mil páginas com recuperação de interação tardia e citações de regiões de evidências.
version: 1.0.0
phase: 19
lesson: 04
tags: [capstone, multimodal, rag, colpali, colqwen, late-interaction, pdf]
---

Dado um corpus de PDFs (10-Ks, artigos científicos, documentos digitalizados), construa um pipeline que indexe páginas como imagens usando interação tardia no estilo ColPali e responda a perguntas com regiões de evidências no nível da página.

Plano de construção:

1. Renderize cada página PDF em um PNG 1536x2048 com PyMuPDF a 180 DPI.
2. Incorpore todas as páginas com ColQwen2.5-v0.2 ou ColQwen3-omni. Armazene embeddings de patches multivetoriais em Vespa, Qdrant multivetor ou AstraDB.
3. Aplique poda de patch de 50% no estilo DocPruner. Verifique se a queda de precisão permanece abaixo de 0,5% no ViDoRe v3.
4. No momento da consulta: incorpore tokens de consulta; calcule o MaxSim em relação aos patches de cada página; classificação top-k.
5. Sintetize com Qwen3-VL-30B ou Gemini 2.5 Pro passando a consulta mais as 5 imagens da página principal. Exige âncoras `(doc_id, page, region)` citadas.
6. Para páginas com muitas equações ou tabelas, execute Nougat ou dots.ocr como um canal de texto opcional e alimente-o ao lado da imagem.
7. Crie um visualizador Next.js 15 que sobreponha regiões de evidências como caixas delimitadoras na página de origem.
8. Avalie no ViDoRe v3 e M3DocVQA. Produza uma matriz de classe de conteúdo × abordagem comparando a visão primeiro com o OCR e depois o texto em texto simples, tabelas, gráficos, caligrafia e equações.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Precisão ViDoRe v3 / M3DocVQA | Referência versus linha de base de OCR e texto em páginas correspondentes |
| 20 | Aterramento da região de evidências | Fração de regiões citadas que contêm o intervalo de resposta |
| 20 | Engenharia de armazenamento e latência | Compressão DocPruner, índice p95, resposta p95 em 2s |
| 20 | Raciocínio de várias páginas | Precisão em um conjunto de várias páginas com 100 perguntas rotuladas à mão |
| 15 | UX de inspeção de origem | Fidelidade de sobreposição, ferramentas de comparação, explorador página por página |

Rejeições difíceis:

- Pipelines OCR-first apresentados como "vision-first", adaptando o texto OCR em uma incorporação de vetor único.
- Qualquer sistema que descarte caixas delimitadoras em nível de patch e, portanto, não possa renderizar sobreposições de evidências.
- Números de armazenamento relatados sem documentação das configurações do DocPruner.

Regras de recusa:

- Recuse-se a indexar contratos jurídicos digitalizados sem uma política de redação dedicada. Os embeddings ColQwen vazam conteúdo.
- Recuse-se a atender consultas em um corpus que o usuário não tenha divulgado. A trilha de auditoria é obrigatória para domínios regulamentados.
- Recuse-se a comparar com OCR-então-texto sem executar os dois pipelines no mesmo corpus.

Saída: um repositório contendo o pipeline de ingestão, a configuração Vespa (ou multivetor Qdrant), o conjunto de avaliação de 100 perguntas de várias páginas, a IU do visualizador e um artigo com a matriz de abordagem de classe de conteúdo x e uma recomendação concreta para quais classes de conteúdo ainda favorecem OCR-então-texto em 2026.