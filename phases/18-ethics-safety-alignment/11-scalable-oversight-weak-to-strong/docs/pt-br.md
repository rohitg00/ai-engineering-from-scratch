# Supervisão Escalável e Generalização de Fraco para Forte

> Burns et al. (OpenAI Superalignment, "Weak-to-Strong Generalization", 2023) propuseram um proxy para o problema de superalinhamento: fine-tune de um modelo forte usando rótulos produzidas por um modelo mais fraco. Se o modelo forte generaliza corretamente a partir de supervisão fraca imperfeita, os métodos atuais de alinhamento em escala humana podem se estender a sistemas superhumanos. Supervisão escalável e W2SG são complementares. Supervisão escalável (debate, modelagem recursiva de recompensa, decomposição de tarefas) aumenta a capacidade efetiva do supervisor para que ele acompanhe o modelo sob supervisão. W2SG garante que o modelo forte generaliza corretamente a partir de qualquer supervisão imperfeita que o supervisor fornecer. Debate Helps W2SG (arXiv:2501.13124, janeiro de 2025) combina os dois.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de gap W2SG)
**Pré-requisitos:** Fase 18 · 01 (seguimento de instruções), Fase 18 · 10 (Controle de IA), Fase 09 (fundamentos de RL)
**Tempo:** ~60 minutos

## Objetivos de Aprendizagem

- Definir supervisão escalável e generalização de fraco para forte e explicar como são complementares.
- Descrever o setup experimental de Burns et al. 2023: fine-tune de GPT-4 usando rótulos de GPT-2.
- Explicar a métrica Performance Gap Recovered (PGR) e o que ela mede.
- Enumerar os três mecanismos principais de supervisão escalável (debate, modelagem recursativa de recompensa, decomposição de tarefas) e uma vantagem de cada um.

## O Problemo

Toda técnica de alinhamento até agora na Fase 18 assume que o supervisor consegue avaliar o comportamento do modelo. Quando o modelo é superhumano, o supervisor é o elo fraco. A questão de superalinhamento: um supervisor mais fraco consegue produzir de forma confiável um modelo mais forte e alinhado?

Burns et al. reduzem isso a um setup empírico operacionalizado: supervisionar o forte com o fraco, medir quanta da capacidade do modelo forte sobrevive à supervisão fraca. Isso não é uma solução para superalinhamento — é um proxy que nos permite medir progresso.

## O Conceito

### W2SG: o setup de Burns et al.

- Modelo fraco: classe GPT-2.
- Modelo forte: classe GPT-4.
- Alvo: o teto do GPT-4 forte na tarefa.

Procedimento:
1. Obter as previsões zero-shot do modelo fraco em uma tarefa.
2. Fine-tune do modelo forte com dados rotulados pelo fraco.
3. Medir a acurácia do modelo forte após fine-tune.

Baselines: acurácia do próprio modelo fraco, teto supervisionado do modelo forte com rótulos gold.

Métrica de gap: Performance Gap Recovered (PGR) = (fine-tune - fraco) / (teto - fraco). PGR de 1.0 significa que a supervisão fraca fecha completamente o gap; PGR de 0 significa que não ajudou.

### Achados empíricos de Burns et al.

Em tarefas de NLP, puzzles de xadrez e modelagem de recompensa, o PGR foi consistentemente positivo: o modelo forte generalizou além dos erros do supervisor fraco. PGR por tarefa variou de ~20% a ~80%. O modelo forte "entende" a tarefa pretendida a partir de rótulos imperfeitas, completando com seus priors pré-treinados.

Limitações que Burns et al. notam:
- O gap de fraco para forte aqui é de capacidade, não de alinhamento. O modelo fraco é alinhado; um modelo verdadeiramente superhumano poderia ser alinhado por um humano mas com um gap de capacidade muito maior.
- A generalização do modelo forte pode ser mais sobre priors de tarefa do que sobre recuperar a intenção real.
- Elicitar o conhecimento latente do modelo forte é o problema real; PGR mede uma operacionalização eespecificaçãoífica.

### Supervisão escalável: três mecanismos

- **Debate (Irving et al. 2018).** Duas instâncias de U defendem lados opostos; o juiz fraco decide. A assunção: encontrar uma resposta verdadeira convincente é mais fácil do que encontrar uma falsa convincente. Trabalho recente (2024-2025) de Khan et al. e Michael et al. mostra que debate às vezes ajuda e às vezes não, e se ajuda depende da estrutura da tarefa.
- **Modelagem Recursiva de Recompensa (Leike et al. 2018).** U ajuda o humano a treinar o modelo de recompensa para U+1. A capacidade efetiva do supervisor cresce com a do modelo.
- **Decomposição de Tarefas (Christiano, Shlegeris, Amodei 2018).** Decompor uma tarefa difícil em sub-tarefas que o humano pode verificar, recursivamente. Assume decomposabilidade.

Cada mecanismo assume algo sobre a estrutura da tarefa ou o alinhamento dos componentes intermediários.

