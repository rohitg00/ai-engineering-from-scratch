# Red-Teaming: PAIR e Ataques Automatizados

> Chao, Robey, Dobriban, Hassani, Pappas, Wong (NeurIPS 2023, arXiv:2310.08419). PAIR — Prompt Automatic Iterative Refinement — é o jailbreak automatizado black-box canônico. Um LLM atacante com um system prompt de red-team propõe iterativamente jailbreaks para um LLM-alvo, acumulando tentativas e respostas em seu próprio histórico de chat como feedback in-context. PAIR normalmente converge em 20 queries, ordens de magnitude mais eficiente que GCG (busca por gradiente em nível de token de Zou et al.) e sem exigir acesso white-box. PAIR agora é baseline padrão no JailbreakBench (arXiv:2404.01318) e HarmBench, ao lado de GCG, AutoDAN, TAP e Persuasive Adversarial Prompt.

**Tipo:** Construir
**Linguagens:** Python (stdlib, loop PAIR mock contra um alvo simulado)
**Pré-requisitos:** Fase 18 · 01 (seguimento de instruções), Fase 14 (engenharia de agentes)
**Tempo:** ~75 minutos

## Objetivos de Aprendizagem

- Descrever o algoritmo PAIR: system prompt do atacante, refinamento iterativo, feedback in-context.
- Explicar por que PAIR é estritamente mais eficiente que GCG quando o alvo é black-box.
- Nomear quatro outras baselines de ataques automatizados (GCG, AutoDAN, TAP, PAP) e indicar uma característica distintiva de cada uma.
- Descrever os protocolos de avaliação do JailbreakBench e HarmBench e o que "taxa de sucesso de ataque" significa em cada um.

## O Problemo

Red-teaming costumava ser uma atividade manual. Um pequeno grupo de testers especializados construía prompts adversariais e rastreava quais funcionavam. Isso não escala: taxa de sucesso de ataque precisa de uma amostra estatística, e o alvo é um alvo em movimento a cada release de modelo. PAIR operationaliza red-teaming como um problema de otimização com alvo black-box.

## O Conceito

### Algoritmo PAIR

Inputs:
- LLM-alvo T (o modelo que estamos atacando).
- LLM-juiz J (pontua se uma resposta é jailbreak).
- LLM-atacante A (o otimizador de red-team).
- String de objetivo G: "responda com [instrução prejudicial]."
- Orçamento K (normalmente 20 queries).

Loop, para k em 1..K:
1. A recebe o objetivo G e o histórico de pares (prompt, resposta) até agora.
2. A emite um novo prompt p_k.
3. Enviar p_k para T; receber resposta r_k.
4. J pontua (p_k, r_k) no objetivo.
5. Se pontuação >= limiar, parar — jailbreak encontrado.
6. Senão, anexar (p_k, r_k) ao histórico de A; continuar.

Resultado empírico (NeurIPS 2023): >50% de taxa de sucesso de ataque contra GPT-3.5-turbo, Llama-2-7B-chat; média de queries até sucesso na faixa de 10-20.

### Por que PAIR é eficiente

GCG (Zou et al. 2023) busca sobre sufixos de tokens adversariais por gradiente; requer acesso white-box ao modelo e produz sufixos ilegíveis. PAIR é black-box e produz ataques em linguagem natural que transferem entre modelos. O feedback in-context de PAIR permite que o atacante aprenda de cada rejeição; GCG não tem equivalente (cada atualização de token precisa redescobrir progresso anterior).

### Ataques automatizados relacionados

- **GCG (Zou et al. 2023, arXiv:2307.15043).** Busca por gradiente em nível de token para sufixos adversariais. White-box, transferível, produz strings ilegíveis.
- **AutoDAN (Liu et al. 2023).** Busca evolutiva sobre prompts, guiada por objetivo hierárquico.
- **TAP (Mehrotra et al. 2024).** Tree-of-attacks com poda — ramifica múltiplos rollouts estilo PAIR.
- **PAP (Zeng et al. 2024).** Persuasive Adversarial Prompts — codifica técnicas de persuasão humana como templates de prompt.

### JailbreakBench e HarmBench

Ambos (2024) padronizam avaliação:

