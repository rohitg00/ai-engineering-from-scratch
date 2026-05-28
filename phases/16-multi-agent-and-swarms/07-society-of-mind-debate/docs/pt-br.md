# Sociedade da Mente e Debate Multi-Agent

> A premissa de 1986 de Minsky — inteligência é uma sociedade de especialistas — é redescoberta a cada década. Em 2023 Du et al. a transformaram num algoritmo concreto: múltiplas instâncias de LLM propõem respostas, leem as respostas uma das outras, criticam e atualizam. Em N rodadas convergem num consenso que supera zero-shot CoT e reflexão em seis tarefas de raciocínio e factualidade. Dois achados importam: tanto **múltiplos agents** quanto **múltiplas rodadas** contribuem independentemente. A sociedade supera um monólogo de agent único; a troca multi-rodada supera votação de uma vez.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 04 (Modelo Primitivo)
**Tempo:** ~60 minutos

## Problema

Consistência de si mesmo — amostrar um modelo muitas vezes e pegar a resposta da maioria — é a melhoria de raciocínio mais barata que você pode encaixar. Funciona, mas satura rápido. Você pode duplicar suas amostras e não ver outro salto significativo.

Debate quebra a saturação. Em vez de N amostras independentes de um modelo, N agents leem o raciocínio uns dos outros e revisam. A correlação entre amostras cai (elas não são mais i.i.d.), e o ponto de convergência é frequentemente correto onde a votação i.i.d. estava confiantemente errada.

## Conceito

### O algoritmo de Du et al. 2023

De arXiv:2305.14325 (ICML 2024):

1. Cada um dos N agents produz uma resposta inicial pra pergunta.
2. Pra rodada r = 2..R: cada agent é mostrado as respostas dos outros agents da rodada r-1 e pedido "considerando essas, dê sua resposta atualizada."
3. Após R rodadas, votação por maioria nas respostas finais.

O paper testa em MMLU, GSM8K, biografias, MATH e benchmarks de factualidade. Debate consistentemente supera CoT e Self-Reflection.

### Duas alavancas independentes

Ablações do mesmo paper:

- **Contagem de agents sozinha** (1 rodada, votação por maioria de N) supera single-agent na maioria das tarefas, mas estagna.
- **Contagem de rodadas sozinha** (1 agent vendo seu próprio raciocínio anterior) quase não ajuda — fraqueza conhecida da reflexão.
- **As duas juntas** produzem os grandes saltos. A troca multi-rodada entre múltiplos agents impulsiona o ganho.

### Por que funciona

Dois mecanismos:

1. **Exposição à discordância.** Quando um agent vê a cadeia de raciocínio de outro agent com uma conclusão diferente, ele tem que justificar ou atualizar. De qualquer forma, o contexto pra rodada r+1 é mais rico que o da rodada r.
2. **Redução de erros correlacionados.** Em consistência de si mesmo, todas as amostras vêm do mesmo modelo, então os erros se correlacionam — você media pra uma resposta confiantemente errada. Modelos diferentes ou seeds diferentes descorrelacionam. *Visões debatidas* diferentes descorrelacionam ainda mais.

### Debate heterogêneo

A-HMAD e trabalhos relacionados usam *modelos base diferentes* pra diferentes agents. Llama + Claude + GPT debatendo reduz o colapso por monocultura (Lição 26) porque os erros correlacionados de uma família de modelos não são compartilhados pelas outras.

Desvantagem: um modelo fraco participando de um debate pode arrastar o consenso pra sua resposta errada (veja "Should we be going MAD?", arXiv:22311.17371).

### NLSOM — a extensão de 129 agents

Zhuge et al. ("Mindstorms in Natural Language-Based Societies of Mind," arXiv:2305.17066) escalaran essa ideia pra sociedades de 129 membros. O resultado: especialização e auto-organização emergem com escala, e o sistema supera single-agent em tarefas como resposta a perguntas visuais.

### Modos de falha

