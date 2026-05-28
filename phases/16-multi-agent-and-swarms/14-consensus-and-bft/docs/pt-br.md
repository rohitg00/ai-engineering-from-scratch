# Consenso e Tolerância a Falhas Bizantinas para Agents

> BFT clássico de sistemas distribuídos encontra LLMs estocásticos. Em 2025-2026 três direções de pesquisa surgiram: **CP-WBFT** (arXiv:2511.10400) pondera cada voto com uma sonda de confiança; **DecentLLMs** (arXiv:2507.14928) opera sem líder com propostas paralelas de workers e agregação por mediana geométrica; **WBFT** (arXiv:2505.05103) combina voto ponderado com Hierarchical Structure Clustering pra separar nós Core e Edge. O resultado empírico honesto de "Can AI Agents Agree?" (arXiv:2603.01213) é que mesmo consenso escalar é frágil hoje — um único agente enganoso pode comprometer um Mixture-of-Agents. BFT é necessário mas não suficiente. Esta lição constrói um protocolo BFT mínimo, injeta três ataques eespecificaçãoíficos de agente (mentira bizantina, conformidade sycophantic, monocultura de erro correlacionado), e mede como cada variante de consenso se comporta.

**Tipo:** Aprender + Construir
**Linguagens:** Python (stdlib)
**Pré-requisitos:** Fase 16 · 07 (Society of Mind and Debate), Fase 16 · 13 (Shared Memory)
**Tempo:** ~75 minutos

## Problema

Você tem N agentes LLM cada um produzindo uma resposta. Eles discordam. Voto majoritário escolhe a errada porque dois agentes são correlacionados (mesmo base model, mesmos dados de treino, mesmos modos de falha). Um terceiro agente por acaso está errado de um jeito novo — então a maioria é uma falsa maioria.

Agora adicione um agente enganoso: ele mente de propósito. Ou um agente sycophantic: ele concorda com quem falou por último. Na BFT clássica, a assunção é que nós bizantinos são uma fração `f < n/3` e se comportam arbitráriamente. A realidade de 2026 é que nós LLM são estocásticos mesmo quando honestos, correlacionados entre modelos, e influenciados pelas saídas uns dos outros. Você não pode tratá-los como votantes Bernoulli independentes.

BFT clássica (PBFT, 1999) não está errada — está incompleta. Ela lida com bit-flipping arbitrário. Ela não lida com "três agentes honestos compartilham uma alucinação porque compartilham dados de treino." Esta lição constrói a partir da base do PBFT e adiciona três adaptações de 2025-2026.

## Conceito

### O que a BFT clássica te dá

Practical Byzantine Fault Tolerance (Castro & Liskov, OSDI 1999) tolera `f < n/3` nós bizantinos. O protocolo tem três fases (pre-prepare, prepare, commit) e dois primitives (mensagens assinadas, certificados de quorum). Consenso em um valor único entre `n >= 3f + 1` nós honestos-ou-maliciosos.

As garantias são fortes mas assumem:

1. **Falhas independentes.** Bizantinos não coordenam.
2. **Nós honestos são verdadeiramente honestos.** Correção das saídas honestas é irrelevante; o protocolo só alinha discordância.
3. **A pergunta tem uma resposta ground-truth.** Consenso num fato errado ainda é consenso.

Agents LLM violam os três. Dois agentes rodando o mesmo base model compartilham falhas. Um LLM "honesto" ainda alucina. E em perguntas ambíguas, a "verdade" é o que os agentes decidem — não existe um oráculo externo.

### Os três ataques eespecificaçãoíficos de LLM

**Mentira bizantina.** Um agente produz uma resposta deliberadamente errada. BFT clássica lida com isso se `f < n/3`.

**Conformidade sycophantic.** Um agente lê as respostas dos outros antes de votar e se alinha com quem falou por último. Não é malicioso, mas se correlaciona com a voz mais alta. BFT clássica não impede isso porque o agente passa toda verificação de assinatura.

**Monocultura de erro correlacionado.** Três agentes compartilham um base model. Eles alucinam a mesma resposta errada. A maioria está errada. BFT clássica não ajuda porque os três concordam "honestamente."

### As respostas de 2025-2026

**CP-WBFT** (arXiv:2511.10400) — Confidence-Probed Weighted BFT. Cada votante anexa uma sonda de confiança à sua resposta (uma probabilidade auto-reportada, ou a predição de um modelo de calibração separado). Pesos de voto escalam com a confiança. Relatou +85.71% de melhoria em BFT em grafos completos. Mitigação pra: conformidade sycophantic (agents conformistas tendem a ter baixa confiança na posição voluntariada).

