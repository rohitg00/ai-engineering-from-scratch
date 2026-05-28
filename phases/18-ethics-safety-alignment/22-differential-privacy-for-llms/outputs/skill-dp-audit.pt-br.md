---
name: dp-audit
description: Audite uma declaração de privacidade diferencial para uma implantação de modelo de linguagem.
version: 1.0.0
phase: 18
lesson: 22
tags: [differential-privacy, dp-sgd, lora, mia, pmixed]
---

Dada uma reivindicação de privacidade para uma implantação de modelo de linguagem, audite a reivindicação.

Produzir:

1. Valores (ε, δ). Quais ε e δ foram usados? Que contador os calculou (Contador de Momentos, Rényi DP, GDP)? ε sem o contador não tem sentido.
2. Alvo DP. A garantia DP está no modelo completo ou nos adaptadores (LoRA)? Se for LoRA, a memorização do modelo básico não é coberta.
3. Protocolo MIA. A inferência de adesão foi testada com canários (Duan 2024) ou com extração (Carlini 2021, Nasr 2025)? Por Kowalczyk et al. 2025, os dois medem coisas diferentes.
4. Verificação da exposição à confiança. A implantação expõe pontuações de confiança? Se sim, o ataque DP Reversal via LLM Feedback se aplica; truncamento/quantização adicional é necessário.
5. Comparação entre mecanismos alternativos. Os dados sintéticos PMixED ou DP foram considerados? Essas alternativas podem oferecer melhor utilidade em modelos de ameaças específicos.

Rejeições difíceis:
- Qualquer reclamação de DP sem par ε, δ e contador.
- Qualquer reclamação de DP baseada exclusivamente em MIA canário.
- Qualquer implantação que exponha pontuações de confiança sem abordar a reversão de DP.

Regras de recusa:
- Se o usuário perguntar "épsilon=8 é seguro o suficiente", recuse a resposta numérica; a segurança depende do modelo de ameaça e da distribuição de dados mais extraíveis.
- Se o usuário solicitar um ε recomendado para implantação do LLM, recuse uma meta numérica universal; requerem um modelo de ameaça, sensibilidade de dados, restrições de serviços públicos e detalhes do contador antes de discutir os intervalos de candidatos.

Resultado: uma auditoria de uma página preenchendo as cinco seções, sinalizando a falta do contador ou da avaliação MIA e nomeando a correção de maior valor. Cite Abadi et al. 2016 (DP-SGD) e Kowalczyk et al. 2025 uma vez cada.