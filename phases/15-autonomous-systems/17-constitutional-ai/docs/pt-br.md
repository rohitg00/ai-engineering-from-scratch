# Constitutional AI e Sobrescritas de Regras

> A Constituição do Claude da Anthropic de 22 de janeiro de 2026 tem 79 páginas e é CC0. Ela muda de alinhamento baseado em regras para baseado em raciocínio e estabelece uma hierarquia de prioridades de quatro níveis: (1) segurança e suporte a supervisão humana, (2) ética, (3) diretrizes da Anthropic, (4) utilidade. Comportamentos se dividem em proibições hardcoded (armas biológicas, CSAM) que operadores e usuários não podem sobrescrever e padrões soft-coded que operadores podem ajustar dentro de limites definidos. O original de 2022 (Bai et al.) treinou inofensividade via auto-crítica e RLAIF contra uma constituição. A ressalva honesta: alinhamento baseado em raciocínio depende do modelo generalizar princípios para situações não previstas. O experimento participativo de 2023 da Anthropic mostrou ~50% de divergência entre princípios baseados em público e corporativos; a versão de 2026 não incorporou esses achados.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, resolvedor de prioridade de quatro níveis)
**Pré-requisitos:** Fase 15 · 06 (Pesquisa de alinhamento automatizada), Fase 15 · 10 (Modos de permissão)
**Tempo:** ~60 minutos

## O Problema

Um agente implantado vê entradas que seus projetistas nunca viram. Nenhuma lista de regras é longa o suficiente para cobri-las. Nenhuma lista de regras é curta o suficiente para aplicar rapidamente sob pressão de compute. A questão prática: como alinhar um agente a princípios que sobrevivam tanto a uma cauda longa de casos quanto a inferência rápida?

Alinhamento baseado em regras (RBA): listar tudo que não é permitido. Rápido de verificar, fácil de auditar, impossível de manter atualizado, frequentemente recusa em excesso em análogos próximos que não antecipou. Alinhamento baseado em raciocínio (Constituição do Claude de 2026): codificar princípios, deixar o modelo raciocinar. Escala em casos não vistos, mais difícil de auditar, modo de falha é má-aplicação de princípios em vez de perder a regra.

A Constituição de 2026 toma uma posição intermediária explícita. Proibições hardcoded — coisas cuja erridez não depende de contexto (armas biológicas, CSAM) — são RBA: nunca, independente de instrução de operador ou usuário. Tudo mais é baseado em raciocínio dentro de uma hierarquia de quatro níveis: segurança e suporte a supervisão humana primeiro; ética segundo; diretrizes declaradas pela Anthropic terceiro; utilidade por último. Operadores podem ajustar padrões dentro da zona soft-coded mas não tocar nas proibições hardcoded.

## O Conceito

### A hierarquia de prioridades de quatro níveis

1. **Segurança e suporte à supervisão humana.** Maior. O modelo prioriza não minar a capacidade de humanos e da Anthropic de supervisionar e corrigir IA. Não é "seja cauteloso"; é eespecificaçãoificamente "não aja de formas que tornem a supervisão humana mais difícil."
2. **Ética.** Honestidade, evitar dano a pessoas, não enganar, não manipular. Prevalece sobre as diretrizes da Anthropic quando conflitam.
3. **Diretrizes da Anthropic.** Normas operacionais que a Anthropic decidiu que importam: escopo do produto, padrões de interação, quando usar quais ferramentas.
4. **Utilidade.** Menor. Ser o mais útil possível dentro das prioridades superiores.

Quando níveis conflitam, o superior vence. Essa é a mesma forma que prioridades Unix ou QoS de rede — o enquadramento visa produzir resolução previsível, necessariamente o melhor comportamento em qualquer eixo isolado.

### Proibições hardcoded vs padrões soft-coded

**Hardcoded:**
- Armas biológicas / CBRN uplift
- CSAM
- Ataques a infraestrutura crítica
- Engano de usuários sobre a identidade do modelo quando perguntado diretamente

O operador não pode sobrescrever isso. O usuário não pode sobrescrever isso. São aplicados no nível de pesos do modelo onde possível (treinamento RLHF / Constitutional AI) e na camada de inferência onde não.

**Padrões soft-coded (ajustáveis pelo operador):**
- Padrões de tamanho de resposta
- Escopo temático (o modelo pode recusar tópicos fora do implantação do operador)
- Estilo (formal vs casual)
- Padrões de uso de ferramentas

Ajustes do operador acontecem dentro de um limite declarado. O operador não pode remover as proibições hardcoded renomeando-as.

### O treinamento CAI de 2022

O Constitutional AI original (Bai et al., 2022) treinou inofensividade:

1. Gerar respostas para um conjunto de prompts.
2. Pedir ao modelo que critique cada resposta contra uma constituição (princípios explícitos).
3. Revisar a resposta com base na crítica.
4. RLAIF (aprendizado por reforço com feedback de IA) nos pares revisados.

Resultado: um modelo que recusa pedidos prejudiciais com explicações baseadas em princípios, não recusas em bloco. A Constituição de 2026 usa um descendente deste treinamento mais treinamento adicional na hierarquia de níveis explícita.

### O que alinhamento baseado em raciocínio pega e perde

