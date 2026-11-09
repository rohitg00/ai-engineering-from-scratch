# Debate e colaboração entre vários agentes

> Du et al. (ICML 2024, "Sociedade de Mentes") executam instâncias de modelo N que propõem respostas de forma independente, depois se criticam iterativamente em torno de rodadas R para convergir. Melhora a factualidade, seguimento de regras, raciocínio.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 12 (Workflow Patterns), Phase 14 · 05 (Self-Refine and CRITIC)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Explicar o protocolo de debate: N propostas, R rodadas, convergem numa resposta compartilhada.
- Descreva por que o debate melhora a faculdade, a regra e o raciocínio.
- Explique a topologia escassa: nem todos os debatedores precisam de se ver.
- Implementar um debate sobre um LLM com roteiro com variantes completas e escassas; medir o custo do token versus precisão.

## O problema

Auto-refinamento (Lessão 05) é um modelo que se critica  risco de grupo pensamento. CRITIC (Lessão 05) baseia a crítica em ferramentas externas  nem sempre disponíveis.

## O conceito

### Sociedade das Mentes (Du et al., ICML 2024)

- N exemplos modelo propõem independentemente respostas à mesma pergunta.
- Durante as rodadas R, cada modelo lê as propostas dos outros e as critica.
- Os modelos atualizam as suas respostas com base nas críticas.
- Após as rodadas R, devolva a resposta convergente.

Os experimentos originais usaram N=3, R=2 devido ao custo. A precisão melhora com mais agentes e mais rodadas em problemas difíceis (MMLU, GSM8K, Valididade de Movimento de Xadrez, geração de biografia).

As combinações de modelos cruzados superam os debates de modelos únicos: ChatGPT + Bard juntos > ou sozinhos.

### Topologia de escassez

"Melhorar o debate multi-agente com a topologia de comunicação Sparse" (arXiv:2406.11776, 2024-2025) mostrou que o debate de rede completa nem sempre é o ideal. As topologias de Sparse (estrela, anel, hub-and-spoke) podem corresponder à precisão a um menor custo de token. Cada debatedor vê apenas um subconjunto de pares.

Implicações:

- N=5, R=3 = 5 × 3 = 15 propostas, cada leitura de 4 pares = 60 críticas.
- Estrela N=5, R=3 (um hub + 4 vozes) = 15 propostas, vozes ler apenas o hub = 12 opções de crítica.

### Quando o debate ajuda

- **Factuality.**N propostas independentes, o controlo cruzado reduz as alucinações.
- **Rule-following.**Validade de movimento de xadrez  Um modelo perde uma regra, outros pegam-na.
- **Open-ended reasoning.**Múltiples enquadramentos limitam-se à resposta certa.

### Quando o debate dói

- **Latency-sensitive UX.**As rodadas de série N × R são latência que talvez não tenha.
- **Cost-sensitive scale.**Tokens N × R por pergunta.
- **Simple factual lookups.**Uma pesquisa é mais barata que cinco debates.

### 2026 instâncias práticas

- **Anthropic orchestrator-workers**(Lessão 12)  uma variante do debate com um passo de síntese.
- **LangGraph supervisor**(Lessão 13)  Roteador central + agentes especializados podem implementar o debate como um nó.
- **OpenAI Agents SDK**(Lessão 16)  Agentes de transferência para frente e para trás para a crítica iterativa.
- **Multi-agent evals** debate em pares + avaliador-optimizador para o sinal de avaliação.

### Onde este padrão vai mal

- **Convergence collapse.**Todos os agentes convergem na primeira resposta errada, e reduzem a falta de discordância.
- **Hub failure.**Em uma topologia estelar, um núcleo ruim corrompe todos.
- **Prompt homogenization.**Todos os agentes usam o mesmo prompt; produzem as mesmas respostas.

```figure
debate-converge
```

## Construí-lo

`code/main.py`Implementa o debate sobre o STDlib:

- `Debater`A classe (Mestrado em Direito Jurídico com derivação de opinião por debatedor).
- `FullMeshDebate`E ...`SparseDebate`Corredores.
- Três perguntas: uma factual, uma baseada em regras, uma raciocínio.
- Metricas: resposta convergente, rodadas para convergência, operações de crítica total.

- É o que é ?

```
python3 code/main.py
npx tsx code/main.ts
```

Resultados: precisão e custo por protocolo; correspondências escassas em 2/3 de perguntas a um custo menor.

## Usá-lo

- **Anthropic orchestrator-workers**Para debates simples de dois a três trabalhadores.
- **LangGraph**O Conselho Europeu de Ministros dos Negócios Estrangeiros, em nome da Comissão, tem de apresentar um relatório sobre a proposta de directiva.
- **Custom**para investigação ou garantias de correcção especializadas.

## Envia-o

`outputs/skill-debate.md`Estabelece um debate multi-agente com topologia configurável, N, R e uma regra de convergência.

## Exercícios

1. Implementar uma regra de "desacordo forçado": na primeira rodada, cada debatente deve apresentar uma proposta distinta.
2. Adicionar uma agregação ponderada pela confiança: os debatedores retornam (resposta, confiança); o agregador pesa pela confiança.
3. Troca um "agente" por um LLM diferente com diferentes opiniões.
4. Mita o custo do token para rede completa vs. escassa em suas 3 perguntas.
5. Leia o artigo da Sociedade das Mentes.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Debate | "Multi-agent critique" | N proposers, R rounds of cross-critique, converge |
| Full mesh | "Everyone reads everyone" | Every debater reads every peer each round |
| Sparse topology | "Limited peer view" | Debaters read only a subset of peers |
| Hub-and-spoke | "Star topology" | One central debater, N-1 spokes read only the hub |
| Convergence | "Agreement" | Debaters converge on a shared answer |
| Society of Minds | "Du et al. debate paper" | ICML 2024 multi-agent debate method |

## Mais leitura

- [Du et al., Improving Factuality and Reasoning in Language Models through Multiagent Debate (arXiv:2305.14325)](https://arxiv.org/abs/2305.14325) debate canônico multi-agente
- [Sparse Communication Topology (arXiv:2406.11776)](https://arxiv.org/abs/2406.11776) resultados de topologia escassos
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) trabalhadores-orquestrais como variante de debate
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) Contralor de autocrítica de modelo único
