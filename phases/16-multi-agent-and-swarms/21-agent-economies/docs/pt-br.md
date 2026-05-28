# Economias de Agent, Incentivos Token, Reputação

> Agents autônomos de horizonte longo (curva de trabalho de 1h a 8h do METR) precisam de agência econômica. A **pilha de 5 camadas** emergente é: **DePIN** (computação física) → **Identidade** (DIDs W3C + capital de reputação) → **Cognição** (RAG + MCP) → **Liquidation** (abstração de conta) → **Governança** (DAOs Agênticos). Redes de incentivo pra agent em produção incluem **Bittensor** (subnets TAO recompensam modelos de tarefa específica), **Fetch.ai / ASI Alliance** (LLM ASI-1 Mini + token FET) e **Gonka** (proof-of-work baseado em transformer que realoca computação pra tarefas de IA produtivas). Trabalho acadêmico: AAMAS 2025's LaMAS descentralizado usa **credit attribution por valor de Shapley** pra recompensar justamente agents contribuintes; Google Research "Mechanism design for large language models" propõe **leilões de token** com pagamento de segundo preço sob agregação monótona. Esta aula constrói um marketplace mínimo de agents, aplica credit attribution por valor de Shapley a um pipeline multi-agente e roda um leilão de token de segundo preço pra que a maquinaria de teoria dos jogos se concretize.

**Tipo:** Aprender
**Idiomas:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 16 (Negociação e Barganha), Fase 16 · 09 (Redes Swarm Paralelas)
**Tempo:** ~75 minutos

## Problema

Sistemas multi-agente ficam complicados quando agents produzem valor conjuntamente mas precisam ser recompensados individualmente. Mecanismos clássicos — divisão igual, último-contribuinte-leva-tudo — são injustos ou exploráveis. Recompensas baseadas em coalizão via valores de Shapley são justas por construção mas caras de computar. A literatura de 2025-2026 empurra aproximações úteis: amostragem de Shapley, leilões de agregação monótona e reputação on-chain que acumula de contribuições confirmadas.

Além de credit attribution, o campo virou pra agentes econômicos reais: Bittensor TAO recompensa mineração de computação pra fine-tuning de modelos de subnet específica, Fetch.ai/ASI recompensa uso do LLM ASI-1 Mini com tokens FET, Gonka realoca proof-of-work de transformer pra tarefas de IA produtivas. Agents que transacionam autônomos existem hoje; a questão é como alinhar incentivos.

Esta aula trata economias de agent como uma família específica de problemas — credit attribution, design de mecanismo e reputação — e constrói cada um com o mínimo de matemática pra que as ideias grudem.

## Conceito

### A pilha de 5 camadas da economia de agent

1. **DePIN (computação física).** Infraestrutura descentralizada que aluga GPU, armazenamento, banda. Subnets Bittensor, Render Network, Akash. Não específica de agent; agents usam ela.
2. **Identidade.** Decentralized Identifiers (DIDs) W3C dão a cada agent um ID durável independente de qualquer plataforma. Reputação acumula no DID. O Agent Network Protocol (ANP) usa DID como camada de descoberta.
3. **Cognição.** Loop de raciocínio do agent: LLM + RAG + MCP. Isso é o que as outras fases constroem.
4. **Liquidation.** Abstração de conta (ERC-4337) permite agents pagar gas do próprio saldo sem ter ETH. Agents podem pagar por serviços, por uns aos outros, ou por computação.
5. **Governança.** DAOs agênticos: estruturas de governança onde humanos *e* agents votam em mudanças de protocolo, com poder de voto atrelado à reputação.

Nem todo sistema em produção usa todas cinco. Bittensor usa 1, 2, parcialmente 3, parcialmente 4, nenhuma de 5. Agents da OpenAI usam nenhuma exceto 3. A pilha é um mapa de referência, não um requisito.

### Bittensor, Fetch.ai, Gonka — o que roda

**Bittensor (TAO).** Subnets são tarefas especializadas (modelagem de linguagem, geração de imagem, previsão). Mineradores submetem saídas de modelo. Validadores as ranqueiam; scoring ponderado por stake distribui as recompensas TAO. Cada subnet tem sua própria avaliação. A lição econômica: pague por qualidade de saída de tarefa específica, não por computação usada.

**Fetch.ai / ASI Alliance.** LLM ASI-1 Mini roda na rede Fetch.ai; usuários pagam tokens FET por inferência. O narrativa agents-como-peers é mais forte aqui: um agent no Fetch pode chamar outro pra uma tarefa e pagar em FET.