**DecentLLMs** (arXiv:2507.14928) — Sem líder. Worker agentes propõem em paralelo, evaluator agentes pontuam propostas, a resposta final é a mediana geométrica das posições pontuadas. Robusto quando `f < n/2`. Mitigação pra: mentira bizantina e erros correlacionados (mediana geométrica é robusta a outliers e puxa pro cluster denso, não pra média enviesada pelo modelo).

**WBFT** (arXiv:2505.05103) — Weighted BFT com Hierarchical Structure Clustering. Pesos de voto são atribuídos pela qualidade da resposta mais um score de confiança aprendido do histórico. Clusteriza agentes em Core e Edge; agentes Core devem atingir consenso primeiro, agentes Edge seguem. Mitigação pra: escalabilidade (consenso Core é pequeno e rápido) e parcialmente pra monocultura (Core pode ser escolhido por diversidade).

### Empírico: "Can AI Agents Agree?" (arXiv:2603.01213)

O paper mede consenso escalar (agents LLM concordando em um valor numérico único) em múltiplos modelos frontier. O achado é desconfortável:

- Mesmo sem adversários, agentes LLM discordam em perguntas escalares em taxas acima de 30% em vários benchmarks.
- Um único agente que adota uma persona enganosa pode puxar o consenso do Mixture-of-Agents 40+ pontos percentuais da linha de base honesta.
- Taxas de discordância se correlacionam com diversidade de modelo — ensambles heterogêneos discordam mais que homogêneos (bom: erros não correlacionados) mas também convergem mais devagar (ruim: tempo até consenso maior).

O takeaway: BFT te dá maquinário pra alinhar saídas, mas não te diz se a saída alinhada está certa. Combine com verificação (eespecificaçãoialização de papel da Fase 16 · 08), diversidade (variantes de debate da Fase 16 · 15), e evaluator agentes (benchmarks da Fase 16 · 24).

### O protocolo central, simplificado

Uma rodada BFT mínima pra agentes LLM:

```
1. task arrives; each agente i produces answer a_i
2. each agente attaches confidence probe c_i in [0, 1]
3. aggregator collects (a_i, c_i) from all n agents
4. aggregator groups by semantic cluster (equivalent answers)
5. aggregator computes weight for each cluster C:
     w(C) = sum_{i in C} c_i
6. winner = cluster with max weight, if max > threshold * sum(c_i)
   else: retry or escalate
7. minority clusters logged with provenance for post-hoc audit
```

O passo de clusterização semântica é a particularidade eespecificaçãoífica de LLM. Duas respostas "o estudo relata 4.2%" e "4.2% de melhoria" são o mesmo cluster. Uma verificação ingênua de igualdade de string perderia isso. Em produção, use um modelo de embedding barato ou canonicalização explícita.

### Calibração de threshold

O parâmetro `threshold` decide quando aceitar e quando retryar. Muito baixo: você aceita maiorias fracas. Muito alto: nunca aceita nada. Faixa empírica: 0.5-0.67 pra `n=5-7` agents, maior pra `n` menor. Abaixo do threshold, escale pra um humano ou pra um ensamble diferente.

### Onde consenso não ajuda

- **Perguntas ambíguas.** Se a pergunta não tem ground truth, consenso é opinião. Chame assim.
- **Perguntas compostas.** "Escreva código e explique" — duas respostas. Vote em cada uma independentemente.
- **Adversarial multi-round.** Se agentes podem observar rodadas anteriores e imitar (debate Du 2023), eles começam a concordar uns com os outros independente da verdade. Limite as rodadas (2-3 tipicamente).

## Construa

`code/main.py` implementa:

- `AgentVoter` — uma política scriptada com (resposta, confiança).
- `MajorityVote` — pluralidade clássica.
- `CPWBFT` — voto ponderado por confiança com clusterização semântica.
- `DecentLLMs` — agregação por mediana geométrica em propostas pontuadas.
- `Scenario` — roda cada agregador sob três padrões de ataque.

Padrões de ataque implementados:

1. `byzantine`: um agente mente com alta confiança.
2. `sycophancy`: um agente copia a primeira resposta que vê, com confiança correspondente.
3. `monocultura`: três agentes compartilham uma resposta errada (erro correlacionado) com confiança moderada.

