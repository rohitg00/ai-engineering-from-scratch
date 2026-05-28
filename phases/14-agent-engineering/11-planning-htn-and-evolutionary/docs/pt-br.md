# Planejamento com HTN e Busca Evolutiva

> Planejamento simbólico lida com os casos onde o plano é provavelmente correto. Busca evolutiva de código lida com os casos onde a função fitness é verificável por máquina. ChatHTN (2025) e AlphaEvolve (2025) mostram o que cada um desbloqueia quando pareado com um LLM.

**Tipo:** Construção
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 02 (ReWOO e Plan-and-Execute)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Explicar Redes de Tarefas Hierárquicas: tarefas, métodos, operadores, pré-condições, efeitos.
- Descrever o loop híbrido do ChatHTN — busca simbólica com decomposição de reserva via LLM.
- Explicar o loop evolutivo do AlphaEvolve e por que só funciona com um avaliador programático.
- Implementar um planejador HTN de exemplo e uma busca evolutiva de exemplo com stdlib.

## O Problema

ReWOO (Aula 02), Plan-and-Execute e ReAct cobrem a maioria do planejamento de agent. Dois casos que eles não cobrem bem:

1. **Planos com correção provável.** Escalonamento, rotas de voo, workflows de conformidade — o plano tem que ser correto por construção. Um plano fluente de LLM que às vezes alucina uma etapa é inaceitável.
2. **Otimizações com função fitness verificável por máquina.** Multiplicação de matrizes, heurísticas de escalonamento, passes de compilador — o objetivo não é "um plano correto" mas "o melhor plano."

Planejamento HTN e AlphaEvolve resolvem os dois problemas diferentes. Ambos usam LLMs como amplificadores, não substitutos.

## O Conceito

### Redes de Tarefas Hierárquicas

Um HTN é:

- **Tarefas** — compostas (pra serem decompostas) e primitivas (diretamente executáveis).
- **Métodos** — formas de decompor uma tarefa composta em subtarefas, com pré-condições.
- **Operadores** — ações primitivas com pré-condições e efeitos.
- **Estado** — um conjunto de fatos.

Planejamento: dada uma tarefa objetivo e um estado inicial, encontrar uma decomposição em operadores primitivos cujas pré-condições são satisfeitas em sequência.

HTN é mais antigo que LLMs e ainda é referência pra planos provavelmente corretos.

### ChatHTN (Gopalakrishnan et al., 2025)

ChatHTN (arXiv:2505.11814) alterna HTN simbólico com consultas a LLM:

1. Tenta decompor a tarefa composta atual com métodos existentes.
2. Se nenhum método se aplica, pergunta ao LLM: "como você decomporia `task` no estado `s`?"
3. Traduz a resposta do LLM em subtarefas candidatas.
4. Valida contra o schema do operador; rejeita decomposições inválidas.
5. Recursa.

A alegação central do paper: todo plano produzido é provavelmente correto porque sugestões de LLM só entram como decomposições candidatas, nunca como edições diretas de plano. A camada simbólica detém correção; o LLM expande a biblioteca de métodos.

Aprendizado online de métodos (OpenReview `gwYEDY9j2x`, follow-up de 2025) adiciona um aprendiz que generaliza decomposições produzidas por LLM via regressão — reduzindo frequência de consulta a LLM em até 75%.

### AlphaEvolve (Novikov et al., 2025)

AlphaEvolve (arXiv:2506.13131, DeepMind, Junho 2025) é um bicho diferente: busca evolutiva de código orquestrada por um ensemble de Gemini 2.0 Flash/Pro.

Loop:

1. Começa com um programa semente + um avaliador programático (retorna uma pontuação de fitness).
2. Ensemble de LLMs propõe mutações.
3. Roda mutações pelo avaliador.
4. Mantém a melhor; muta de novo.

Vitórias publicadas:

- Primeira melhoria sobre Strassen pra multiplicação de matrizes complexas 4x4 em 56 anos (48 multiplicações escalares).
- 0.7% de compute recuperado via uma heurística de escalonamento do Borg.
- 32% de aceleração no FlashAttention numa carga frontier.

A restrição rígida: a função fitness tem que ser verificável por máquina. Busca evolutiva sobre respostas em prosa não converge.

### Quando usar qual

