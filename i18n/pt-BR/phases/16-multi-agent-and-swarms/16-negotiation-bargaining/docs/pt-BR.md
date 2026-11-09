# Negociação e negociação

> Os agentes negociam recursos, preços, atribuições de tarefas e termos. O conjunto de referência de 2026 é claro: NegotiationArena (arXiv:2402.05863) mostra que os LLM podem melhorar os saldos ~20% através da manipulação de persona ("desespero"); "Medir as habilidades de negociação" (arXiv:2402.15813) mostra que o comprador é mais difícil do que o vendedor e a escala não ajuda  seus **OG-Narrator**(Generador de Ofertas Deterministas + Narrador de LLM) empurrou a taxa de negócios de 26,67% para 88,88%; a Grande Concurso de Negociação Autônoma (arXiv:2503.06416) realizou cerca de 180 mil negociações e descobriu que**chain-of-thought-concealing**Bhattacharya et al. 2025 em Harvard Negotiation Project metrics classificou Llama-3 mais eficaz, Claude-3 agressivo, GPT-4 mais justo. Esta lição implementa o Protocolo de Contrato Net (o ancestral da FIPA, lição 02), funsiona um comprador/vendedor de estilo LLM, realiza uma decomposição de estilo OG-Narrador e mede como a taxa de negócios muda com cada escolha estrutural.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problemas

Os dois agentes precisam concordar em um preço. Deixados para si mesmos com indicações de linguagem pura, os LLM 2024-2026 fecham negócios a taxas surpreendentemente baixas (~ 27% em negócios com parâmetros apertados em arXiv:2402.15813).

O problema principal é que os LLM misturam dois trabalhos  decidindo a oferta e narrando a oferta. OG-Narrator separou estes: um gerador de oferta determinista calcula os movimentos numéricos; o LLM apenas narra.

O protocolo de contrato (FIPA, 1996; Smith, 1980) é o mecanismo de referência do mercado de tarefas.

## Conceptos

### Contrato Net, num parágrafo

O Protocolo de Contratação Net de Smith de 1980: a **manager**Transmissão de televisão **call for proposals (cfp)**- O que é ?**bidders**Responder com **propose**mensagens que contêm as suas ofertas; o gerente escolhe um vencedor e envia **accept-proposal**para o vencedor e **reject-proposal**O vencedor faz o trabalho.**refuse**A FIPA codificou isto como:`fipa-contract-net`Protocolo de interação.

### Por que o OG-Narrador ganha

"Messuring Negotiating Abilities of Language Models" (arXiv:2402.15813) observou que:

- As LLM frequentemente infringem as regras de negociação (oferta a preços sem sentido, ignorar o ZOPA do outro lado).
- Eles ancoram mal (aceitam ofertas iniciais ruins; contra-oferta em quantidades simbólicas em vez de estratégicas).
- Os modelos maiores tornam a linguagem mais plausível com erros estratégicos semelhantes.

A decomposição do OG-Narrador:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

O gerador de ofertas é uma estratégia de negociação clássica: um modelo de negociação de Rubinstein, uma estratégia Zeuthen, ou um simples tit-for-tat sobre o preço.

A taxa de negócios aumenta porque:
- Os preços permanecem na zona de negociação.
- Ancores são estratégicos, não emocionais.
- O LLM faz o que é bom: escrever.

### NegociaçãoConstatos da Arena

O arXiv:2402.05863 fornece o índice de referência canônico.

- As LLM podem melhorar os salários ~20% adotando personas ("Estou desesperado por vender isso até sexta-feira")  Manipulação de persona é uma tática real.
- Os agentes justos/cooperativos são explorados por agentes adversários; a defesa exige uma contraposta explícita.
- Os paramentos simétricos convergem a resultados inegais em cerca de 40% dos cenários de referência.

Não é "os LLM são maus negociadores". É "os LLM negociam muito como os humanos, incluindo as partes exploráveis".

### O ocultamento da cadeia de pensamentos

A Grande Concurso de Negociação Autônoma (arXiv:2503.06416) realizou cerca de 180 mil negociações em muitas estratégias de LLM. Os vencedores ocultaram seu raciocínio de seus colegas:

- Se um agente imprimir "Eu só vou para o$75; my reservation price is $70" num raspadinho visível ao público, o adversário lê-o.
- Os vencedores compute estratégia em privado; o canal de saída contém apenas a oferta e a narrativa mínima necessária.

Este é um eco de 2026 da teoria clássica do jogo (Aumann 1976 sobre racionalidade e informação): revelar a sua avaliação privada custos de pagamento. LLM não intuir isso e felizmente digitar suas reservas em rastros de raciocínio que tornam-se visíveis para a contraparte.

Engenharia takeaway: separar o contexto privado-scratchpad do contexto de mensagem pública. Não opcional.

### Bhattacharya et al. 2025  classificações de modelos

Em relação às métricas do Projeto de Negociação de Harvard (negociação em princípio, respeito pela BATNA, reciprocidade de interesses):

- **Llama-3**foi mais eficaz em negociações (taxa de transacção + pagamento).
- **Claude-3**O Conselho Europeu de Ministros dos Negócios Estrangeiros (CEC) defendeu que a Comissão não pode, em qualquer caso, fazer qualquer intervenção para que o Conselho possa tomar medidas para evitar que a situação seja prejudicada.
- **GPT-4**foi a mais justa (menos variação de pagamento entre as paradas).

