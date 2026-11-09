# Sociedade da Mente e debate multi-agente

> A premissa de Minsky de 1986  inteligência é uma sociedade de especialistas  é redescoberta a cada década. Em 2023 Du et al. transformou-a em um algoritmo concreto: múltiplas instâncias de LLM propõem respostas, lêem as respostas umas das outras, criticam e atualizam.**multiple agents**E ...**multiple rounds**A sociedade supera o monólogo de um único agente; a troca de várias rondas supera a votação de um só disparo.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model)
**Time:** ~60 minutes

## Problemas

A autoconsistência  amostra um modelo muitas vezes e tome a resposta da maioria  é a melhor raciocínio mais barata que você pode aproveitar. Funciona, mas satura rapidamente. Você pode dobrar suas amostras e não ver outro salto significativo.

O debate quebra a saturação. Em vez de N amostras independentes de um modelo, N agentes ler o raciocínio e revisão uns dos outros. A correlação entre amostras cai (eles não são mais i.i.d.), e o ponto de convergência é muitas vezes correto onde a votação i.i.d. foi com certeza errado.

## Conceptos

### O algoritmo Du et al. 2023

A partir de arXiv:2305.14325 (ICML 2024):

1. Cada um dos agentes N produz uma resposta inicial à pergunta.
2. Para a rodada r = 2..R: cada agente é mostrado as respostas da rodada r-1 dos outros agentes e perguntado "considerando estes, dê sua resposta atualizada".
3. Após as rodadas R, a maioria vota as respostas finais.

Os testes em papel sobre MMLU, GSM8K, biografias, MATH e referências de factualidade.

### Dois botões independentes

Ablações do mesmo documento:

- **Agent count alone**O Parlamento Europeu e o Conselho aprovaram o relatório de resolução.
- **Round count alone**(1 agente que vê o seu próprio raciocínio prévio) dificilmente ajuda a fraqueza conhecida da reflexão.
- **Both together**O intercâmbio entre agentes múltiplos impulsiona o ganho.

### Por que funciona

Dois mecanismos:

1. **Exposure to disagreement.**Quando um agente vê a cadeia de raciocínio de outro agente com uma conclusão diferente, ele tem que justificar ou atualizar. De qualquer forma, o contexto para o rondo r + 1 é mais rico do que o rondo r.
2. **Correlated error reduction.**Em auto-consistência, todas as amostras vêm do mesmo modelo, então os erros correlacionam  você média em uma resposta confidentemente errada. Diferentes modelos ou sementes diferentes descorrelam. Diferentes *visões debatidas* descorrelam ainda mais.

### O debate é heterogêneo

A A-HMAD e os acompanhamentos relacionados utilizam *modelos base diferentes* para diferentes agentes.

Desvantagem: um modelo fraco participando de um debate pode arrastar o consenso para a sua resposta errada (ver "Devemos estar indo LOCO?", arXiv:2311.17371).

### NLSOM  a extensão 129-agente

Zhuge et al. ("Mindstorms in Natural Language-Based Societies of Mind", arXiv:2305.17066) escalaram essa ideia para 129-sociedades membros.

### Modos de falha

- **Sycophancy cascade.**Todos os agentes se afastam para o agente que parece mais confiante. O debate desmorona com a voz mais alta.
- **Topic drift.**Os debates em muitas rodadas se desviam da pergunta original.
- **Compute blowup.**N agentes × R rodadas = N·R LLM chamadas, cada um com um contexto que cresce. Um debate de 5 agentes, 5 rodadas é de 25 chamadas em contexto crescente.

```figure
multi-agent-debate
```

## Construí-lo

`code/main.py`O programa de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste de teste

A demonstração mostra dois efeitos-chave:

- Uma única rodada de troca move os agentes mais perto da resposta correta.
- As rondas extras anteriores à segunda ronda mostram retornos decrescentes (combatentes com o plato de Du et al).

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

## Usá-lo

`outputs/skill-debate-configurator.md`Configura um debate para uma nova tarefa: número de agentes, número de rodadas, heterogeneidade (modelo igual versus misturado), atribuição de funções (simétrica versus oponente).

## Envia-o

Se você enviar debate:

- **Cap rounds at 3.**Du et al. mostram que 3 rodadas capturam a maior parte do ganho.
- **Cap agents at 5.**Além do 5, o conteúdo e o custo dominam.
- **Heterogeneous by default.**Pelo menos dois modelos base diferentes na piscina.
- **Adversarial slot.**Um agente fez com que discordasse, não importa.
- **Log every round.**Os sistemas de debate que escondem rodadas intermediárias não podem ser depurados ou auditados.

## Exercícios

1. Corra .`code/main.py`, então, definir a contagem de rodadas para 5 e observar retornos decrescentes. em que rodada a convergência adicional para?
2. A Comissão propõe que a Comissão adopte um novo regulamento que, em conformidade com o artigo 107.o, n.o 1, do Tratado, estabeleça um regime de harmonização das legislações nacionais.
3. Plot (impressão) o resultado do acordo por rodada (fracção de agentes na resposta da maioria).
4. Leia as ablações da Seção 4. Replica o resultado "apenas agentes" vs. "apenas rondas" vs. "ambos" usando este código.
5. Leia "Devemos estar indo LOCO?" (arXiv:2311.17371) e enumere duas variantes de debate além do round-robin  por exemplo, liderado por juízes, cadeia de debate, adversária.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Society of Mind | "Minsky's idea" | Intelligence as interacting specialists; 1986 framing now operationalized via LLM debate. |
| Multi-agent debate | "Agents argue" | N agents propose, critique each other, revise over R rounds, majority-vote. |
| Consensus | "They agree" | Not epistemic truth — just fraction-on-majority-answer. Can be confidently wrong. |
| Rounds | "Exchange steps" | One round = each agent reads the others and updates once. |
| Heterogeneous debate | "Mix model families" | Using different base models to decorrelate errors. |
| Sycophancy cascade | "Everyone agrees with the loud one" | Debate failure where agents defer to the most confident agent regardless of correctness. |
| NLSOM | "129-agent society" | Natural-language society of mind; Zhuge et al.'s scaled version. |
| Correlated error | "Same model, same bug" | Why self-consistency saturates; debate across different views decorrelates. |

## Mais leitura

- [Du et al. — Improving Factuality and Reasoning in Language Models through Multiagent Debate](https://arxiv.org/abs/2305.14325) o papel de referência, ICML 2024
- [Zhuge et al. — Mindstorms in Natural Language-Based Societies of Mind](https://arxiv.org/abs/2305.17066) 129-agente NLSOM
- [Should we be going MAD? A Look at Multi-Agent Debate Strategies for LLMs](https://arxiv.org/abs/2311.17371) Referências de debate
- [Debate project page](https://composable-models.github.io/llm_debate/) Código, demonstrações e detalhes de ablação de Du et al.
