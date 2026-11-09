# Consenso e Tolerança Bizantina à Falha dos Agentes

> Sistemas distribuídos clássicos BFT atende aos LLM estocásticos. Em 2025-2026, surgiram três direcções de investigação: **CP-WBFT**(arXiv:2511.10400) pesa cada voto por uma investigação de confiança; **DecentLLMs**(arXiv:2507.14928) vai sem líder com propostas paralelas de trabalhadores e agregação geométrica-mediana; **WBFT**(arXiv:2505.05103) combina votação ponderada com Clustering de Estrutura Hierárquica para dividir os nós Core e Edge. O resultado empírico honesto de "Can AI Agents Agree?" (arXiv:2603.01213) é que mesmo o acordo escalar é frágil hoje  um único agente enganador pode comprometer uma mistura de agentes. A BFT é necessária, mas não suficiente. Esta lição constrói um protocolo BFT mínimo, injeta três ataques específicos de agentes (mentir bizantino, conformidade sicófante, monocultura de erro correlacionado) e mede como cada variante de consenso lida.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 07 (Society of Mind and Debate), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## Problemas

Você tem N LLM agentes cada produzindo uma resposta. Eles discordam. A maioria dos votos escolhe o errado porque dois agentes são correlacionados (o mesmo modelo base, os mesmos dados de treinamento, os mesmos modos de falha). Um terceiro agente acontece que está errado de uma maneira nova , então a maioria é uma maioria falsa.

Agora adicione um agente enganador: ele está de propósito. ou um agente sícofântico: ele concorda com quem falou pela última vez.`f < n/3`A realidade de 2026 é que os nós LLM são estocásticos mesmo quando honestos, correlacionados entre os modelos e influenciados pelas saídas uns dos outros.

O BFT clássico (PBFT, 1999) não está errado  é incompleto. Ele lida com o deslocamento arbitrário de bits. Não lida com "três agentes honestos compartilham uma alucinação porque compartilham dados de treinamento". Esta lição se baseia na fundação e camadas do PBFT em três adaptações 2025-2026.

## Conceptos

### O que o BFT clássico lhe dá

A Tolerância Prática à Falha Bizantina (Castro & Liskov, OSDI 1999) tolera `f < n/3`Nódos bizantinos. O protocolo tem três fases (preparação, preparação, compromisso) e duas primitivas (mensagens assinadas, certificados de quórum).`n >= 3f + 1`nós honestos ou maliciosos.

As garantias são fortes, mas assumem:

1. **Independent faults.**Os bizantinos não se coordenam.
2. **Honest nodes are truly honest.**A corretão das saídas honestas não é um problema; o protocolo só alinha o desacordo.
3. **The question has a ground-truth answer.**O consenso sobre um facto errado continua a ser consenso.

Os agentes da LLM violam os três. Dois agentes que executam o mesmo modelo base compartilham falhas. Um LLM "honesto" ainda alucina. E em questões ambíguas, a "verdade" é o que os agentes decidem.

### Os três ataques específicos da LLM

**Byzantine lie.**Um agente dá uma resposta deliberadamente errada.`f < n/3`- Não .

**Sycophantic conformity.**Um agente lê as respostas dos outros antes de votar e alinha-se com quem falou mais tarde. Não é malicioso, mas correlaciona-se com a voz mais alta.

**Correlated-error monoculture.**Três agentes compartilham um modelo base. Eles alucinam a mesma resposta errada. A maioria está errada.

### As respostas de 2025 a 2026

**CP-WBFT**(arXiv:2511.10400)  BFT ponderado com prova de confiança. Cada eleitor anexa uma sonda de confiança à sua resposta (uma probabilidade auto-relatada ou a previsão de um modelo de calibração separado).

**DecentLLMs**(arXiv:2507.14928)  Leaderless. Agentes de trabalhadores propõem em paralelo, agentes de avaliadores pontuações propostas, resposta final é a média geométrica das posições pontuações.`f < n/2`. Mitigation for: mentira bizantina e erros correlacionados (mediana geométrica é robusta a valores fora do plano e atrai para o aglomerado denso, não para a média baseada em modelos).

**WBFT**(arXiv:2505.05103)  BFT ponderado com Clustering de Estrutura Hierárquica. Pesos de voto são atribuídos pela qualidade da resposta mais uma pontuação de confiança aprendida da história. Agentes de cluster em Core e Edge; Agentes Core devem alcançar consenso primeiro, Agentes Edge seguem. Mitigation para: escalabilidade (Core consensus é pequeno e rápido) e parcialmente para monocultura (Core pode ser escolhido para a diversidade).

### Empirical: "Podem Agentes de IA concordar?" (arXiv:2603.01213)

O papel mede o acordo escalar (agentes LLM que concordam sobre um único valor numérico) em vários modelos de fronteira.

- Mesmo sem adversários, os agentes da LLM discordam sobre questões escalares em taxas acima de 30% em muitos índices de referência.
- Um único agente que adota uma personalidade enganosa pode tirar o consenso de mistura de agentes 40+ pontos percentuais da linha de base honesta.
- As taxas de desacordo correlacionam com a diversidade de modelos  conjuntos heterogêneos discordam mais do que os homogêneos (bom: erros não correlacionados) mas também deslocam-se mais lentamente (mau: tempo mais longo para o acordo).