Este é um snapshot de 2025. O ponto não é qual modelo vence em abril de 2026  é que diferentes modelos base têm estilos de negociação persistentes. Ensembles heterogêneos (Lessão 15) incluem isso como uma fonte de diversidade.

### A atribuição de tarefas através de contrato líquido + MLL

A reutilização moderna de Contract Net para LLM multi-agente:

1. O agente gerente decompõe uma tarefa em unidades.
2. Transmissões `cfp`Com descrição da tarefa aos agentes dos trabalhadores.
3. Cada trabalhador retorna uma oferta: `(price, eta, confidence)`onde o preço pode ser tokens, unidades de cálculo ou dólares.
4. O gerente seleciona os vencedores (singular ou múltiplos, dependendo da tarefa) e os prémios.
5. Os trabalhadores recusados são livres para fazer propostas para outras tarefas.

Esta escala ultrapassa bem 100 trabalhadores porque a coordenação é de transmissão e resposta, não de chat sincrono.

### Negociação interativa entre as partes interessadas da MLL

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) introduz jogos multipartícios marcáveis com **secret scores**E ...**minimum-acceptance thresholds**. Cada parte interessada tem serviços públicos privados; o LLM deve inferir-los a partir de mensagens. Esta é a generalização da negociação bipartidária para a formação de coalizões de partidos N. Relevante para mercados de tarefas de produção com capacidades trabalhadoras heterogêneas.

### A regra narrativa contra o mecanismo

Em todas as referências de negociação de 2024 a 2026, a regra de engenharia consistente é:

> Deixe o LLM narrar, não deixe o LLM calcular a oferta.

Se a oferta precisar ser um número (preço, ETA, quantidade), gerá-la deterministicamente a partir do estado de negociação e faça com que o LLM produza a enquadramento.

```figure
a5-og-narrator
```

## Construí-lo

`code/main.py`Implementos:

- `ContractNetManager`- Não .`ContractNetTask`- Não .`Bid` gerente + licitantes, emissões de televisão, recolha de propostas, concessão.
- `og_narrator_bargain(state, rng)` Comprador OG-Narrador: concessão determinista de estilo Zeuthen em direção ao ponto médio.
- `seller_response(state, rng)` política determinista de contra-oferta do vendedor (a verdade estrutural para ambos os estilos).
- `naive_llm_bargain(state, rng)` simula uma negociação de LLM: escolhe preços com alta variação, muitas vezes fora da ZOPA.
- Medida: taxa de transacção em mais de 1000 ensaios, com preços de reserva frescos recolhidos em amostra por ensaio.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Resultado esperado: taxa de negócio naívo-LLM ~65-75%; taxa de negócio OG-Narrador ~85-95%; a diferença de 15-25 pontos é a vantagem estrutural de decompor a geração de ofertas da narração.

## Usá-lo

`outputs/skill-bargainer-designer.md`Desenha um protocolo de negociação: quem gera ofertas (determinista ou LLM), quem narra, como os scratchpads privados se separam das mensagens públicas e como a taxa de negócios é monitorada.

## Envia-o

Lista de verificação de negociações de produção:

- **Separate scratchpad.**O Estado privado nunca chega ao contexto da contraparte.
- **Deterministic offer generation.**Preços, quantidades, datas de chegada: calcular, não pedir.
- **Validate all incoming offers**Rejeitar ofertas fora do ZOPA na fronteira do protocolo.
- **Bound rounds.**3-5 tiros no máximo; escala para mediador em um impasse.
- **Measure deal rate and payoff variance**Uma taxa de negócios em queda é um sintoma, muitas vezes uma deriva rápida ou um ataque do lado da contraparte.
- **Log all rejected proposals**Para os gestores da Rede de Contratos, os licitadores perdedores precisam entender o porquê.

## Exercícios

1. Corra .`code/main.py`Confirme que o OG-Narrador supera o LLM na taxa de negócios.
2. Implementação **persona-based payoff improvement**O comprador adota um "desesperado para comprar esta semana" personalidade apenas na narrativa, oferece gerador inalterado.
3. Implementar a cadeia de pensamento **concealment**O que acontece se você o vazar acidentalmente (simulação trocando os canais)?
4. Extenda o contrato líquido para o leilão de N-adjudicador com preço de reserva. Quando todas as ofertas excederem a reserva, como o gerente decide entre o preço mais baixo e a mais alta qualidade?
5. Leia Bhattacharya et al. 2025 sobre as métricas do Projeto de Negociação de Harvard. Implemente dois negociadores com estilos diferentes (agressivo vs justo).

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Mais leitura

- [NegotiationArena](https://arxiv.org/abs/2402.05863) o índice de referência; constatações de manipulação e exploração de pessoas
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) OG-Narrador e o resultado de comprador-mais duro do que vendedor
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) ~ 180 mil negociações; a ocultação da cadeia de pensamentos ganha
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) Jogos multi-partidários marcadores com utilitários secretos
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) o mecanismo clássico, IEEE Transações em Computadores
