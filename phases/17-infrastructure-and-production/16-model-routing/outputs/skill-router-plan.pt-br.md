---
name: router-plan
description: Projete um plano de roteamento de modelo LLM - padrão de seleção (pré-rota, cascata, conjunto), sinais (tarefa, comprimento, incorporação, confiança) e portas de qualidade online.
version: 1.0.0
phase: 17
lesson: 16
tags: [routing, cascade, model-cascade, routellm, notdiamond, cost-reduction]
---

Dado o mix de carga de trabalho (amostra de classificação de tarefas), piso de qualidade, tolerância de latência e gasto mensal atual, produza um plano de roteamento.

Produzir:

1. Padrão. Pré-rota (mais rápida, dependente do classificador), cascata (piso de melhor qualidade) ou conjunto (somente amostra A/B). Justifique com tolerância de qualidade + orçamento de latência.
2. Sinais. Escolha entre: classificação da tarefa, duração do prompt, incorporação de semelhança com o conhecido-difícil, autoconfiança. Indique quais combinam (geralmente 2-3) e a regra de composição.
3. Par barato/fronteira. Nomeie os modelos específicos. Exemplo: Claude Haiku 3.5 + GPT-5. Justifique com curva de custo + capacidade.
4. Economias esperadas. Calcular o custo combinado na divisão recomendada; estado esperado mensal $ vs atual.
5. Portões de qualidade online. Especifique o juiz de trânsito em tempo real: amostragem de 5% por rota avaliada por um juiz de fronteira; alerta se Δ qualidade > 2%. Acompanhar a taxa de escalonamento; alerta se subir >10 pontos em um mês.
6. Lançamento. Sombra (rota, mas ignore; compare off-line), canário 10% por grupo de usuários, expanda ao passar pelo portão.

Rejeições difíceis:
- Roteamento sem portas de qualidade online. Recuse – a deriva é a falha nº 1.
- Usando apenas a classificação de tarefas como sinal. Recusar – perde dificuldade nas tarefas.
- Roteamento de tarefas elegíveis de fronteira (código, matemática, multietapas) para tarefas baratas sem fallback em cascata. Recuse – o piso de qualidade será violado.

Regras de recusa:
- Se a tolerância de qualidade for declarada como “regressão zero”, recuse a pré-rota e proponha cascata com alta taxa de escalonamento.
- Se o modelo barato for não antrópico/não OpenAI/não fronteiriço e tiver padrões de recusa conhecidos (por exemplo, modelos não censurados para uso de ferramentas por agentes), recuse o par — isso interromperá as chamadas de ferramentas silenciosamente.
- Se o roteamento for barato para um provedor diferente (cascata entre provedores), exija a camada de gateway de IA (Fase 17 · 19) para unificar as APIs.

Saída: um padrão de nomenclatura de plano de uma página, sinais, par de modelos, economia esperada, portas online, plano de implementação. Termine com a métrica única: taxa de escalonamento ao longo de 7 dias consecutivos; gatilho de desvio se mudança > 10 pontos percentuais.