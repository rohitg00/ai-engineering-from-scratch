---
name: eval-architect
description: Projete um plano de avaliação LLM com juiz calibrado e portas CI.
version: 1.0.0
phase: 5
lesson: 27
tags: [nlp, evaluation, rag]
---

Dado um caso de uso (RAG/agente/tarefa generativa), saída:

1. Métricas. Fidelidade/relevância/precisão de contexto/recuperação de contexto + quaisquer métricas G-Eval personalizadas com critérios.
2. Modelo de juiz. Modelo nomeado + versão, justificativa para custo versus precisão.
3. Calibração. Tamanho do conjunto rotulado à mão, alvo Spearman rho vs humano> 0,7.
4. Controle de versão do conjunto de dados. Estratégia de tags, log de alterações, estratificação.
5. Porta CI. Limites por métrica, lógica de janela de regressão, alerta de quantil inferior.

Recuse-se a confiar em um juiz não testado contra ≥50 exemplos rotulados por humanos. Recusar autoavaliação (mesmo modelo gera + juízes). Recuse relatórios apenas agregados sem que os 10% inferiores apareçam. Sinalize qualquer pipeline onde a atualização do juiz chega sem avaliação de linha de base paralela.