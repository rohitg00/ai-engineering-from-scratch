# Negociação e Barganha

> Agents negociam recursos, preços, alocação de tarefas e termos. O conjunto de benchmarks de 2026 é claro: NegotiationArena (arXiv:2402.05863) mostra que LLMs podem melhorar payoffs ~20% via manipulação de persona ("desespero"); "Measuring Bargaining Abilities" (arXiv:2402.15813) mostra que comprar é mais difícil que vender e escala não ajuda — o **OG-Narrator** deles (gerador de ofertas determinístico + narrador LLM) elevou a taxa de fechamento de 26.67% pra 88.88%; a Large-Scale Autonomous Negotiation Competition (arXiv:2503.06416) rodou ~180k negociações e descobriu que agents que **escondem raciocínio** (chain-of-thought-concealing) vencem escondendo o raciocínio dos counterpartes; Bhattacharya et al. 2025 nos métricas do Harvard Negotiation Project classificou o Llama-3 como mais efetivo, Claude-3 agressivo, GPT-4 mais justo. Esta lição implementa o Contract Net Protocol (o ancestral FIPA, Lição 02), conecta um buyer/seller estilo LLM, roda uma decomição estilo OG-Narrator, e mede como a taxa de fechamento muda com cada escolha estrutural.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 02 (FIPA-ACL Heritage), Fase 16 · 09 (Parallel Swarm Networks)
**Tempo:** ~75 minutos

## Problema

Dois agents precisam combinar num preço. Deixados com prompts de linguagem pura, LLMs de 2024-2026 fecham negócios em taxas surpreendentemente baixas (~27% em barganhas parametrizadas no arXiv:2402.15813). Escala não resolve: GPT-4 não é estruturalmente melhor em barganha que GPT-3.5; é melhor na *linguagem* da barganha.

A questão raiz é que LLMs misturam dois trabalhos — decidir a oferta e narrar a oferta. O OG-Narrator separou esses: um gerador de ofertas determinístico calcula movimentos numéricos; o LLM só narra. A taxa de fechamento pula pra ~89%.

Isso espelha um achado clássico multi-agent: desacoplar o mecanismo da camada de comunicação vence. Contract Net Protocol (FIPA, 1996; Smith, 1980) é o mecanismo de referência pra mercado de tarefas. Pluga um LLM no slot de narrativa e você tem um mercado de tarefas moderno powered por LLM.

## Conceito

### Contract Net, num parágrafo

Contract Net Protocol de Smith de 1980: um **manager** transmite um **call for proposals (cfp)**; **bidders** respondem com mensagens **propose** contendo suas ofertas; o manager escolhe um vencedor e envia **accept-proposal** pro vencedor e **reject-proposal** pros perdedores. O vencedor executa o trabalho. Mensagem opcional: **refuse** (bidder recusa proposta). A FIPA codificou isso como protocolo de interação `fipa-contract-net`.

### Por que o OG-Narrator vence

"Measuring Bargaining Abilities of Language Models" (arXiv:2402.15813) observou que:

- LLMs frequentemente quebram as regras de barganha (oferecem preços sem sentido, ignoram a ZOPA do outro lado).
- Ancoram mal (aceitam primeiras ofertas ruins; contra-ofertam em valores simbólicos em vez de estratégicos).
- Escala sozinha não resolve isso. Modelos maiores produzem linguagem mais plausível com erro estratégico similar.

A decomição OG-Narrator:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

O gerador de ofertas é uma estratégia clássica de negociação: um modelo de barganha Rubinstein, uma estratégia Zeuthen, ou um simples tit-for-tat sobre preço. O LLM narra. A mensagem contém o preço determinístico e o enquadramento em linguagem natural.

A taxa de fechamento pula porque:
- Preços ficam na zona de barganha.
- Âncoras são estratégicas, não emocionais.
- O LLM faz o que é bom: escrever.

### Achados do NegotiationArena

arXiv:2402.05863 fornece o benchmark canônico. Achados principais:

- LLMs podem melhorar payoffs ~20% adotando personas ("estou desesperado pra vender isso até sexta") — manipulação de persona é uma tática real.
- Agents justos/cooperativos são explorados por adversariais; defesa requer contra-postura explícita.
- Emparelhamentos simétricos convergem pra resultados desiguais em ~40% dos cenários do benchmark.

Isso não é "LLMs são ruins negociando." É "LLMs negociam muito parecido com humanos, incluindo as partes exploráveis."

### Ocultação de chain-of-thought

A Large-Scale Autonomous Negotiation Competition (arXiv:2503.06416) rodou ~180k negociações com muitas estratégias de LLM. Vencedores ocultaram seu raciocínio dos counterpartes:

- Se um agent imprime "só vou até $75; meu preço de reserva é $70" num scratchpad visível publicamente, o oponente lê.
- Vencedores computam a privatamente; o canal de saída contém apenas a oferta e a narração mínima necessária.

Isso é um eco de 2026 da teoria de jogos clássica (Aumann 1976 sobre racionalidade e informação): revelar sua valoração privada custa payoff. LLMs não intuitam isso e digitam feliz suas reservas em traces de raciocínio que se tornam visíveis pro counterpart.

Takeaway de engenharia: separe o contexto de scratchpad privado do contexto de mensagem pública. Opcional.

### Bhattacharya et al. 2025 — rankings de modelos

Nas métricas do Harvard Negotiation Project (negociação baseada em princípios, respeito a BATNA, reciprocidade de interesse):

- **Llama-3** foi o mais efetivo pra fechar barganhas (taxa de fechamento + payoff).
- **Claude-3** foi o negociador mais agressivo (âncoras altas, concessões tardias).
- **GPT-4** foi o mais justo (menor variância de payoff emparelhamentos).

Isso é um snapshot de 2025. O ponto não é qual modelo vence em abril de 2026 — é que diferentes modelos base têm estilos de negociação persistentes. Ensambles heterogêneos (Lição 15) incluem isso como fonte de diversidade.

### Alocação de tarefas via Contract Net + LLM

A reutilização moderna do Contract Net pra multi-agent com LLM:

1. O agent manager decompõe uma tarefa em unidades.
2. Transmite `cfp` com descrição da tarefa pra worker agents.
3. Cada worker retorna uma oferta: `(preço, eta, confiança)` onde preço pode ser tokens, unidades de compute ou dólares.
4. Manager escolhe vencedores (único ou múltiplos, dependendo da tarefa) e concede.
5. Workers rejeitados ficam livres pra bid em outras tarefas.

Isso escala bem além de 100 workers porque a coordenação é broadcast-e-responder, não chat síncrono. Usado em produção: padrões de orquestração do Microsoft Agent Framework, algumas implementações LangGraph.

### LLM-Stakeholders Interactive Negotiation

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) introduz jogos pontuáveis multi-party com **pontuações secretas** e **limiares de aceitação mínima**. Cada stakeholder tem utilidades privadas; o LLM deve inferi-las das mensagens. Essa é a generalização de barganha bilateral pra formação de coalizão N-party. Relevante pra mercados de tarefas em produção com capacidades heterogêneas de workers.

### A regra narrativa-vs-mecanismo

Em todos os benchmarks de negociação de 2024-2026, a regra de engenharia consistente é:

> Deixe o LLM narrar. Não deixe o LLM calcular a oferta.

Se a oferta precisa ser um número (preço, ETA, quantidade), gere-o deterministicamente do estado de negociação e deixe o LLM produzir o enquadramento. Se a oferta precisa ser uma estrutura de proposta (decomposição de tarefa, atribuição de papel), deixe o LLM rascunhar, mas valide contra um schema e faça check de restrição antes de enviar.

## Construa

`code/main.py` implementa:

- `ContractNetManager`, `ContractNetTask`, `Bid` — manager + bidders, transmite cfp, coleta propostas, concede.
- `og_narrator_bargain(state, rng)` — buyer OG-Narrator: concessão determinística estilo Zeuthen em direção ao ponto médio.
- `seller_response(state, rng)` — política de contra-oferta determinística do vendedor (a verdade estrutural pra ambos os estilos).
- `naive_llm_bargain(state, rng)` — simula um barganhador all-LLM: escolhe preços com alta variância, frequentemente fora da ZOPA.
- Medição: taxa de fechamento em 1000 trials com preços de reserva sorteados por trial.

