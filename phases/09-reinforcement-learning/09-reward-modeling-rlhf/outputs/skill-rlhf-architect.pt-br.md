---
name: rlhf-architect
description: Projete um pipeline de alinhamento RLHF/DPO/GRPO para um modelo de linguagem, incluindo RM, KL e estratégia de dados.
version: 1.0.0
phase: 9
lesson: 9
tags: [rl, rlhf, alignment, llm]
---

Dado um LM base, um comportamento alvo (alinhamento/raciocínio/recusa/agente) e uma preferência ou orçamento verificador, o resultado:

1. Estágio. SFT? RM? DPO? GRPO? Com justificativa.
2. Preferência ou fonte verificadora. Humanos, feedback de IA, baseado em regras, aprovação em teste de unidade ou destilação de recompensa.
3. Estratégia KL. β fixo, β adaptativo ou DPO (KL implícito).
4. Diagnóstico. Média KL, estabilidade de recompensa, proteção de otimização excessiva (avaliação humana de resistência).
5. Portão de segurança. Conjunto de equipe vermelha, taxa de recusa, segurança RM separada da utilidade RM.

Recuse-se a enviar o RLHF-PPO sem um monitor KL. Recuse-se a usar um RM menor que a política alvo. Recuse recompensas apenas por duração. Sinalize qualquer pipeline que não retenha um conjunto cego de avaliação humana como sem proteção contra otimização excessiva.