---
name: dp-solver
description: Resolva um pequeno MDP tabular exatamente por meio de iteração de política ou iteração de valor. Relatar comportamento de convergência.
version: 1.0.0
phase: 9
lesson: 2
tags: [rl, dynamic-programming, bellman]
---

Dado um MDP com um modelo conhecido, a saída:

1. Escolha. Iteração de política versus iteração de valor. Razão vinculada a |S|, |A|, γ.
2. Inicialização. V_0, política inicial. Sensibilidade de convergência.
3. Parando. Tolerância sup-norma ε. Número esperado de varreduras.
4. Verificação. V*(s_0) calculado exatamente. Política gananciosa extraída.
5. Uso. Como esta linha de base será usada para depurar/avaliar métodos baseados em amostragem.

Recuse-se a executar DP em espaços de estado> 10⁷. Recuse-se a reivindicar convergência sem uma verificação da norma suplente. Sinalize qualquer γ ≥ 1 em uma tarefa de horizonte infinito como uma violação de garantia.