**Pega:**
- Combinações não antecipadas de primitivas permitidas onde o princípio se aplica claramente.
- Pedidos novos que são análogos próximos de proibidos.
- Ataques de engenharia social que dependem de "você não disse que X não era permitido."

**Perde:**
- Ataques que exploram ambiguidade de princípios ("o usuário pediu isso então utilidade diz sim").
- Cenários onde dois princípios conflitam de forma não antecipada, e a ordem de níveis é ambígua.
- Deriva lenta na interpretação de princípios ao longo de ciclos de treinamento (reinterpretação).

### O experimento participativo de 2023

A Anthropic rodou um experimento em 2023 comparando uma constituição redigida por empresa a uma gerada via input público (~1.000 respondentes dos EUA). As duas versões concordaram em ~50% dos princípios. Onde divergiram, a versão baseada em público era mais restritiva em algumas questões (tratamento de conteúdo político) e menos em outras (auto-revelação de identidade de IA). A Constituição de 2026 não incorporou os achados baseados em público. Essa é uma tensão documentada na abordagem.

### Por que proibições hardcoded são necessárias

Alinhamento baseado em raciocínio sozinho não consegue fechar a cauda. Um atacante que consegue fazer o modelo aceitar uma premissa (ex: "somos um laboratório licenciado de pesquisa em armas biológicas") frequentemente consegue conversar para além de princípios que dependem de raciocínio por caso. Proibições hardcoded não cedem a enquadramento de premissa. São o "limite constitucional rígido" da Aula 14 na camada de alinhamento.

### Onde a Constituição se encaixa na stack

A Constituição não é o interruptor de emergência da Aula 14. Ela vive na camada do modelo: o que os pesos do modelo são treinados para preferir. Interruptores de emergência e tokens canary vivem na camada de runtime: o que o runtime permite. Ambos são necessários. Um runtime que dispara todas as ações erradas porque os pesos do modelo são permissivos é um problema de runtime. Um modelo que recusa todas as ações certas porque o runtime é super-restritivo é um problema de runtime. Camadas cobrem diferentes classes.

## Use

`code/main.py` implementa um resolvedor mínimo de prioridade de quatro níveis. O resolvedor pega uma ação proposta e um conjunto de avaliações de princípios (segurança, ética, diretrizes, utilidade) e retorna a ação, uma recusa ou uma ação modificada. O driver roda um pequeno conjunto de casos: permitido claro, não permitido claro, proibição hardcoded, caso ambíguo entre níveis.

## Entregue

`outputs/skill-constitution-review.md` audita a camada constitucional de um deploy: o que é hardcoded, o que é soft-coded, onde o operador pode ajustar, e se a hierarquia de quatro níveis é realmente a ordem de resolução.

## Exercícios

1. Rode `code/main.py`. Confirme que a proibição hardcoded dispara mesmo quando utilidade é alta. Modifique o resolvedor para pesar utilidade acima de ética; observe o modo de falha.

2. Leia a Constituição do Claude (pública, 79 páginas, CC0). Identifique um princípio que você acha sub-eespecificaçãoificado. Escreva dois parágrafos explicando a ambiguidade eespecificaçãoífica e propondo uma formulação mais apertada.

3. Projete um conjunto de padrões soft-coded para um agente de suporte ao cliente. O que o operador ajusta? O que o operador não pode tocar? Justifique cada limite.

4. Leia o paper CAI de Bai et al. 2022. Descreva um caso onde o loop de crítica-e-revisão do Constitutional AI produziria um resultado pior que uma regra genérica. Identifique a classe.

5. O experimento participativo de 2023 da Anthropic encontrou ~50% de divergência entre princípios públicos e corporativos. Escolha uma categoria onde isso importa para implantação em produção (ex: neutralidade política). Proponha um design que permita aos operadores expressar seus próprios valores enquanto as proibições hardcoded permanecem intocáveis.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Constitutional AI | "Método de alinhamento da Anthropic" | Auto-crítica + RLAIF contra uma constituição escrita |
| Alinhamento baseado em raciocínio | "Princípios, não regras" | Modelo raciocina sobre princípios para lidar com casos não vistos |
| Proibição hardcoded | "Nunca fazer X" | Proibição baseada em regra que nenhum operador ou usuário pode sobrescrever |
| Padrão soft-coded | "Ajustável pelo operador" | Comportamento dentro de um limite declarado, operador controla |
| Hierarquia de quatro níveis | "Ordem de prioridade" | segurança > ética > diretrizes > utilidade |
| RLAIF | "RL com feedback de IA" | RL onde a recompensa vem de críticas geradas por modelo |
| Constituição participativa | "Princípios baseados em público" | Experimento Anthropic 2023; ~50% de divergência do corporativo |
| Deriva de princípio | "Escorregão de interpretação" | Mudança lenta em como o modelo lê um texto de princípio fixo |

## Leituras Adicionais

- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution) — o documento de 79 páginas CC0.
- [Bai et al. — Constitutional AI: Harmlessness from AI Feedback](https://www.anthropic.com/research/constitutional-ai-harmlessness-from-ai-feedback) — original de 2022.
- [Anthropic — Collective Constitutional AI (2023)](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input) — experimento participativo.
- [Anthropic — Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — onde a Constituição se encaixa na stack do RSP.
- [Anthropic — Measuring agente autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — papel da Constituição em deploys de longo prazo.