Execute:

```
python3 code/main.py
```

Saída esperada: taxa de fechamento naive-LLM ~65-75%; taxa de fechamento OG-Narrator ~85-95%; a diferença de 15-25 pontos é a vantagem estrutural de decompor geração-de-oferta de narração. Mais um exemplo de alocação de mercado de tarefas Contract Net com três bidders e uma tarefa.

## Use

`outputs/skill-bargainer-designer.md` desenha um protocolo de barganha: quem gera ofertas (determinístico ou LLM), quem narra, como scratchpads privados se separam de mensagens públicas, e como a taxa de fechamento é monitorada.

## Deploy

Checklist de barganha em produção:

- **Scratchpad separado.** Estado privado nunca alcança o contexto do counterpart. Isso é inegociável.
- **Geração determinística de ofertas.** Preços, quantidades, ETAs: compute, não faça prompt.
- **Valide todas as ofertas recebidas** contra um schema. Rejeite ofertas fora da ZOPA na fronteira do protocolo.
- **Limite rodadas.** 3-5 rodadas no máximo; escale pra mediador em deadlock.
- **Meça taxa de fechamento e variância de payoff** continuamente. Uma taxa de fechamento caindo é um sintoma — frequentemente drift de prompt ou ataque do lado do counterpart.
- **Registre todas as propostas rejeitadas** com a razão determinística. Pra managers do Contract Net, bidders perdedores precisam entender o porquê.

## Exercícios

1. Execute `code/main.py`. Confirme que o OG-Narrator vence o naive-LLM na taxa de fechamento. Quanto?
2. Implemente **melhoria de payoff baseada em persona** (arXiv:2402.05863) — o buyer adota uma persona "desesperado pra comprar essa semana" só na narrativa, gerador de ofertas inalterado. A taxa de fechamento ou payoff muda?
3. Implemente **ocultação de chain-of-thought**: mantenha uma string de scratchpad privada que não é passada pro counterpart. O que acontece se você vazá-la acidentalmente (simule trocando os canais)?
4. Estenda Contract Net pra leilão N-bidder com preço de reserva. Quando todos os bids excedem a reserva, como o manager decide entre menor preço e maior qualidade? Qual regra de concessão você escolhe e por quê?
5. Leia Bhattacharya et al. 2025 nas métricas do Harvard Negotiation Project. Implemente dois barganhadores com estilos diferentes (agressivo vs justo). Meça variância de payoff em emparelhamentos simétricos e assimétricos.

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| Contract Net | "Mercado de tarefas" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. O mercado de tarefas canônico. |
| ZOPA | "Zona de possível acordo" | Sobreposição entre máximo do comprador e mínimo do vendedor. Ofertas fora dela não fecham. |
| BATNA | "Melhor alternativa a um acordo negociado" | Seu fallback se essa negociação falhar. Define seu preço de reserva. |
| OG-Narrator | "Gerador de ofertas + narrador" | Decomição: oferta determinística, narração LLM. |
| Estratégia Zeuthen | "Concessão minimizadora de risco" | Gerador de ofertas clássico que concede baseado em limites de risco. |
| Barganha Rubinstein | "Equilíbrio de ofertas alternadas" | Modelo teórico de jogos pra barganha de horizonte infinito com desconto. |
| Ocultação de CoT | "Esconda seu raciocínio" | Vencedores em arXiv:2503.06416 mantinham scratchpads privados; canal público mostra só a oferta. |
| Manipulação de persona | "Postura emocional" | arXiv:2402.05863: ~20% de ganho de payoff com personas de desespero/urgência. |

## Leitura Complementar

- [NegotiationArena](https://arxiv.org/abs/2402.05863) — o benchmark; achados de manipulação de persona e exploração
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) — OG-Narrator e o resultado de comprar-mais-difícil-que-vender
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) — ~180k negociações; ocultação de chain-of-thought vence
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) — jogos pontuáveis multi-party com utilidades secretas
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) — o mecanismo clássico, IEEE Transactions on Computers
