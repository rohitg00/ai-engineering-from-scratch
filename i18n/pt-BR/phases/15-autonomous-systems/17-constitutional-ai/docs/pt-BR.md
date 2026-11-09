# Artificial inteligência e regra constitucionais são suprimidos

> A 22 de janeiro de 2026 Claude Constitution da Anthropic tem 79 páginas e é CC0. O programa passa de uma alinhamento baseado em regras para um alinhamento baseado em razão e estabelece uma hierarquia de prioridade de quatro níveis: (1) segurança e apoio à supervisão humana, (2) ética, (3) orientações antropológicas, (4) utilidade. Os comportamentos divididos em proibições codificadas (lifting bioweapons, CSAM) que os operadores e os utilizadores não podem anular e padrões de codificação suave que os operadores podem ajustar dentro de limites definidos. O original de 2022 (Bai et al.) treinou a inofensividade através da autocrítica e RLAIF contra uma constituição. A advertença honesta: o alinhamento baseado na razão depende do modelo que generaliza os princípios para situações inesperadas. O próprio experimento participativo da Anthropic em 2023 mostrou ~50% de divergência entre os princípios de fontes públicas e corporativas; a versão de 2026 não incorporou essas descobertas.

**Type:** Learn
**Languages:** Python (stdlib, four-tier priority resolver), TypeScript
**Prerequisites:** Phase 15 · 06 (Automated alignment research), Phase 15 · 10 (Permission modes)
**Time:** ~60 minutes

## O problema

Um agente de campo vê entradas que seus designers nunca viram. Nenhuma lista de regras é longa o suficiente para cobrir elas. Nenhuma lista de regras é curta o suficiente para aplicar rapidamente sob pressão computacional. A questão prática: como alinhar um agente a princípios que sobrevivem tanto uma longa cauda de casos quanto uma inferência rápida?

Alinhamento baseado em regras (RBA): lista todas as coisas proibidas. Rápido de verificar, fácil de auditar, impossível de manter atualizado, muitas vezes recusa demais em análogos próximos que não antecipou. Alinhamento baseado em razão (a Constituição de Claude de 2026): codifique princípios, deixe o modelo raciocinar. Escalas em casos invisíveis, mais difíceis de auditoria, modo de falha é a má aplicação de princípios em vez de perder a regra.

A Constituição de 2026 assume uma posição de meio. Proibições codificadas  coisas cuja erroneidade não depende do contexto (reforço de armas biológicas, CSAM)  são RBA: nunca, independentemente da instrução do operador ou do usuário. Tudo o resto é baseado na razão dentro de uma hierarquia de quatro níveis: segurança e apoio à supervisão humana em primeiro lugar; ética em segundo lugar; diretrizes declaradas pelo Antropic em terceiro lugar; ajuda em último lugar. Os operadores podem ajustar as definições padrão dentro da zona de código macio, mas não podem tocar as proibições de código duro.

## O conceito

### A hierarquia de prioridades de quatro níveis

1. **Safety and supporting human oversight.**O modelo priorizou não minar a capacidade dos seres humanos e da Anthropic de supervisionar e corrigir a IA. Isso não é "ser cauteloso"; é especificamente "não agir de forma a tornar a supervisão humana mais difícil".
2. **Ethics.**Honestidade, evitar danos a pessoas, não enganar, não manipular, supera as diretrizes da Anthropic quando há conflitos.
3. **Anthropic guidelines.**Normas operacionais A Anthropic decidiu o assunto: o escopo do produto, os padrões de interação, quais ferramentas usar quando.
4. **Helpfulness.**Ser o mais útil possível dentro das prioridades mais elevadas.

Quando os níveis se confrontam, ganha-se um nível superior. Esta é a mesma forma que as prioridades Unix ou o QoS de rede.

### Proibições de código rígido versus padrões de código macio

**Hardcoded:**
- Armas biológicas / aumento do RBCN
- CSAM
- Ataques contra infraestruturas críticas
- Engano dos utilizadores sobre a identidade do modelo quando perguntados diretamente

O operador não pode anular estes. O usuário não pode anular estes. Eles são aplicados no nível de modelos-pesos quando possível (treinamento de IA RLHF / Constitucional) e na camada de inferência quando não.

**Soft-coded defaults (operator-adjustable):**
- Longo de resposta padrão
- Ámbito de aplicação (o modelo pode recusar tópicos fora da implantação do operador)
- Estilo (formal vs casual)
- Padrões de utilização de ferramentas

Os ajustes do operador ocorrem dentro de um limite declarado. O operador não pode remover as proibições codificadas com código rígido, rebatizando-as.

### O treinamento CAI de 2022

A IA constitucional original (Bai et al., 2022) treinou a inofensividade:

1. Gerenar respostas a um conjunto de instruções.
2. Peça ao modelo que critique cada resposta contra uma constituição (principios explícitos).
3. Revisar a resposta com base na crítica.
4. RLAIF (aprendizagem de reforço a partir de feedback de IA) sobre os pares revisados.

