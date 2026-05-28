# Debate e Colaboração Multi-Agente

> Du et al. (ICML 2024, "Society of Minds") rodam N instâncias de modelo que propõem respostas independentemente, depois fazem critique iterativo umas das outras ao longo de R rodadas pra convergir. Melhora factualidade, seguimento de regras, raciocínio. Topologia esparsa ganha de full mesh no custo de tokens.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 14 · 12 (Workflow Patterns), Fase 14 · 05 (Self-Refine e CRITIC)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Explicar o protocolo de debate: N proponentes, R rodadas, convergência numa resposta compartilhada.
- Descrever por que o debate melhora factualidade, seguimento de regras e raciocínio.
- Explicar topologia esparsa: nem todo debatente precisa ver todos os outros.
- Implementar um debate stdlib sobre um LLM roteado com variantes full-mesh e esparsa; medir custo de tokens vs acurácia.

## O Problema

Self-Refine (Aula 05) é um modelo que critica a si mesmo — risco de groupthink. CRITIC (Aula 05) ancora o critique em ferramentas externas — nem sempre disponíveis. Debate introduz um terceiro modo: múltiplas instâncias, cross-critique, convergência por discordância.

## O Conceito

### Society of Minds (Du et al., ICML 2024)

- N instâncias de modelo propõem respostas independentemente pra mesma pergunta.
- Ao longo de R rodadas, cada modelo lê as propostas dos outros e as critica.
- Modelos atualizam suas respostas baseado nos critiques.
- Após R rodadas, retornam a resposta convergente.

Experimentos originais usaram N=3, R=2 por custo. Acurácia melhora com mais agentes e mais rodadas em problemas difíceis (MMLU, GSM8K, Chess Move Validity, geração de biografia).

Combinações cross-model batem debates single-model: ChatGPT + Bard juntos > qualquer um sozinho.

### Topologia esparsa

"Improving Multi-Agent Debate with Sparse Communication Topology" (arXiv:2406.11776, 2024-2025) mostrou que debate full-mesh nem sempre é ótimo. Topologias esparsas (star, ring, hub-and-spoke) podem igualar acurácia com menor custo de tokens. Cada debatente vê só um subconjunto de peers.

Implicações:

- Full mesh N=5, R=3 = 5 × 3 = 15 propostas, cada uma lendo 4 peers = 60 ops de critique.
- Star N=5, R=3 (um hub + 4 spokes) = 15 propostas, spokes leem só o hub = 12 ops de critique.

### Quando o debate ajuda

- **Factualidade.** N propostas independentes, cross-check reduz alucinação.
- **Seguimento de regras.** Validez de jogada de xadrez — um modelo erra uma regra, outros captam.
- **Raciocínio aberto.** Múltiplas formulações convergem pra resposta certa.

### Quando o debate prejudica

- **UX sensível a latência.** N × R rodadas serializadas é latência que talvez não tenha.
- **Escala sensível a custo.** N × R tokens por pergunta.
- **Consultas factuais simples.** Uma consulta é mais barata que cinco debates.

### Instantiações práticas de 2026

- **Anthropic orchestrator-workers** (Aula 12) — uma variante de debate com etapa de síntese.
- **LangGraph supervisor** (Aula 13) — roteador central + agentes eespecificaçãoialistas podem implementar debate como um nó.
- **OpenAI Agents SDK** (Aula 16) — agentes fazem handoff pra lá e pra cá pra critique iterativo.
- **Evals multi-agente** — combine debate + evaluator-optimizer pra sinal de eval.

### Onde esse pattern dá errado

- **Colapso de convergência.** Todos os agentes convergem na primeira resposta errada. Mitigue com rodadas obrigatórias de discordância.
- **Falha de hub.** Numa topologia star, um hub ruim corrompe todos. Rotacione ou use múltiplos hubs.
- **Homogeneização de prompt.** Todos os agentes usam o mesmo prompt; produzem as mesmas respostas. Use prompts e/ou modelos diversos.

## Construa

`code/main.py` implementa debate em stdlib:

- Classe `Debater` (LLM roteado com deriva de opinião por debatente).
- Runners `FullMeshDebate` e `SparseDebate`.
- Três perguntas: uma factual, uma baseada em regra, uma de raciocínio.
- Métricas: resposta convergente, rodadas até convergência, total de ops de critique.

Execute:

```
python3 code/main.py
```

Saída: acurácia e custo por protocolo; esparsa empata com full mesh em 2/3 perguntas com custo menor.

## Use

- **Anthropic orchestrator-workers** pra debates simples de 2-3 workers.
- **LangGraph** pra debate multi-rodada stateful com checkpointing.
- **Custom** pra pesquisa ou garantias eespecificaçãoializadas de correção.

## Entregue

`outputs/skill-debate.md` monta um scaffold de debate multi-agente com topologia configurável, N, R e uma regra de convergência.

## Exercícios

1. Implemente uma regra de "discordância forçada": na rodada 1, cada debatente deve produzir uma proposta distinta. Meça o efeito na velocidade de convergência.
2. Adicione uma agregação ponderada por confiança: debatentes retornam (resposta, confiança); agregador pondera por confiança. Ajuda?
3. Troque um "agente" por um LLM roteado diferente com opiniões diferentes. A heterogeneidade melhora acurácia?
4. Meça o custo de tokens pra full mesh vs esparsa nas suas 3 perguntas. Plote custo vs acurácia.
5. Leia o paper do Society of Minds. Porte seu toy pra N=5, R=3. O que quebra? O que melhora?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Debate | "Critique multi-agente" | N proponentes, R rodadas de cross-critique, convergência |
| Full mesh | "Todo mundo lê todo mundo" | Cada debatente lê cada peer toda rodada |
| Topologia esparsa | "Visão limitada de peers" | Debatentes leem só um subconjunto de peers |
| Hub-and-spoke | "Topologia star" | Um debatente central, N-1 spokes leem só o hub |
| Convergência | "Acordo" | Debatentes convergem numa resposta compartilhada |
| Society of Minds | "Paper de debate do Du et al." | Método de debate multi-agente do ICML 2024 |

## Leitura Complementar

- [Du et al., Society of Minds (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) — debate multi-agente canônico
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) — resultados de topologia esparsa
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) — orchestrator-workers como variante de debate
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) — contraparte de auto-critique single-model