Execute:

```
python3 code/main.py
```

Saída esperada: uma tabela de (ataque, agregador) -> resposta final, com a resposta correta destacada. Pluralidade falha no caso de monocultura. A ponderação por confiança do CPWBFT mitiga sycophancy. A mediana geométrica do DecentLLMs puxa pro cluster honesto quando a monocultura é menos da metade da população.

## Use

`outputs/skill-consensus-designer.md` desenha um protocolo de consenso pra um ensamble multi-agent: método de clusterização, ponderação, threshold, e a política de escalação pra rodadas abaixo do threshold.

## Deploy

Antes de produzir qualquer mecanismo de consenso:

- **Teste de ataque com pelo menos os três padrões** acima. Seu protocolo deve falhar de forma previsível, não silenciosa.
- **Registre cada cluster minoritário** com proveniência. Clusters minoritários são seu sistema de alerta precoce pra erros correlacionados.
- **Imponha rodadas limitadas.** Nada de "continue debatendo até concordar" — isso recompensa sycophancy.
- **Separe concordância de correção.** Saída do consenso vai pra um verificador; verificador é independente do ensamble.
- **Monitore a taxa de concordância.** Um aumento abrupto indica viés de conformidade; uma queda abrupta indica deriva do modelo.

## Exercícios

1. Execute `code/main.py`. Confirme que a pluralidade falha no ataque de monocultura mas o CPWBFT mitiga parcialmente quando a confiança da monocultura está abaixo de 0.7.
2. Adicione um quarto padrão de ataque: **abstenção silenciosa** — um agente se recusa a responder ("Eu não sei"). Como cada agregador deveria tratar abstenções? Implemente sua escolha.
3. Troque a clusterização semântica de canonicalização de string pra similaridade de embedding (use qualquer modelo de embedding open-source). O que acontece no ataque de sycophancy?
4. Leia CP-WBFT (arXiv:2511.10400). Implemente o passo de calibração da sonda de confiança (um modelo de calibração separado verifica a confiança auto-reportada de cada agent). Meça a melhoria de acurácia no cenário de monocultura.
5. Leia "Can AI Agents Agree?" (arXiv:2603.01213). Reproduza um experimento simplificado de consenso escalar: três agents, uma pergunta escalar, o prompt de persona enganosa. O CPWBFT ou DecentLLMs pega?

## Termos Chave

| Termo | O que a gente diz | O que realmente significa |
|-------|-------------------|--------------------------|
| BFT | "Tolerância a falhas bizantinas" | Protocolo Castro-Liskov 1999 pra consenso com `f < n/3` falhas arbitrárias. |
| Bizantino | "Qualquer comportamento ruim" | Um nó que pode mentir, dropar mensagens, falhar silenciosamente — qualquer coisa menos crash seguro. |
| Sonda de confiança | "Quão certo você está?" | Probabilidade auto-reportada ou predita por calibrador anexada a um voto. |
| Clusterização semântica | "Mesma resposta, palavras diferentes" | Agrupar respostas equivalentes antes de contar votos. |
| Mediana geométrica | "Centro robusto" | O ponto que minimiza soma de distâncias aos pontos amostrais. Robusta a outliers, diferente da média. |
| Monocultura | "Mesmo modelo, mesmas falhas" | Erros correlacionados quando agentes compartilham dados de treino ou base model. |
| Conformidade sycophantic | "Concordar com a voz alta" | O voto de um agente se enviesa pra quem falou primeiro/mais alto. |
| Core/Edge | "BFT hierárquica" | Divisão WBFT: consenso Core pequeno primeiro, nós Edge seguem. Limita latência. |

## Leitura Complementar

- [Castro & Liskov — Practical Byzantine Fault Tolerance (OSDI 1999)](https://pmg.csail.mit.edu/papers/osdi99.pdf) — a base
- [CP-WBFT — Confidence-Probe Weighted BFT](https://arxiv.org/abs/2511.10400) — ponderação de voto por confiança
- [DecentLLMs — leaderless multi-agent consensus](https://arxiv.org/abs/2507.14928) — agregação por mediana geométrica
- [WBFT — Weighted BFT com Hierarchical Structure Clustering](https://arxiv.org/abs/2505.05103) — divisão Core/Edge pra latência limitada
- [Can AI Agents Agree?](https://arxiv.org/abs/2603.01213) — fragilidade de consenso escalar e ataque de persona enganosa