Resultado: um modelo que recusa pedidos prejudiciais com explicações de princípio, não recusa geral. A Constituição de 2026 usa um descendente deste treinamento mais pós-treinamento adicional na hierarquia de níveis explícitos.

### Que alinhamento baseado na razão pega e perde

**Catches:**
- Combinações inesperadas de primitivas permitidas onde o princípio se aplica claramente.
- Novas solicitações que são análogas às proibidas.
- Ataques de engenharia social que contam com "você não disse que o X era proibido".

**Misses:**
- Ataques que exploram a ambiguidade do princípio ("o usuário pediu isso para que a utilidade diga sim").
- Cenários em que dois princípios se confrontam de forma inesperada e a ordem de níveis é ambígua.
- A interpretação de princípio de "deslocamento lento" sobre ciclos de formação (reinterpretação).

### O experimento participativo de 2023

A Anthropic realizou uma experiência de 2023 comparando uma constituição de autor corporativo com uma gerada por meio de entrada pública (~ 1.000 entrevistados dos EUA). As duas versões concordaram em ~50% dos princípios. Onde divergiam, a versão de fontes públicas era mais restritiva em algumas questões (tratamento de conteúdo político) e menos restritiva em outras (auto-revelação da identidade da IA). A Constituição de 2026 não incorporou as conclusões de fontes públicas. Esta é uma tensão documentada na abordagem.

### Por que são necessárias proibições codificadas

O alinhamento baseado em razão por si só não pode fechar a cauda. Um atacante que pode fazer o modelo aceitar uma premissa (por exemplo, "somos um laboratório de pesquisa de armas biológicas licenciado") pode muitas vezes falar sobre princípios que dependem do raciocínio do caso.

### Onde a Constituição está na pilha

A Constituição não é o interruptor de morte da lição 14. Ele vive na camada do modelo: o que os pesos do modelo são treinados para preferir. Os interruptores de extinção e os tokens canários estão em tempo real: o que o tempo de extinção permite. São necessárias ambas as coisas. Um tempo de execução que dispara todas as ações erradas porque os pesos do modelo são permissivos é um problema de tempo de execução. Um modelo que recusa todas as ações corretas porque o tempo de execução é demasiado restritivo é um problema de tempo de execução. As camadas cobrem diferentes classes.

```figure
mx-priority-tiers
```

## Usá-lo

`code/main.py`O resolvedor leva uma ação proposta e um conjunto de avaliações de princípios (segurança, ética, diretrizes, utilidade) e retorna a ação, uma recusa ou uma ação modificada. O motorista executa um pequeno conjunto de casos: permitimento claro, proibição clara, proibição codificada, caso ambíguo entre as camadas.

## Envia-o

`outputs/skill-constitution-review.md`Audita a camada constitucional de uma implementação: o que é codificado em hard, o que é soft-coded, onde o operador pode ajustar e se a hierarquia de quatro níveis é realmente a ordem de resolução.

## Exercícios

1. Corra .`code/main.py`- Confirmar os incêndios de proibição codificados, mesmo quando a utilidade é alta. Modificar o resolutor para ponderar a utilidade acima da ética; observar o modo de falha.

2. Leia a Constituição de Claude (público, 79 páginas, CC0). Identifique um princípio que acredite ser pouco especificado.

3. Desenhe um conjunto padrão de código macio para um agente de suporte ao cliente. O que o operador ajusta? O que o operador não pode tocar? Justifique cada limite.

4. Leia o artigo da CAI de 2022 da Bai et al. Descreva um caso em que o ciclo de crítica e revisão da IA constitucional produziria um resultado pior do que uma regra geral. Identifique a classe.

5. O experimento participativo de 2023 da Anthropic descobriu ~ 50% de divergência entre os princípios públicos e corporativos. Escolha uma categoria onde isso importa para a implantação da produção (por exemplo, neutralidade política). Propõe um projeto que permita aos operadores expressar seus próprios valores enquanto as proibições codificadas permanecem intocadas.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| Constitutional AI | "Anthropic's alignment method" | Self-critique + RLAIF against a written constitution |
| Reason-based alignment | "Principles, not rules" | Model reasons over principles to handle unseen cases |
| Hardcoded prohibition | "Never do X" | Rule-based prohibition no operator or user can override |
| Soft-coded default | "Operator-adjustable" | Behaviour within a declared bound, operator controls |
| Four-tier hierarchy | "Priority order" | safety > ethics > guidelines > helpfulness |
| RLAIF | "AI feedback RL" | RL where the reward comes from model-generated critiques |
| Participatory constitution | "Public-sourced principles" | 2023 Anthropic experiment; ~50% divergence from corporate |
| Principle drift | "Interpretation slip" | Slow change in how the model reads a fixed principle text |

## Mais leitura

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) o documento CC0 de 79 páginas.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback)2022 original.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) Experimento participativo.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) onde a Constituição está na pilha de RSP.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) O papel da Constituição nas operações de longo prazo.
