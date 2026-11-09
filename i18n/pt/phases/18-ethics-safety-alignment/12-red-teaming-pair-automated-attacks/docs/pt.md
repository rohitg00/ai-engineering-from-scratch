# Red-Teaming: PAIR e Ataques Automatizados

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419). PAIR  Rapido Automático Iterativo Refinamento  é o canônico automático de caixa preta jailbreak. Um LLM atacante com um sistema de red-team prompt propõe iterativamente jailbreaks para um LLM alvo, acumulando tentativas e respostas em seu próprio histórico de bate-papo como feedback no contexto. O PAIR normalmente consegue dentro de 20 consultas, ordens de magnitude mais eficientes do que o GCG (a pesquisa de gradientes de nível de token do Zou et al.) e sem exigir acesso em caixa branca. O PAIR é agora uma linha de base padrão no JailbreakBench (arXiv:2404.01318) e HarmBench, ao lado do GCG, AutoDAN, TAP e Prompt Adversarial persuasivo.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descreva o algoritmo PAIR: o sistema de ataque rápido, refinamento iterativo, feedback no contexto.
- Explique por que o PAIR é estritamente mais eficiente do que o GCG quando o alvo é a caixa negra.
- Nomear outras quatro linhas de base de ataque automatizado (GCG, AutoDAN, TAP, PAP) e indicar uma característica distintiva de cada uma delas.
- Descreva os protocolos de avaliação JailbreakBench e HarmBench e o que significa "taxa de sucesso de ataque" em cada um deles.

## O problema

A red-teaming costumava ser uma atividade manual. Um pequeno número de testadores especialistas construíram instruções adversárias e acompanharam as que funcionaram. Isto não é escalavel: a taxa de sucesso do ataque precisa de uma amostra estatística, e o alvo é um alvo em movimento com cada lançamento de modelo. PAIR operacionaliza a red-teaming como um problema de otimização com um alvo de caixa negra.

## O conceito

### Algoritmo de PAIR

- Input:
- Alvo LLM T (o modelo que estamos a atacar).
- Juez LLM J (pontua se uma resposta é uma fuga de prisão).
- O atacante LLM A (otimizador da equipa vermelha).
- Capa de meta G: "responde com [instrução prejudicial]."
- Orçamento K (geralmente 20 consultas).

Loop, para k em 1..K:
1. A é provocada com o objetivo G e o histórico de pares (prompto, resposta) até agora.
2. Um emite um novo sinal .$p_k$- Não .
3. Submeter$p_k$para T; receber resposta $r_k$- Não .
4. J pontuações $(p_k, r_k)$No gol.
5. Se a pontuação >= limiar, parar o jailbreak encontrado.
6. Outra, adição $(p_k, r_k)$A história de A. Continuem.

Resultado empírico (NeurIPS 2023): > 50% taxa de sucesso de ataque contra GPT-3.5-turbo, Llama-2-7B-chat; consultas médias para sucesso na faixa de 10-20.

### Por que a PAIR é eficaz

GCG (Zou et al. 2023) busca sufissivos de tokens adversários por gradiente; requer acesso a modelos de caixa branca e produz sufissivos ilegíveis. PAIR é caixa negra e produz ataques em linguagem natural que se transferem entre modelos.

### Ataques automatizados relacionados

- **GCG (Zou et al. 2023, arXiv:2307.15043).**A busca de gradientes de nível de tokens para sufisso adversário.
- **AutoDAN (Liu et al. 2023).**Pesquisa evolutiva sobre os pedidos, guiada por um objetivo hierárquico.
- **TAP (Mehrotra et al. 2024).**Árvore de ataques com poda  ramos múltiplas implementações de estilo PAIR.
- **PAP (Zeng et al. 2024).**Prompts adversários persuasivos codifica técnicas de persuasão humana como modelos de prompts.

### JailbreakBench e HarmBench

Ambas (2024) padronizam a avaliação:

- JailbreakBench (arXiv:2404.01318). 100 comportamentos prejudiciais em 10 categorias de políticas OpenAI. Taxa de sucesso de ataque (ASR) como a métrica primária. Requer um juiz (GPT-4-turbo, Llama Guard ou StrongREJECT).
- HarmBench (Mazeika et al. 2024). 510 comportamentos em 7 categorias, com testes de danos semânticos e funcionais. Comparou 18 ataques contra 33 modelos.

A ASR é geralmente relatada com um orçamento fixo de consulta.

### Razões pelas quais é importante para as implantações de 2026

Cada laboratório de fronteira agora corre PAIR e TAP contra modelos de produção antes de serem lançados. As trajetórias ASR aparecem em cartões de modelo (Lessão 26) e apêndices de casos de segurança (Lessão 18).

### Onde isto encaixa na Fase 18

A lição 12 é a base do ataque automatizado. A lição 13 (Many-Shot Jailbreaking) é uma exploração complementar de comprimento. A lição 14 (ASCII Art / Visual) é um ataque de codificação. A lição 15 (Indirect Prompt Injection) é a superfície de ataque de produção de 2026. A lição 16 abrange as contrapartes de ferramentas defensivas (Llama Guard, Garak, PyRIT).

```figure
al-pair-loop
```

## Usá-lo

`code/main.py`O atacante é um refinador baseado em regras que tenta parafrasear, criar um quadro de roteiro e codificar. O juiz marca a resposta. Você vê o atacante ter sucesso em ~5-15 iterações contra o filtro de palavras-chave e falhar contra um filtro semântico.

## Envia-o

Esta lição produz`outputs/skill-attack-audit.md`- Com base num relatório de avaliação da equipa vermelha, verifica quais foram os ataques (PAIR, GCG, TAP, AutoDAN, PAP), a que orçamento cada um, com que juiz, em que comportamento prejudicial foi estabelecido (JailbreakBench, HarmBench, interno).

## Exercícios

1. Corra .`code/main.py`- Medir as necessidades médias para o sucesso das três estratégias de ataque integradas.

2. Implementar uma quarta estratégia de ataque (por exemplo, tradução para outra língua, codificação base64).

3. Leia Chao et al. 2023 Figura 5 (comparação PAIR vs GCG). Descreva dois cenários em que o GCG é preferido apesar da vantagem de eficiência do PAIR.

4. O JailbreakBench relata a ASR contra um conjunto de objetivos fixos. Desenhe uma métrica adicional que mede a diversidade de ataque (variação em pedidos de sucesso). Explique por que a diversidade é importante para a avaliação da defesa.

5. TAP (Mehrotra 2024) estende o PAIR com ramificação + poda. Esboçar uma extensão no estilo TAP para `code/main.py`e descrever a compensação entre custos computacionais e taxas de sucesso.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## Mais leitura

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) Papel PAR, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) Papel GCG
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) Avaliação padronizada
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) avaliação mais ampla
