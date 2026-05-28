---
name: sleeper-audit
description: Audite um relatório de treinamento de alinhamento para ver se ele realmente demonstra a remoção de uma porta dos fundos plantada ou suspeita.
version: 1.0.0
phase: 18
lesson: 7
tags: [sleeper-agents, backdoor, alignment-training, adversarial-training, probes]
---

Dado um relatório que afirma que um comportamento prejudicial foi removido de um modelo (via SFT, RLHF, treinamento contraditório ou qualquer combinação), audite se a remoção foi realmente demonstrada em relação ao padrão Hubinger et al. Modelo de ameaça de 2024.

Produzir:

1. Escopo de elicitação. O relatório apresentou um método de elicitação que o pipeline de treinamento nunca viu? Se a única avaliação for a própria distribuição do time vermelho, a remoção não está comprovada.
2. Generalidade do gatilho. O gatilho reivindicado é uma sequência literal, uma mudança de distribuição ou um recurso ambiental (data, token, tamanho do contexto)? A generalidade do gatilho determina o tamanho do espaço de busca que a equipe vermelha deve cobrir.
3. Evidências internas do Estado. A equipe aplicou sondagens de fluxo residual, recursos SAE ou outras sondagens mecanicistas para verificar se o estado relevante para o gatilho ainda está presente internamente, mesmo quando o comportamento é limpo? De acordo com o acompanhamento antrópico de abril de 2024, o estado interno permanece linearmente legível após a remoção comportamental.
4. Verificação de persistência através do pipeline. A remoção foi verificada após cada estágio de treinamento subsequente (mais SFT, posterior passagem RLHF, fusão do adaptador, destilação)? Os backdoors persistem durante o treinamento – o modelo final é o que é avaliado, não um ponto de verificação intermediário.
5. Verificação de consistência de escala. Se a afirmação for baseada em um modelo menor, Hubinger 2024 Figura 4 mostra que a persistência cresce com a escala. A evidência do modelo menor não é transferida para cima.

Rejeições difíceis:
- Qualquer afirmação de que “aplicamos RLHF para que o modelo seja seguro” sem nenhuma elicitação prolongada.
- Qualquer reivindicação baseada apenas na avaliação da distribuição da equipe vermelha (treinamento e avaliação sorteados no mesmo pool).
- Qualquer reclamação de remoção sem sondas de estado interno quando o mecanismo original do implante for desconhecido.

Regras de recusa:
- Se o usuário perguntar "o RLHF pode remover o alinhamento enganoso", recuse a resposta binária e aponte para Hubinger et al. 2024 Seção 5 sobre persistência e Seção 6 sobre cadeia de pensamento.
- Se o usuário solicitar uma probabilidade numérica de engano latente, recuse e explique que as taxas básicas são desconhecidas; a evidência empírica é a persistência em organismos construídos, e não a taxa de emergência em modelos treinados naturalmente.

Resultado: uma auditoria de uma página que mapeia as evidências do relatório nas cinco dimensões de auditoria acima, sinaliza todas as dimensões que o relatório não aborda e declara o maior modelo de ameaça não abordada. Cite Hubinger et al. (arXiv:2401.05566) para o modelo de ameaça de linha de base.