**Gonka.** Proof-of-work de transformer: o "trabalho" são forward passes de um transformer. Mineradores ganham rodando tarefas de inferência com saídas corretas conhecidas (dos dados de treino). PoW produtivo em recursos ao invés de PoW baseado em hash.

Os três são em produção desde abril de 2026. Distribuição de payoff difere. Bittensor recompensa qualidade relativa a validadores de subnet; Fetch recompensa utilidade medida por usuários que pagam; Gonka recompensa trabalho de inferência verificável.

### Credit attribution por valor de Shapley

Três agents colaboram numa tarefa. A saída pontua 0.8. Quem contribuiu o quê?

Valor de Shapley: a alocação de crédito única que satisfaz quatro axiomas (eficiência, simetria, linearidade, nulo). Pra agent `i`:

```
shapley(i) = (1/N!) * soma sobre todas ordenações O de (v(S_i_O ∪ {i}) - v(S_i_O))
```

Onde `S_i_O` é o conjunto de agents antes de `i` na ordenação `O`. Na prática: enumere todas permutações, registre a contribuição marginal de cada agent em cada permutação, faça a média.

Pra N=3 agents, são 6 permutações. Pra N=10, 3.6M — então na prática você amostra ordenações ao invés de enumerar.

### Leilão de segundo preço pra agregação

Google Research ("Mechanism design for large language models") propõe leilões de token de segundo preço pra agregar saídas de LLM. Setup: N agents cada propõe uma completude; cada um tem um valor privado por ser selecionado. O leiloeiro escolhe a proposta de maior valor e paga o *segundo maior* valor. Sob agregação monótona (valor depende de qual proposta é escolhida, não de quantas foram ofertadas), isso é truthful — agents ofertam seu valor real.

Por que isso importa pra sistemas LLM: você pode terceirizar tarefas de completude pra múltiplos agents com preços diferentes; o leilão escolhe o melhor + paga justamente, e agents não têm incentivo pra reportar errado.

### Capital de reputação

Uma pontuação de reputação vinculada a DID acumula de contribuições confirmadas. Uma regra de atualização simples:

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

Com fator de decaimento `alpha` perto de 1. Reputação:

- É barata de ler pra decisões de routing ("envie tarefas difíceis pra agents de alta reputação").
- É cara de forjar (acumula ao longo do tempo, vinculada a DID).
- Pode ser cortada: contribuições que falham na verificação subtraem.

### AAMAS 2025 LaMAS descentralizado

A proposta LaMAS (AAMAS 2025) combina: identidade DID, credit attribution por valor de Shapley e um mecanismo de leilão simples. A alegação principal: descentralizar o passo de credit attribution torna o sistema audível e imune a manipulação por ponto único.

### Onde a economia desmorona

- **Manipulação de oracle de preço.** Se a função de crédito puder ser explorada, agents vão explorá-la. Todo mecanismo precisa de um teste adversarial.
- **Ataques Sybil.** Um operador cria N agents falsos pra inflar a própria contribuição. DIDs desaceleram mas não param isso; custo de reputação pra forjar é a mitigação.
- **Custo de verificação.** Credit attribution é tão justo quanto o verificador. Se verificação é barata (LLM pequeno), pode ser explorada; se cara (painel humano), o sistema não escala.
- **Regulação pendente.** Economias de agent intersectam com regulação financeira. Bittensor, Fetch e Gonka operam em áreas cinzas legais em algumas jurisdições em 2026.

### Quando economias de agent fazem sentido

- **Redes abertas com operadores heterogêneos.** Nenhum time único controla todos agents.
- **Saídas verificáveis.** Sem verificação, credit attribution é chute.
- **Workflows de horizonte longo.** Tarefas pontuais não se beneficiam de acumulação de reputação.
- **Pagamentos tokenizados são legalmente viáveis** na sua jurisdição.

Em sistemas corporativos fechados, economia cede lugar a alocação mais simples (gerentes atribuem trabalho, métricas são internas). A literatura de economia se aplica majoritariamente a redes abertas.

## Construir

`code/main.py` implementa:

- `shapley(value_fn, agents)` — cálculo exato de Shapley por enumeração pra N pequeno.
- `second_price_auction(bids)` — mecanismo truthful; ganhador paga segundo maior.
- `Reputation` — reputação vinculada a DID com decaimento exponencial e slashing.
- Demo 1: três agents colaboram, Shapley exato atribui crédito.
- Demo 2: cinco agents ofertam pra uma vaga de tarefa; leilão de segundo preço escolhe ganhador + pagamento.
- Demo 3: 100 rodadas de atribuição de tarefas pra agents com reputação heterogênea; routing ponderado por rep supera o aleatório.

Execute:

```
python3 code/main.py
```

Saída esperada: valores de Shapley pra cada agent; resultado do leilão mostrando equilíbrio truthful-bid; routing ponderado por rep mostrando ganho de 10-20% em qualidade sobre aleatório após aquecimento.

## Usar

`outputs/skill-economy-designer.md` projeta uma economia mínima de agent: escolha de camada de identidade, mecanismo de credit attribution, mecanismo de pagamento, regra de reputação.

## Em produção

Rodar uma economia de agent em 2026:

- **Comece com reputação, não com tokens.** Reputação é barata de implementar e valiosa sozinha; tokens adicionam complexidade legal e econômica.
- **Verifique antes de recompensar.** Nunca distribua crédito sem um passo de verificação independente. Qualidade autoreportada gera jogos sybil.
- **Shapley-amostragem, não Shapley-exato.** Amostre 100-1000 ordenações; enumeração exata não escala.
- **Limite o fator de decaimento e faça reputação mínima.** Decaimento sem limite apaga contribuintes legítimos; decaimento muito devagar recompensa agents de alta reputação desatualizados.
- **Audite mecanismos adversarialmente.** Rode cenários de red-team antes de abrir a rede. Todo mecanismo tem uma teoria dos jogos; você quer achar os buracos, não os atacantes.

## Exercícios

1. Execute `code/main.py`. Confirme que os valores de Shapley somam ao valor total (axioma de eficiência). Mude a função de valor; as alocações de Shapley mudam na direção esperada?
2. Implemente Shapley *por amostragem* (Monte Carlo sobre K ordenações). Como K afeta a precisão da aproximação? Compare com o exato pra N=4.
3. Implemente um passo de formação de coalizão antes do leilão: agents podem se fundir em times e ofertar como unidade. Quais coalizões se formam? O resultado é Pareto-melhor que ofertar individualmente?
4. Leia o post de mechanism design do Google Research. Identifique uma assunção que, se violada, quebra o truthfulness. Como seria esse modo de falha num cenário LLM?
5. Leia o artigo do AAMAS 2025 sobre LaMAS descentralizado. Implemente o passo de Shapley deles sobre 10 agents numa tarefa sintética. Quanto tempo o cálculo exato leva? Quão perto a amostragem chega com 100 draws?

## Termos-chave

| Termo | O que dizem | O que realmente significa |
|------|----------------|------------------------|
| DePIN | "Infraestrutura descentralizada física" | Computação/armazenamento/banda incentivada por token. Bittensor, Akash, Render. |
| DID | "Identificador descentralizado" | Especificação W3C pra IDs portáveis. Reputação de agent vincula a DID, não a plataforma. |
| ERC-4337 | "Abstração de conta" | Contratos de conta que podem patrocinar gas, permitindo pagamentos de agent. |
| Valor de Shapley | "Credit attribution justo" | Alocação única que satisfaz eficiência, simetria, linearidade, nulo. |
| Leilão de segundo preço | "Leilão Vickrey" | Mecanismo truthful: ganhador paga segunda maior oferta. Compatível com agregação monótona. |
| Capital de reputação | "Pontuação de qualidade acumulada" | Score vinculado a DID de contribuições confirmadas; decai ao longo do tempo. |
| DAO Agêntico | "Agents + humanos governam" | DAO com votantes agents como first-class, poder de voto atrelado à reputação. |
| TAO / FET / créditos GPU | "Denominações de token" | Bittensor TAO, Fetch.ai FET, vários tokens DePIN. |

## Leitura Adicional

- [The Agent Economy](https://arxiv.org/abs/2602.14219) — survey de 2026 da pilha de economia de agent de 5 camadas
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) — leilões de token com agregação monótona
- [AAMAS 2025 — LaMAS descentralizado](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — credit attribution por valor de Shapley
- [Documentação Bittensor TAO](https://docs.bittensor.com/) — estrutura de subnet e distribuição de recompensas
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — LLM ASI-1 Mini e token FET
- [Especificação W3C Decentralized Identifiers (DIDs)](https://www.w3.org/TR/did-core/) — base de identidade