A conclusão: a BFT fornece uma máquina para alinhar as saídas, mas não diz se a saída alinhada é correta.

### O protocolo central, despojado

Um mínimo de BFT para agentes LLM:

```
1. task arrives; each agent i produces answer a_i
2. each agent attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

A etapa de agrupamento semântico é a torcida específica do LLM. Duas respostas "o estudo relata 4,2%" e "melhora de 4,2%" são o mesmo agrupamento. Uma verificação ingênua de igualdade de cordas perderia isso.

### Apontação do limiar

O `threshold`O parâmetro decide quando aceitar e quando tentar novamente. Muito baixo: aceita majoritades fracas. Muito alto: nunca aceita nada. Intervalo empírico: 0,5-0,67 para `n=5-7`Agentes, mais altos para os menores `n`Abaixo de um limiar, escala para um humano ou para um conjunto de agentes diferentes.

### Quando o consenso não ajuda

- **Ambiguous questions.**Se a questão não tem verdade, o consenso é uma opinião.
- **Compound questions.**"Escreva código e explica-o"  duas respostas.
- **Adversarial multi-round.**Se os agentes podem observar rodadas anteriores e imitar (debate Du 2023), eles começam a concordar entre si independentemente da verdade.

```figure
swarm-consensus-wave
```

## Construí-lo

`code/main.py`Implementos:

- `AgentVoter` uma política escrita com (resposta, confiança).
- `MajorityVote` Pluralidade clássica.
- `CPWBFT` votação ponderada pela confiança com agrupamento semântico.
- `DecentLLMs` Agregação geométrica-mediana das propostas pontuações.
- `Scenario` executa cada agregador sob três padrões de ataque.

Padrões de ataque implementados:

1. `byzantine`Um agente está a mentir com grande confiança.
2. `sycophancy`Um agente copia a primeira resposta que vê, com a mesma confiança.
3. `monoculture`A resposta é errada (erro correlacionado) e os três agentes compartilham uma resposta errada com confiança moderada.

- Correr .

```
python3 code/main.py
npx tsx code/main.ts
```

Output esperado: uma tabela de (ataque, agregador) -> resposta final, com a resposta correta destacada. Pluralidade falha no caso da monocultura. A ponderação de confiança do CPWBFT atinge a sicofania.

## Usá-lo

`outputs/skill-consensus-designer.md`Desenha um protocolo de consenso para um conjunto de agentes múltiplos: método de agrupamento, ponderação, limiar e política de escalação para rodadas de sub limiar.

## Envia-o

Antes de enviar qualquer mecanismo de consenso:

- **Attack-test with at least the three patterns**O seu protocolo deve falhar de forma previsível, não silenciosamente.
- **Log every minority cluster**Os grupos minoritários são o sistema de alerta precoce para erros correlacionados.
- **Enforce bounded rounds.**Não "continuem a debater até um acordo" que recompensa a cegoação.
- **Separate agreement from correctness.**A saída de consenso vai para um verificador; o verificador é independente do conjunto.
- **Monitor the agreement rate.**Um aumento acentuado significa preconceito de conformidade; uma queda acentuada significa deriva do modelo.

## Exercícios

1. Corra .`code/main.py`- Confirmar a pluralidade falha no ataque das monoculturas, mas o CPWBFT mitigou parcialmente quando a confiança das monoculturas é inferior a 0,7.
2. Adicione um quarto padrão de ataque:**silent abstention** um agente recusa-se a responder ("não sei"). Como deve cada agregador tratar as abstenções?
3. Esquievar o agrupamento semântico da canonização de cadeia para a semelhança de inserção (utilizar qualquer modelo de inserção de código aberto). O que acontece com o ataque de sicofancia?
4. Leia CP-WBFT (arXiv:2511.10400). Implementar a etapa de calibração de sonda de confiança (um modelo de calibração separado verifica a auto-relatada confiança de cada agente).
5. Leia "Podem Agentes de IA concordar?" (arXiv:2603.01213). Reproduzir um experimento simplificado de acordo escalar: três agentes, uma pergunta escalar, o prompt de pessoa enganadora.

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| BFT | "Byzantine fault tolerance" | Castro-Liskov 1999 protocol for consensus with `f < n/3` arbitrary faults. |
| Byzantine | "Any bad behavior" | A node that can lie, drop messages, fail silently — anything but crash safely. |
| Confidence probe | "How sure are you?" | Self-reported or calibrator-predicted probability attached to a vote. |
| Semantic clustering | "Same answer, different words" | Grouping equivalent answers before counting votes. |
| Geometric median | "Robust center" | The point minimizing sum of distances to sample points. Robust to outliers, unlike the mean. |
| Monoculture | "Same model, same failures" | Correlated errors when agents share training data or base model. |
| Sycophantic conformity | "Agreeing with the loud voice" | An agent's vote biases toward whoever spoke first/loudest. |
| Core/Edge | "Hierarchical BFT" | WBFT split: small Core consensus first, Edge nodes follow. Bounds latency. |

## Mais leitura

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://www.usenix.org/conference/osdi-99/practical-byzantine-fault-tolerance) a fundação
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) Peso de votos por confiança
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) Agregação geométrica-mediana
- [WBFT — Weighted BFT with Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) Divisão Core/Edge para latência limitada
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) Fragilidade dos acordos escalares e ataque de pessoa enganosa
