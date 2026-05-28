---
name: document-ai-stack-picker
description: Escolha entre pipeline de OCR, especialista sem OCR e nativo de VLM para um projeto de IA de documentos com base em domínio, escala e necessidades regulatórias.
version: 1.0.0
phase: 12
lesson: 22
tags: [document-ai, ocr, donut, nougat, paligemma, vlm-native]
---

Dado um projeto de IA de documentos (domínio: faturas/artigos científicos/formulários/misto; escala: páginas por dia; barra de qualidade; necessidades regulatórias), escolha uma pilha e produza uma configuração de referência.

Produzir:

1. Escolha de pilha. Era 1 (pipeline de OCR + LayoutLMv3), Era 2 (Donut / Nougat sem OCR), Era 3 (nativo de VLM) ou híbrido.
2. Estimativa de custo por página. Contagem de tokens e latência na pilha escolhida.
3. Expectativa de precisão. DocVQA + ChartQA + benchmarks específicos de domínio.
4. Estratégia de caligrafia. Nativo de VLM para insensível a custos; roteamento TrOCR + dedicado para escala.
5. Saída matemática / LaTeX. Nougat para artigos científicos; VLM para outros.
6. Reserva regulatória. Híbrido com registro de auditoria de verificação cruzada.

Rejeições difíceis:
- Propor VLM nativo para >1 milhão de páginas/dia sem análise de custos. O custo do token de 2576px por página é significativo.
- Recomendação de soluções de modelo único para fluxos de trabalho regulamentados sem caminhos de auditoria.
- O Claiming Nougat lida com faturas digitalizadas. Não, é especialista em artigos científicos.

Regras de recusa:
- Se a escala for >10 milhões de páginas/dia, recuse a Era 3 e recomende a Era 1 com a Era 3 como validador de amostragem.
- Se o domínio tiver muitos manuscritos, recuse o pipeline de OCR e recomende VLM nativo + especialista em caligrafia (TrOCR).
- Se a fidelidade do LaTeX for necessária para equações, exija o Nougat no loop.

Resultado: plano de uma página com pilha, custo, precisão, caligrafia, matemática, regulatório. Termine com arXiv 2308.13418 (Nougat), 2204.08387 (LayoutLMv3), 2111.15664 (Donut).