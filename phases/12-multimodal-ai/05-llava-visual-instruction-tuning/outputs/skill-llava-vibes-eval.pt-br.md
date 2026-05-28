---
name: llava-vibes-eval
description: Execute uma avaliação de vibração de 10 prompts em um VLM da família LLaVA e produza um scorecard legível por humanos.
version: 1.0.0
phase: 12
lesson: 05
tags: [llava, vlm, vibes-eval, instruction-tuning]
---

Dado um VLM da família LLaVA (LLaVA-1.5, LLaVA-NeXT, LLaVA-OneVision ou um fork comunitário) e um conjunto de imagens de teste, execute um teste de fumaça de 10 prompts cobrindo legendas, VQA, raciocínio, recusa e conformidade de formato. Produza um scorecard que confirme que o projetor e o LLM estão conectados corretamente.

Produzir:

1. Dez prompts com descrições de comportamento esperado:
   - Três legendas (curtas, detalhadas, criativas).
   - Três VQA (contagem, cor, presença de objeto).
   - Dois raciocínios (comparar duas regiões, causa e efeito).
   - Duas recusas (particular, identificador de PII).
2. Pontuação por solicitação. Aprovado/parcial/reprovado com justificativa de uma linha.
3. Diagnóstico geral do padrão. Se a legenda for aprovada, mas o VQA falhar, suspeite da combinação de dados do estágio 2. Se a legenda detalhada mostrar alucinação, suspeite de dados insuficientes no estilo ShareGPT4V. Se as recusas falharem, sinalize uma lacuna nos dados de segurança.
4. Verificação da resolução. Execute um prompt que exige OCR na base 336x336 e novamente em AnyRes; observe o delta. É esperada falha de baixa resolução; falha de alta resolução significa que AnyRes está configurado incorretamente.
5. Acompanhamento sugerido. Três adições específicas de dados de treinamento que o chamador poderá executar se categorias específicas falharem.

Rejeições difíceis:
- Pontuação de VLMs em números de benchmark sem executar também o conjunto de vibrações. Os benchmarks podem ser jogados; vibrações revelam prontidão real de implantação.
- Confundir alucinação com verbosidade estilística. Sinalize especificamente quais objetos são inventados e quais são meramente descritos de forma elaborada.
- Reivindicar uma aprovação nas instruções de raciocínio sem verificar a cadeia de raciocínio, não apenas a resposta final.

Regras de recusa:
- Se o chamador solicitar a avaliação de vibrações de um VLM proprietário (Gemini, Claude, GPT-5V) sem acesso à API, recuse - o teste precisa de inferência real.
- Se o caso de uso alvo for diagnóstico médico ou aconselhamento jurídico, recuse — vibes-eval não é uma certificação e não deve ser usado para domínios de alto risco.
- Se nenhuma imagem for fornecida, recuse — o teste é baseado em imagem por definição.

Resultado: um scorecard com 10 linhas (prompt, imagem, esperado, real, aprovado/parcial/reprovado), um diagnóstico de padrão geral e uma lista de acompanhamento de três itens. Termine com um parágrafo "o que ler a seguir" apontando para a Lição 12.06 (AnyRes) para falhas relacionadas à resolução ou para a Lição 12.07 (ablações) para ajuste da mistura de dados.