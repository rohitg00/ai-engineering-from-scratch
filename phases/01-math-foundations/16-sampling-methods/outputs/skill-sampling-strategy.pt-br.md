---
name: skill-sampling-strategy
description: Escolher o metodo de sampling certo pra geracao, estimacao ou inferencia
version: 1.0.0
phase: 1
lesson: 16
tags: [sampling, mcmc, generation]
---

# Selecao de Estrategia de Sampling

Como escolher o metodo de sampling certo pra geracao de texto, inferencia Bayesiana, estimacao Monte Carlo e treinamento.

## Checklist de Decisao

1. Voce esta gerando saida (texto, imagens) ou estimando uma quantidade (integral, expectativa)?
2. Voce consegue amostrar diretamente da distribuicao alvo, ou so avaliar sua densidade?
3. A distribuicao alvo e discreta ou continua?
4. Qual a dimensao do espaco amostral? Baixa (< 5), media (5-100), ou alta (> 100)?
5. Voce precisa de amostras exatas ou aproximadas?
6. Voce precisa de gradientes atraves da operacao de sampling?

## Quando usar cada metodo

| Metodo | Quando usar | Complexidade | Exato? |
|---|---|---|---|
| Sampling direto | Voce tem a CDF ou pode usar funcao de biblioteca | O(1) por amostra | Sim |
| CDF inversa | CDF inversa de forma fechada conhecida (exponencial, Cauchy) | O(1) por amostra | Sim |
| Box-Muller | Precisa de amostras normais sem biblioteca | O(1) por amostra | Sim |
| Rejection sampling | Pode avaliar PDF alvo, baixa dimensao (1-3) | O(1/taxa de aceitacao) por amostra | Sim |
| Importance sampling | Precisa de expectativas, nao amostras individuais | O(n) pra n amostras | Aproximado |
| Sampling estratificado | Estimacao Monte Carlo, quer menor variancia | O(n) pra n amostras | Aproximado |
| Metropolis-Hastings | Alta dimensao, pode avaliar densidade nao-normalizada | O(1) por passo + burn-in | Assintoticamente |
| Gibbs sampling | Pode amostrar de cada distribuicao condicional | O(d) por varredura completa | Assintoticamente |
| HMC/NUTS | Alta dimensionalidade continua, densidade suave | O(L * d) por passo | Assintoticamente |
| Temperature sampling | Geracao de texto LLM, controlar criatividade | O(V) pro vocab V | N/A |
| Top-k sampling | Geracao LLM, remover tokens improvaveis | O(V log k) | N/A |
| Top-p (nucleus) | Geracao LLM, conjunto candidato adaptativo | O(V log V) | N/A |
| Reparameterization | Precisa de gradientes atraves de sampling gaussiano (VAEs) | O(d) | Sim |
| Gumbel-Softmax | Precisa de gradientes atraves de sampling categorico | O(k) pra k classes | Aproximado |

## Configuracoes de geracao LLM

| Caso de uso | Temperature | Top-p | Top-k | Notas |
|---|---|---|---|---|
| Q&A factual | 0.0 (guloso) | -- | -- | Deterministico, sem aleatoriedade |
| Geracao de codigo | 0.2-0.5 | 0.9 | -- | Baixa criatividade, alta coesao |
| Chat geral | 0.7 | 0.9 | -- | Equilibrado |
| Escrita criativa | 0.9-1.2 | 0.95 | -- | Maior diversidade |
| Brainstorming | 1.0-1.5 | 0.95 | -- | Diversidade maxima, pode perder coesao |

Temperature e top-p podem ser combinados. Aplique temperature primeiro (escale logits), depois aplique filtro top-p.

## Selecao de metodo MCMC

| Propriedade | Metropolis-Hastings | Gibbs | HMC/NUTS |
|---|---|---|---|
| Dimensao | Qualquer | Qualquer (melhor < 100) | Alta (100+) |
| Requer condicionais | Nao | Sim | Nao |
| Requer gradiente | Nao | Nao | Sim |
| Taxa de aceitacao | Ajuste pra ~23% | Sempre 100% | Ajuste pra ~65% |
| Correlacao | Alta (random walk) | Moderada | Baixa |
| Burn-in | Longo | Moderado | Curto |
| Melhor pra | Exploracao, modelos simples | Modelos conjugados, redes Bayesianas | Posteriors continuos, modelos probabilisticos profundos |

## Erros comuns

- Usar rejection sampling em alta dimensionalidade. Taxa de aceitacao cai exponencialmente com a dimensao. Acima de 5 dimensoes, mude pra MCMC.
- Definir variancia de proposta MCMC muito alta ou muito baixa. Muito alta: maioria das propostas rejeitadas, cadeia travada. Muito baixa: todas propostas aceitas, cadeia se move devagar. Mire ~23% de aceitacao pra MH de random walk.
- Esquecer burn-in. As primeiras N amostras do MCMC sao enviesadas pelo ponto inicial. Descarte pelo menos 1000 passos (ou mais pra distribuicoes complexas).
- Usar importance sampling com proposta muito diferente da alvo. Algumas amostras recebem pesos enormes, tornando a estimativa imprecisa. Monitore o tamanho efetivo da amostra: ESS = (sum w_i)^2 / sum(w_i^2).
- Usar temperature > 0 pra tarefas que precisam de saida deterministica (ex: classificacao, extracao estruturada). Use guloso (T=0) ou beam search em vez disso.
- Nao combinar top-p com temperature. Temperature sozinha nao remove tokens lixo da cauda longa. Top-p faz.
- Fazer backpropagation atraves de operacao de sampling padrao. Use o truque de reparameterizacao pra continuo (gaussiano) e Gumbel-Softmax pra discreto (categorico).

## Referencia rapida: tecnicas de reducao de variancia

| Tecnica | Como funciona | Reducao de variancia |
|---|---|---|
| Sampling estratificado | Divida o espaco em estratos, amostra cada um | Sempre <= MC padrao |
| Variaveis antiteticas | Use tanto U quanto 1-U | Funciona pra funcoes monotonas |
| Variaveis de controle | Subtraia uma variavel de media conhecida | Proporcional a correlacao |
| Importance sampling | Reponderar amostras de melhor proposta | Depende da qualidade da proposta |
| Latin hypercube | Estratificar cada dimensao independentemente | Melhor que estratificado em alta dim |
