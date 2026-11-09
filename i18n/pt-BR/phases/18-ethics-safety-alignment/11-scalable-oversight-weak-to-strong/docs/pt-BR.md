# Supervisão Escalarável e Generalização Fraca a Forte

> Burns et al. (OpenAI Superalignment, "Generalização fraca a forte", 2023) propôs um proxy para o problema de superalignment: ajustar um modelo forte usando rótulos produzidos por um modelo mais fraco. Se o modelo forte generaliza corretamente a partir da supervisão fraca imperfeita, os métodos atuais de alinhamento em escala humana podem se estender a sistemas sobre-humanos. A supervisão escalável e o W2SG são complementares. A supervisão escalável (debate, modelagem recorrente de recompensas, decomposição de tarefas) aumenta a capacidade eficaz do superintendente para que possa acompanhar o modelo sob supervisão. O W2SG garante que o modelo forte generaliza corretamente qualquer supervisão imperfeita que o superintendente forneça. O debate ajuda o W2SG (arXiv:2501.13124, janeiro 2025) combina-os.

**Type:** Learn
**Languages:** Python (stdlib, W2SG gap simulator), TypeScript
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 18 · 10 (AI Control), Phase 09 (RL foundations)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Defina a supervisão escalável e a generalização fraca a forte e explique como são complementares.
- Descreva a configuração experimental de Burns et al. 2023: ajuste fino do GPT-4 usando rótulos do GPT-2.
- Explicar a métrica de diferença de desempenho recuperada (PGR) e o que ela mede.
- Indique os três principais mecanismos de supervisão escalável (debate, modelagem recorrente de recompensas, decomposição de tarefas) e um ponto forte de cada um.

## O problema

Cada técnica de alinhamento até agora na Fase 18 assume que o supervisor pode avaliar o comportamento do modelo. Quando o modelo é super-humano, o supervisor é o elo fraco. A questão de supera alinhamento: um supervisor mais fraco pode produzir com confiança um modelo mais forte e alinhado?

Burns et al. reduzem isso a uma configuração empírica operacional: supervisionar forte com fraco, medir quanto da capacidade do modelo forte sobrevive à supervisão fraca.

## O conceito

### W2SG: a configuração de Burns et al.

- Modelo fraco: classe GPT-2.
- Modelo forte: classe GPT-4.
- Objetivo: um limite de GPT-4 forte na tarefa.

Procedimento:
1. Obter as previsões de zero-shot do modelo fraco numa tarefa.
2. Ajustar o modelo forte em dados de marcas fracas.
3. Meter a precisão do modelo forte e perfeitamente ajustado.

Linhas de base: precisão do modelo fraco, limite supervisionado do modelo forte em etiquetas de ouro.

Metrica de diferença: Gap Recovered (PGR) = (finamente ajustado - fraco) / (loft - fraco). PGR de 1,0 significa que a supervisão fraca fecha completamente a diferença; PGR de 0 significa que a supervisão fraca não ajudou.

### Burns et al. Resultados empíricos

Em todas as tarefas de PNL, xadrez-puzzle e modelagem de recompensas, o PGR foi consistentemente positivo: o modelo forte generalizou-se além dos erros do supervisor fraco.

Limitações Burns et al. nota:
- A diferença entre fraco e forte aqui é a capacidade, não o alinhamento. O modelo fraco é alinhado; um modelo verdadeiramente sobre-humano pode ser alinhado por um humano, mas com uma diferença de capacidade muito maior.
- A generalização do modelo forte pode ser mais sobre as tarefas anteriores do que sobre a recuperação da intenção de verdade no fundo.
- A obtenção do conhecimento latente do modelo forte é o verdadeiro problema; a PGR mede uma operacionalização específica.

### Supervisão em escalabilidade: três mecanismos

- **Debate (Irving et al. 2018).**Dois casos de U argumentam lados opostos; o juiz fraco decide. A suposição: encontrar uma resposta verdadeira convincente é mais fácil do que encontrar uma resposta falsa convincente. O trabalho recente de 2024-2025 (Khan et al., Michael et al.) mostra que o debate às vezes ajuda e às vezes não, e se ajuda depende da estrutura da tarefa.
- **Recursive Reward Modeling (Leike et al. 2018).**A U ajuda o ser humano a treinar o modelo de recompensa para a U+1.
- **Task Decomposition (Christiano, Shlegeris, Amodei 2018).**Descompõe uma tarefa difícil em subtarefas que o ser humano pode verificar, recursivamente.

