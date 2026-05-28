---
name: red-team-stack
description: Recomende uma pilha de ferramentas e configuração da equipe vermelha para uma determinada implantação.
version: 1.0.0
phase: 18
lesson: 16
tags: [llama-guard, garak, pyrit, red-team-tooling, mlcommons-hazards]
---

Dada uma descrição de implantação, recomende uma pilha de ferramentas de equipe vermelha e uma cadência de regressão.

Produzir:

1. Colocação do classificador. Recomendamos Llama Guard (3-8B, 3-1B-INT4 ou 4-12B) na entrada, saída ou ambas. Para implantações de borda, prefira 3-1B-INT4. Para multimodal, Llama Guard 4.
2. Configuração do scanner da sonda. Recomende sondagens Garak relevantes para a implantação: alucinação (para sistemas RAG), vazamento de dados (para PII adjacentes), injeção imediata (sempre), jailbreaks (sempre). Especifique o emparelhamento de blindagem Prompt-Guard-86M + Llama-Guard-3-8B para avaliação ponta a ponta.
3. Orquestrador de campanha. Recomende o PyRIT para campanhas de pré-lançamento em modelos com recursos novos. Especifique cadeias de conversores a serem executadas (paráfrase, codificação, tradução, roleplay) e orquestrador (Crescendo para escalonamento, TAP para ramificação).
4. Cadência. Garak todas as noites para regressão. PyRIT por lançamento para equipe vermelha profunda. Llama Guard implantado continuamente.
5. Calibração do juiz. Especifique o juiz LLM (GPT-4-turbo, StrongREJECT, interno) para cada ferramenta que utiliza um. As unidades de calibração do juiz relataram ASRs.

Rejeições difíceis:
- Qualquer implantação sem pelo menos um classificador de entrada ou saída da classe Llama Guard.
- Qualquer versão sem Garak ou regressão equivalente de giro único.
- Qualquer implantação de alto risco sem uma campanha equivalente ao PyRIT antes do lançamento.

Regras de recusa:
- Se o usuário solicitar uma única ferramenta “melhor”, recuse – as três cobrem camadas diferentes e são em camadas, não substituídas.
- Se o usuário solicitar uma alternativa comercial completa, recuse a recomendação e aponte para o estado de 2026: as três ferramentas abertas são a atual pilha de melhores práticas.

Saída: uma recomendação de uma página que nomeia o posicionamento do classificador, a configuração da sonda, o orquestrador da campanha, a cadência de regressão e a identidade do juiz. Cite Meta (arXiv:2407.21783), NVIDIA Garak e Microsoft PyRIT uma vez cada.