- **Cascata de subserviência.** Todos os agents cedem pro agent que soa mais confiante. O debate colapsa pra voz mais alta. Pedir papéis adversariais ("um agent deve argumentar a posição contrária") ajuda.
- **Deriva de tópico.** Debates por muitas rodadas derivam da pergunta original. Mitigação: reinjete a pergunta a cada rodada.
- **Explosão de compute.** N agents × R rodadas = N·R chamadas LLM, cada uma com contexto que cresce. Um debate de 5 agents, 5 rodadas são 25 chamadas com contexto crescente. Custo por pergunta pode exceder 10× uma chamada CoT.

## Construa

`code/main.py` roda um debate de 3 agents × 3 rodadas numa pergunta de matemática onde cada agent começa com uma resposta diferente (possivelmente errada). Agents são scriptados — cada um "atualiza" fazendo média das respostas dos vizinhos ponderadas por uma confiança scriptada. Convergência é visível no log rodada a rodada.

A demo mostra dois efeitos chave:

- Uma rodada única de troca aproxima agents da resposta correta.
- Rodadas extras além da rodada 2 mostram retornos decrescentes (combina com o platô de Du et al.):

Execute:

```
python3 code/main.py
```

## Use

`outputs/skill-debate-configurator.md` configura um debate pra uma nova tarefa: número de agents, número de rodadas, heterogeneidade (mesmo modelo vs misturado), atribuição de papéis (simétrico vs um adversarial). Também estima o custo de tokens antes de rodar.

## Entregue

Se você usar debate:

- **Limite rodadas a 3.** Du et al. mostram que 3 rodadas capturam a maior parte do ganho. Mais é custo, não qualidade.
- **Limite agents a 5.** Além de 5, expansão de contexto e custo dominam.
- **Heterogêneo por padrão.** Pelo menos dois modelos base diferentes no pool.
- **Slot adversarial.** Um agent promptado pra discordar sempre. Quebra subserviência.
- **Logue cada rodada.** Sistemas de debate que escondem rodadas intermediárias não podem ser debugados ou auditados.

## Exercícios

1. Execute `code/main.py`, depois defina contagem de rodadas pra 5 e observe os retornos decrescentes. Em qual rodada a convergência adicional para?
2. Adicione um quarto agent com papel adversarial: sempre discorda da maioria atual. Isso quebra ou melhora a convergência?
3. Plote (imprima) o score de concordância por rodada (fração de agents na resposta da maioria). Quando ele atinge 1.0 e isso é equivalente a "correto"?
4. Leia as ablações da Seção 4 de Du et al. Replique o resultado "só agents" vs "só rodadas" vs "ambos" usando este código.
5. Leia "Should we be going MAD?" (arXiv:2311.17371) e liste duas variantes de debate além de round-robin — ex.: liderado por juiz, cadeia-de-debate, adversarial.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Sociedade da Mente | "A ideia de Minsky" | Inteligência como especialistas interagindo; enquadramento de 1986 agora operationalizado via debate LLM. |
| Debate multi-agent | "Agents discutem" | N agents propõem, criticam uns aos outros, revisam em R rodadas, votação por maioria. |
| Consenso | "Eles concordam" | Não verdade epistêmica — só fração-na-resposta-da-maioria. Pode ser confiantemente errado. |
| Rodadas | "Passos de troca" | Uma rodada = cada agent lê os outros e atualiza uma vez. |
| Debate heterogêneo | "Misturar famílias de modelos" | Usar modelos base diferentes pra descorrelacionar erros. |
| Cascata de subserviência | "Todos concordam com o barulhento" | Falha de debate onde agents cedem pro agent mais confiante independente de correção. |
| NLSOM | "Sociedade de 129 agents" | Sociedade da mente em linguagem natural; versão escalada de Zhuge et al. |
| Erro correlacionado | "Mesmo modelo, mesmo bug" | Por que consistência de si mesmo satura; debate entre visões diferentes descorrelaciona. |

## Leitura Complementar

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) — o paper de referência, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) — NLSOM de 129 agents
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) — benchmarka variantes de debate
- [Página do projeto Debate](https://composable-models.github.io/llm_debate/) — código, demos e detalhes de ablação de Du et al.
