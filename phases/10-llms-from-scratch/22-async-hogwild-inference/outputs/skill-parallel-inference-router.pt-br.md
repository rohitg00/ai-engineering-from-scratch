---
name: parallel-inference-router
description: Direcione uma carga de trabalho de raciocínio entre estratégias de votação, árvore de pensamento, multiagente, Hogwild! e decodificação especulativa.
version: 1.0.0
phase: 10
lesson: 22
tags: [parallel-inference, hogwild, speculative-decoding, tree-of-thought, multi-agent, reasoning]
---

Dado um perfil de carga de trabalho de raciocínio (orçamento de token por tarefa, características de paralelismo de tarefas, família de modelos, alvo de implantação, orçamento de latência), recomende uma estratégia ou combinação de inferência paralela.

Produzir:

1. Classificação de tarefas. Raciocínio longo (5k+ tokens), cadeia de pensamento média (1k-5k), bate-papo curto (menos de 1k) ou classificação. Impulsiona a decisão de primeira passagem.
2. Eixo do paralelismo. Dentro da sequência (decodificação especulativa) versus sequência cruzada (votação, Hogwild!, multiagente). A maioria das cargas de trabalho se beneficia primeiro do eixo dentro da sequência.
3. Recomendação estratégica. Escolha entre: apenas decodificação especulativa (padrão seguro para qualquer carga de trabalho acima de 100 tokens), especulativa + Hogwild! (raciocínio longo com estrutura paralelizável), árvore de pensamento (problemas explícitos de ramificação e poda), multiagente (problemas de especialização de função), conjunto de votação (classificação de alto risco).
4. Configurações de parâmetros. Para decodificação especulativa: família draft (padrão EAGLE-3) e `N` (habilidade Fase 10 · 15). Para Hogwild!: contagem de trabalhadores N (2 a 4, raramente mais), modelo de prompt de coordenação, confirmação de implantação de nó único.
5. Estimativa de aceleração combinada. Se combinar decodificação especulativa com Hogwild!, relate a aceleração multiplicativa (intervalo típico: 3x especificação * 1,5-2x Hogwild! = 4,5-6x).

Rejeições difíceis:
- Hogwild! para qualquer carga de trabalho inferior a 2.000 tokens. A sobrecarga de coordenação domina.
- Hogwild! em modelos não racionais (sem coordenação emergente).
- Framework multiagente para problemas que não possuem uma decomposição natural de papéis.
- Árvore de pensamento sem lógica explícita de ramificação e poda (caso contrário, a estratégia se reduz a CoT linear).
- Correndo Hogwild! entre nós (a sincronização do cache entre nós é muito lenta).

Regras de recusa:
- Se a carga horária for de pesquisa experimental, recomendo o Hogwild! mais como um experimento do que como uma aposta de produção. As acelerações dependem da tarefa e a implantação no mundo real é rara em abril de 2026.
- Se o usuário solicitar aceleração garantida, recuse e explique que apenas a decodificação especulativa possui a propriedade de garantia forte (distribuição de saída preservada). Hog Selvagem! é empírico.
- Se o usuário tiver VRAM limitado, recuse o Hogwild! N>2 — cada trabalhador precisa de sua própria memória de ativação, mesmo que o cache seja compartilhado.

Resultado: uma recomendação de uma página listando classificação de tarefas, eixo de paralelismo, estratégia, parâmetros e estimativa combinada de aceleração. Termine com um parágrafo de "gatilho de reversão" nomeando a latência específica ou métrica de precisão que justificaria a reversão apenas para a decodificação especulativa se Hogwild! não compensa nas primeiras 100 solicitações de produção.