| Classe de problema | Use | Por quê |
|--------------------|-----|---------|
| Escalonamento com restrições rígidas | HTN + ChatHTN | Correção provável |
| Otimização de compilador | AlphaEvolve | Fitness verificável por máquina |
| Execução multi-etapa de tarefas | ReAct / ReWOO | LLM no loop, sem garantias formais |
| Melhoria de código com testes | AlphaEvolve | Testes são o avaliador |
| Automação vinculada a política | HTN | Pré-condições codificam política |

### Onde esse padrão dá errado

- **HTN sem operadores.** Sem schemas de pré-condição/efeito a alegação de correção colapsa. "LLM sugere decomposição" do ChatHTN requer o schema pra rejeitar movimentos inválidos.
- **AlphaEvolve sem avaliador real.** "Perguntar ao LLM se o código é melhor" não é função fitness. O avaliador tem que ser determinístico e rápido.
- **Sobre-engenharia.** A maioria das tarefas de agente não precisa de nenhum dos dois. Recorra a ReAct ou ReWOO primeiro.

## Construa

`code/main.py` implementa dois exemplos:

- Um planejador HTN stdlib com operadores, métodos, pré-condições, efeitos e um `LLMFallback` que entra quando nenhum método combina com uma tarefa composta. O "LLM" é um decompositor programado pra que o planejador rode offline.
- Uma busca evolutiva stdlib sobre programas aritméticos: cresça expressões cuja saída minimiza `|f(x) - target|` sobre um conjunto de teste. Avaliador é determinístico.

Rode:

```
python3 code/main.py
```

O trace mostra o planejador HTN decompondo uma tarefa composta (com um reserva de LLM no meio do plano) e o loop evolutivo convergindo numa expressão alvo.

## Use

- **Planejadores HTN** — `pyhop`, `SHOP3` ou construa o seu próprio pra imposição de política eespecificaçãoífica de domínio.
- **ChatHTN** — código de pesquisa; o padrão (simbólico + reserva LLM) porta limpo pra qualquer planejador HTN.
- **AlphaEvolve** — paper da DeepMind; o padrão (ensemble + avaliador) é reproduzível. OpenEvolve e forks open-source similares estão surgindo.
- **Frameworks de agent** — nenhum entrega HTN ou AlphaEvolve de primeira classe ainda. Construa como subagent ou worker de background.

## Entregue

`outputs/skill-hybrid-planner.md` gera um scaffold de planejador híbrido (HTN ou evolutivo) com o papel do LLM explicitamente escopado.

## Exercícios

1. Estenda o planejador HTN com backtracking: quando a pós-condição de um operador falha em runtime, volte atrás e tente o próximo método.
2. Adicione um cache de métodos-LLM ao ChatHTN: quando o LLM decompõe a tarefa `T` no padrão de estado `P`, armazene o resultado. Recheque a biblioteca de métodos primeiro na próxima chamada.
3. Troque o avaliador da busca evolutiva pra uma suíte de testes real. Evolua uma função de sort que passe 20 casos de teste; reporte gerações até convergência.
4. Leia as notas de design do avaliador do AlphaEvolve. Projete um avaliador pra um domínio que te interessa (otimização de consulta SQL, minimização de suíte de teste, YAML de deploy).
5. Combine: use HTN pra decompor uma tarefa composta em subtarefas, depois use busca evolutiva no operador primitivo de cada subtarefa. Onde ele brilha, onde ele sobre-engenharia?

## Termos-Chave

| Termo | O que a galera fala | O que realmente significa |
|-------|---------------------|---------------------------|
| HTN | "Planejador hierárquico" | Decomposição de tarefa com operadores, pré-condições, efeitos |
| Method | "Regra de decomposição" | Forma de quebrar uma tarefa composta em subtarefas |
| Operator | "Ação primitiva" | Passo concreto com pré-condição e efeito |
| ChatHTN | "LLM + HTN" | Planejador simbólico pergunta LLM quando nenhum método combina |
| AlphaEvolve | "Busca evolutiva de código" | Ensemble de LLMs muta código; avaliador determinístico seleciona |
| Fitness function | "Avaliador" | Pontuação determinística e verificável por máquina sobre saídas |
| Online method learning | "Decomposição LLM em cache" | Armazenar + generalizar planos LLM pra cortar custo de consulta |

## Leitura Complementar

- [Gopalakrishnan et al., ChatHTN (arXiv:2505.11814)](https://arxiv.org/abs/2505.11814) — planejador híbrido simbólico + LLM
- [Novikov et al., AlphaEvolve (arXiv:2506.13131)](https://arxiv.org/abs/2506.13131) — busca evolutiva de código com mutações de LLM
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — quando recorrer a um planejador vs um loop simples