Cada mecanismo assume algo sobre a estrutura da tarefa ou o alinhamento dos componentes intermediários.

### Por que a supervisão escalável e o W2SG são complementares

A superintendência escalavel aumenta a qualidade do sinal eficaz do superintendente.
O W2SG fecha a lacuna de qualquer sinal imperfeito que o superintendente possa fornecer.

Lang et al.  Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124) combina-os: um protocolo de debate fornece melhores rótulos fracos, e o modelo forte é treinado nessas rótulos.

### O drama organizacional

A equipe de Superalinhamento da OpenAI foi dissolvida em maio de 2024 após a partida de Jan Leike para a Anthropic. A agenda (supervisão escaladora, W2SG, pesquisa de alinhamento automatizado) continuou na Anthropic e nos laboratórios acadêmicos  MATS (Lessão 28), Redwood (Lessão 10), Apollo (Lessão 8), METR (Lessão 28).

### Onde isto encaixa na Fase 18

As lições 6-10 descrevem a ameaça e o paradigma defensivo sob a suposição de que U é improvável. A lição 11 é o paradigma ofensivo: fazer com que o supervisor seja forte o suficiente para verificar o alinhamento de U. As lições 12-16 então se voltam para a ferramenta prática de avaliação adversária.

```figure
scalable-oversight
```

## Usá-lo

`code/main.py`Simula uma sintonia W2SG em uma tarefa sintética. O etiquetador fraco tem 70% de precisão com erros estruturados; o modelo forte tem um teto de 95% em etiquetas de ouro.

## Envia-o

Esta lição produz`outputs/skill-w2sg-pgr.md`. Dada uma descrição da configuração de supervisão, identifica o supervisor fraco, o modelo forte, a qualidade da supervisão e calcula (ou solicita) a PGR. Marca se a alegação é "fraco pode supervisionar forte" ou "fraco + mecanismo de supervisão pode supervisionar forte".

## Exercícios

1. Corra .`code/main.py`. Relata PGR para fraca_acuração = 0,60, 0,70, 0,80. Explique a forma da curva PGR.

2. Modificar o rotulador fraco para ter um erro estruturado (por exemplo, sempre errado em uma classe de entrada específica). Aumente, diminui ou permanece a mesma PGR? Explique.

3. Leia Burns et al. 2023 Secção 4.3 (Tasks NLP). Reproduzir a intuição de "perda auxiliar de confiança": quando o modelo forte é mais confiante do que os rótulos fracos, quem ganha?

4. Desenhar um protocolo de supervisão escalável que combina debate e decomposição de tarefas para uma tarefa de engenharia de software. Nomear um modo de falha de cada componente e explicar como a combinação resolve ou não resolve cada um.

5. Articular o que falsificaria a afirmação de que "a generalização fraca a forte é um caminho viável para a superaligação".

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Scalable oversight | "making the overseer stronger" | Mechanisms that increase an overseer's ability to evaluate a more-capable model |
| W2SG | "weak supervises strong" | Fine-tuning a strong model on weak labels and measuring the capability recovered |
| PGR | "performance gap recovered" | (fine-tuned - weak) / (ceiling - weak); 1.0 = fully closed, 0 = no help |
| Debate | "two U instances argue" | Scalable oversight mechanism where a weak judge picks between two U defenders |
| RRM | "recursive reward modeling" | U helps train the reward model for U+1; overseer capability tracks U |
| Task decomposition | "sub-tasks the human checks" | Break a hard task into sub-tasks the human can verify, recursively |
| Superalignment | "aligning superhuman AI" | The research agenda concerned with aligning models the human cannot directly evaluate |

## Mais leitura

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) O papel W2SG
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) o mecanismo de debate
- [Leike et al. — Scalable agent alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) Modelagem recorrente de recompensas
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) 2024 Estudo empírico do debate com debatedores mais fortes
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) 2025 combinação de debates + W2SG
