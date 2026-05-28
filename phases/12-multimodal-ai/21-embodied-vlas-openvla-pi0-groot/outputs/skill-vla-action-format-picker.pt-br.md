---
name: vla-action-format-picker
description: Escolha um formato de ação (bin discreto, FAST, correspondência de fluxo, sistema duplo) e família VLA (RT-2, OpenVLA, π0, GR00T) para uma tarefa de robô.
version: 1.0.0
phase: 12
lesson: 21
tags: [vla, rt-2, openvla, pi0, groot, action-tokenization]
---

Dada uma tarefa de robô (manipulação, navegação, humanóide de corpo inteiro), contagem de DOF, exigência de taxa de controle e restrição de computação, escolha um formato de ação e uma família de VLA.

Produzir:

1. Formato de ação. Caixa discreta para tarefas simples de braço único, RÁPIDA para trajetórias sensíveis à velocidade, correspondência de fluxo para controle contínuo suave, sistema duplo para humanóides.
2. Escolha da família VLA. RT-2 (fechado), OpenVLA (7B aberto), π0 (fluxo aberto), GR00T N1 (humanóide de sistema duplo aberto).
3. Viabilidade da taxa de controle. Combine a taxa de transferência do formato com o Hz de controle necessário. Bin discreto não pode fazer >10 Hz em um modelo 7B.
4. Combinação de dados de treinamento. Proporção de co-ajuste fino (web VQA: robô). Comece em 0,5:1, ajuste por tarefa.
5. Ajuste o plano. LoRA em aproximadamente 500-1000 demonstrações de tarefas; ajuste completo em ~ 10k demos.
6. Portões de segurança. Verificações necessárias da camada de controle fora do VLA.

Rejeições difíceis:
- Recomendar VLA sem especificação de camada de segurança. Sempre inclua limites articulares, recorte de velocidade.
- Reivindicar a tokenização de compartimento discreto é rápida o suficiente para controle de 30 Hz. Não é.
- Propor correspondência de fluxo sem restrições de suavidade adequadas. Ações fora da distribuição ainda acontecem.

Regras de recusa:
- Se o requisito de taxa de controle for >50 Hz em um modelo <=7B com formato de compartimento discreto, recuse; recomendo π0 ou um cabeçote especializado.
- Se o robô tiver >30 DOF (humanóide), recusar arquiteturas de estágio único; requerem sistema duplo (GR00T).
- Se o orçamento não puder pagar o pré-treinamento em escala Open X-Embodiment, recuse o VLA do zero; recomendo o ajuste fino do OpenVLA.

Resultado: plano de uma página com formato de ação, seleção de VLA, verificação de taxa de controle, mix de co-ajuste, portas de segurança. Termine com arXiv 2307.15818 (RT-2), 2406.09246 (OpenVLA), 2410.24164 (π0), 2503.14734 (GR00T).