- JailbreakBench (arXiv:2404.01318). 100 comportamentos prejudiciais em 10 categorias de política OpenAI. Taxa de sucesso de ataque (ASR) como métrica principal. Requer um juiz (GPT-4-turbo, Llama Guard ou StrongREJECT).
- HarmBench (Mazeika et al. 2024). 510 comportamentos em 7 categorias, com testes de dano semântico e funcional. Compara 18 ataques contra 33 modelos.

ASR normalmente é reportado em orçamento de queries fixo. Comparar ataques requer orçamentos equivalentes; 90% ASR em 200 queries não é comparável com 85% ASR em 20.

### Por que importa para deployments em 2026

Todo laboratório fronteira agora executa PAIR e TAP contra modelos de produção antes do release. Curvas de ASR aparecem em model cards (Lição 26) e anexos de safety-case (Lição 18). O ataque não é exótico — é infraestrutura padrão.

### Onde isso se encaixa na Fase 18

Lição 12 é a base de ataques automatizados. Lição 13 (Many-Shot Jailbreaking) é um exploit de comprimento complementar. Lição 14 (ASCII Art / Visual) é um ataque de codificação. Lição 15 (Indirect Prompt Injection) é a superfície de ataque de produção em 2026. Lição 16 cobre as contrapartes de ferramentagem defensiva (Llama Guard, Garak, PyRIT).

## Use

`code/main.py` constrói um loop PAIR simulado. O alvo é um classificador simulado que recusa prompts "óbvios" prejudiciais (filtro de palavras-chave). O atacante é um refinador baseado em regras que tenta paráfrase, roleplay-framing e codificação. O juiz pontua a resposta. Você observa o atacante conseguir em ~5-15 iterações contra o filtro de palavras-chave e falhar contra um filtro semântico.

## Entregue

Essa lição gera `outputs/skill-attack-audit.md`. Dado um relatório de avaliação de red-team, audita: quais ataques foram executados (PAIR, GCG, TAP, AutoDAN, PAP), com qual orçamento cada um, com qual juiz, em qual conjunto de comportamentos prejudiciais (JailbreakBench, HarmBench, interno).

## Exercícios

1. Execute `code/main.py`. Meça a média de queries até sucesso para as três estratégias de atacante embutidas. Explique qual assunção de defesa contra-alvo cada uma explora.

2. Implemente uma quarta estratégia de atacante (por exemplo, tradução para outro idioma, codificação base64). Reporte a nova média de queries até sucesso contra o alvo de filtro por palavras-chave e contra o alvo de filtro semântico.

3. Leia Chao et al. 2023 Figura 5 (comparação PAIR vs GCG). Descreva dois cenários onde GCG é preferido apesar da vantagem de eficiência do PAIR.

4. JailbreakBench reporta ASR contra um conjunto de objetivos fixo. Projete uma métrica adicional que meça diversidade de ataque (variância em prompts bem-sucedidos). Explique por que diversidade importa para avaliação de defesa.

5. TAP (Mehrotra 2024) estende PAIR com ramificação + poda. Esboce uma extensão estilo TAP para `code/main.py` e descreva o trade-off de custo computacional vs taxa de sucesso.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| PAIR | "jailbreak automatizado" | Prompt Automatic Iterative Refinement; loop LLM-atacante + LLM-juiz |
| GCG | "jailbreak por gradiente" | Busca white-box por gradiente em nível de token para sufixos adversariais |
| Taxa de sucesso de ataque (ASR) | "% de jailbreaks em k queries" | Métrica principal; deve ser reportada com orçamento de queries e identidade do juiz |
| LLM-juiz | "o avaliador" | LLM que avalia se uma resposta satisfaz o objetivo prejudicial |
| JailbreakBench | "a avaliação" | Conjunto padronizado de comportamentos prejudiciais com categorias taggeadas |
| HarmBench | "o bench mais amplo" | 510 comportamentos, testes funcionais + semânticos |
| TAP | "árvore de ataques" | PAIR com ramificação + poda; melhor ASR com mais compute |

## Leitura Complementar

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — paper PAIR, NeurIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) — paper GCG
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318) — avaliação padronizada
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249) — avaliação mais ampla
