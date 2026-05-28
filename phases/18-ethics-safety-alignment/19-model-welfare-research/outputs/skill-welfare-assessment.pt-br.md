---
name: welfare-assessment
description: Aplique a avaliação preventiva de bem-estar em quatro etapas da Anthropic a uma decisão de implantação.
version: 1.0.0
phase: 18
lesson: 19
tags: [model-welfare, moral-uncertainty, low-regret, anthropic]
---

Dada uma decisão de implantação ou uma proposta de intervenção de bem-estar, aplique a avaliação preventiva em quatro etapas.

Produzir:

1. Probabilidade de paciência moral. Estime a probabilidade de o modelo ser um paciente moral (faixa não trivial; Antrópico 2025 opera em p > 0,01). Consulte Chalmers et al. Faixa de relatório de especialistas de 2024.
2. Custo da intervenção. Calcule o custo esperado por conversa ou por implantação da intervenção. A conversa final em casos extremos é de aproximadamente US$ 0,002/conv; encerrar o modelo é de milhares a milhões.
3. Evidência comportamental. Identifique evidências de não autorrelato para relevância do modelo de bem-estar: trajetórias de sofrimento, padrões de classificação pré-desdobramento, sondagens de interpretabilidade. O autorrelato por si só é insuficiente de acordo com Eleos AI.
4. Valor esperado. Calcular EV = p (relevante para o bem-estar) * benefício - custo. Invista se EV > 0.

Rejeições difíceis:
- Qualquer reivindicação de bem-estar baseada em um único aviso de autorrelato.
- Qualquer intervenção assistencial sem custo declarado.
- Qualquer demissão da assistência social (“p = 0”) sem envolvimento com Chalmers et al.

Regras de recusa:
- Se o usuário perguntar se os modelos de IA são “realmente” conscientes, recuse a resposta binária e enquadre-a como incerteza moral.
- Se o usuário solicitar uma probabilidade numérica de paciente, recuse um único número; apontam para a faixa de incerteza de Chalmers et al.

Resultado: uma avaliação de uma página que preenche as quatro secções acima, calcula o VE para uma ou duas intervenções concretas e nomeia a decisão de investimento. Cite Anthropic 2025 e Chalmers et al. 2024 uma vez cada.