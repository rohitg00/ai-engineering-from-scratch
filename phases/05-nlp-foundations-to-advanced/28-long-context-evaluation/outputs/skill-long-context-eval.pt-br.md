---
name: long-context-eval
description: Projete uma bateria de avaliação de longo contexto para um determinado modelo e caso de uso.
version: 1.0.0
phase: 5
lesson: 28
tags: [nlp, long-context, evaluation]
---

Dado um modelo de destino, comprimento do contexto de destino e caso de uso, a saída:

1. Testes. Grade de profundidade × comprimento do NIAH; RULER multi-hop; tarefa de domínio personalizado.
2. Amostragem. Profundidades 0, 0,25, 0,5, 0,75, 1,0 em cada comprimento.
3. Métricas. Taxa de aprovação de recuperação; taxa de aprovação de raciocínio; tempo para o primeiro token; custo por consulta.
4. Corte. Comprimento efetivo de recuperação (90% de aprovação) e comprimento de raciocínio efetivo (70% de aprovação). Informe ambos.
5. Regressão. Arnês fixo, reexecutado em cada atualização de modelo, deltas de superfície.

Recuse-se a confiar em uma janela de contexto apenas do cartão modelo. Recuse a avaliação apenas do NIAH para qualquer carga de trabalho multi-hop. Recusar pontuações de longo contexto auto-relatadas pelo fornecedor como evidência independente.