### Por que supervisão escalável e W2SG são complementares

Supervisão escalável aumenta a qualidade efetiva do sinal do supervisor.
W2SG fecha o gap a partir de qualquer sinal imperfeito que o supervisor puder fornecer.

Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124) combina os dois: um protocolo de debate fornece melhores rótulos fracas, e o modelo forte é treinado com esses rótulos. Ganhos de PGR reportados em tarefas de NLP.

### O drama organizacional

A equipe de Superalignment da OpenAI foi dissolvida em maio de 2024 após a saída de Jan Leike para a Anthropic. A agenda (supervisão escalável, W2SG, pesquisa de alinhamento automatizado) continuou na Anthropic e em laboratórios acadêmicos — MATS (Lição 28), Redwood (Lição 10), Apollo (Lição 8), METR (Lição 28). A estrutura organizacional mudou; as questões de pesquisa não.

### Onde isso se encaixa na Fase 18

Lição 6-10 descrevem a ameaça e o paradigma defensivo sob a assunção de que U é não-confiável. Lição 11 é o paradigma ofensivo: tornar o supervisor forte o suficiente para verificar o alinhamento de U. Lições 12-16 então passam para a ferramentagem prática de avaliação adversarial.

## Use

`code/main.py` simula um fine-tune W2SG em uma tarefa sintética. O rotulador fraco tem 70% de acurácia com erros estruturados; o modelo forte tem teto de 95% com rótulos gold. Você faz fine-tune do modelo forte com rótulos fracas, mede PGR, e compara com forte-gold e fraco-sozinho.

## Entregue

Essa lição gera `outputs/skill-w2sg-pgr.md`. Dada uma descrição de setup de supervisão, identifica o supervisor fraco, o modelo forte, a qualidade da supervisão, e calcula (ou solicita) PGR. Sinaliza se a afirmação é "fraco pode supervisionar forte" ou "fraco + mecanismo de supervisão pode supervisionar forte."

## Exercícios

1. Execute `code/main.py`. Reporte PGR para weak_accuracy = 0.60, 0.70, 0.80. Explique o formato da curva de PGR.

2. Modifique o rotulador fraco para ter erros estruturados (por exemplo, sempre errado em uma classe de input eespecificaçãoífica). PGR aumenta, diminui ou fica igual? Explique.

3. Leia Burns et al. 2023 Seção 4.3 (tarefas de NLP). Reproduza a intuição de "confiança auxiliar loss": quando o modelo forte é mais confiante que as rótulos fracas, quem vence?

4. Projete um protocolo de supervisão escalável que combine debate e decomposição de tarefas para uma tarefa de engenharia de software. Nomeie um modo de falha de cada componente e explique como a combinação resolve — ou não resolve — cada um.

5. Articule o que falsificaria a afirmação de que "generalização de fraco para forte é um caminho viável para superalinhamento." Seja eespecificaçãoífico sobre a assinatura empírica que você precisaria ver.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| Supervisão escalável | "tornar o supervisor mais forte" | Mecanismos que aumentam a capacidade do supervisor de avaliar um modelo mais capaz |
| W2SG | "fraco supervisiona forte" | Fine-tune de um modelo forte com rótulos fracas medendo a capacidade recuperada |
| PGR | "performance gap recovered" | (fine-tune - fraco) / (teto - fraco); 1.0 = totalmente fechado, 0 = sem ajuda |
| Debate | "duas instâncias de U discutem" | Mecanismo de supervisão escalável onde um juiz fraco escolhe entre dois defensores U |
| RRM | "modelagem recursiva de recompensa" | U ajuda a treinar o modelo de recompensa para U+1; capacidade do supervisor acompanha U |
| Decomposição de tarefas | "sub-tarefas que o humano verifica" | Quebrar uma tarefa difícil em sub-tarefas que o humano pode verificar, recursivamente |
| Superalignment | "alinhando IA superhumana" | A agenda de pesquisa preocupada com alinhamento de modelos que o humano não consegue avaliar diretamente |

## Leitura Complementar

- [Burns et al. — Weak-to-Strong Generalization (OpenAI 2023)](https://openai.com/index/weak-to-strong-generalization/) — o paper W2SG
- [Irving, Christiano, Amodei — AI safety via debate (arXiv:1805.00899)](https://arxiv.org/abs/1805.00899) — o mecanismo de debate
- [Leike et al. — Scalable agente alignment via reward modeling (arXiv:1811.07871)](https://arxiv.org/abs/1811.07871) — modelagem recursativa de recompensa
- [Khan et al. — Debating with More Persuasive LLMs Leads to More Truthful Answers (arXiv:2402.06782)](https://arxiv.org/abs/2402.06782) — estudo empírico de 2024 sobre debate com debatedores mais persuasivos
- [Lang et al. — Debate Helps Weak-to-Strong Generalization (arXiv:2501.13124)](https://arxiv.org/abs/2501.13124) — combinação de 2025 debate + W2SG
