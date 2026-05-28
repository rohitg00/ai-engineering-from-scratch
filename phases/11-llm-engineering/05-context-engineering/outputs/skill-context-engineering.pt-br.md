---
name: skill-context-engineering
description: Estrutura de decisão para projetar pipelines de montagem de contexto com base no tipo de tarefa, tamanho da janela e orçamento de latência
version: 1.0.0
phase: 11
lesson: 05
tags: [context-engineering, context-window, rag, memory, tool-selection, lost-in-the-middle]
---

# Engenharia de Contexto

Ao construir um aplicativo LLM, aplique esta estrutura para projetar o pipeline de montagem de contexto.

## Princípios fundamentais

1. **O contexto é escasso.** Uma janela de 128K parece grande, mas preenche rapidamente. Orçamente cada componente explicitamente.
2. **A atenção é desigual.** Os modelos prestam mais atenção no início e no fim. Coloque informações críticas lá. O meio é a zona morta.
3. **Dinâmico é melhor que estático.** Consultas diferentes precisam de contextos diferentes. Monte por consulta, não uma vez na inicialização.
4. **Menos é mais.** Um contexto de 10K selecionado supera um contexto de 100K descartado. A relação sinal-ruído é mais importante do que a informação total.
5. **Meça tudo.** Você não pode otimizar o que não mede. Conte tokens por componente em cada solicitação.

## Diretrizes orçamentárias contextuais

| Componente | Faixa típica | Prioridade | Estratégia de compressão |
|-----------|------------|----------|---------------------|
| Alerta do sistema | 200-1.000 fichas | Fixo, alto | Escreva bem, remova a redundância |
| Definições de ferramenta | 500-3.000 fichas | Dinâmico, médio | Podar por intenção de consulta |
| Contexto recuperado | 1.000-5.000 fichas | Dinâmico, alto | Reclassificar + limite + desduplicar |
| Histórico de conversas | 500-5.000 fichas | Dinâmico, médio | Resuma curvas antigas |
| Exemplos de poucas fotos | 500-2.000 fichas | Dinâmico, alto | Selecione por similaridade de tarefas |
| Consulta do usuário | 50-500 fichas | Fixo, mais alto | N/A |
| Reserva de geração | 2.000-8.000 fichas | Fixo | Ajustar pelo comprimento de saída esperado |

## Quando usar cada tipo de memória

**Curto prazo (histórico de conversa):** A sessão atual. Gerenciado por resumo. A compressão gira em torno de 5 a 10 trocas. Mantenha as últimas 3-4 voltas literalmente.

**Longo prazo (banco de dados de fatos):** Preferências e fatos do projeto que persistem entre sessões. Recuperar no início da sessão. Exemplos: "usuário prefere Python", "projeto usa PostgreSQL", "equipe segue desenvolvimento baseado em tronco". Armazene em CLAUDE.md, um banco de dados ou um sistema de memória estruturada.

**Episódica (interações anteriores):** Conversas anteriores específicas relevantes para a tarefa atual. Armazene como embeddings, recupere por similaridade. "Na semana passada depuramos um problema de autenticação semelhante" é a memória episódica.

## Estratégia de seleção de ferramentas

Não inclua todas as ferramentas em todas as solicitações. Isso desperdiça tokens e confunde o modelo.

1. Classifique a intenção da consulta (código, email, calendário, pesquisa, dados)
2. Mapeie intenções para categorias de ferramentas
3. Incluir apenas ferramentas correspondentes
4. Se a intenção for ambígua, inclua ferramentas das 2 categorias principais
5. Sempre inclua uma ferramenta "geral" (como pesquisa na web) como alternativa

Economia esperada: 60-80% de tokens de definição de ferramenta em consultas com intenção clara.

## Práticas recomendadas de recuperação

- **Reclassificar após recuperação.** A similaridade vetorial é um filtro aproximado. Um reclassificador (codificador cruzado ou baseado em LLM) melhora significativamente a precisão.
- **Defina um limite de relevância.** Não inclua pedaços abaixo de 0,3 de similaridade de cosseno. Eles adicionam ruído.
- **Desduplicar.** Se dois blocos compartilharem mais de 80% de conteúdo, mantenha apenas o que tiver pontuação mais alta.
- **Aplique a ordem perdida no meio.** Coloque os pedaços mais relevantes primeiro e por último.
- **Limite o total de tokens de recuperação.** 3-5 pedaços altamente relevantes superam 15 pedaços medíocres.

## Gerenciamento de histórico

- Mantenha as últimas 3-4 voltas literalmente (o modelo precisa de contexto recente)
- Resuma as curvas mais antigas em um resumo ("Discutimos X, decidimos Y e bloqueamos em Z")
- Eliminar turnos gerados pelo sistema que não adicionam informações (invocações de ferramentas sem conteúdo voltado para o usuário)
- Acione a compactação quando o histórico exceder 30% do orçamento disponível

## Bandeiras vermelhas

- O prompt do sistema excede 2.000 tokens: provavelmente inclui informações que deveriam ser dinâmicas
- Todas as ferramentas incluídas em cada solicitação: implemente a seleção baseada em intenção
- Sem filtragem de relevância na recuperação: você está despejando ruído na janela
- A história cresce sem limites: a sumarização não é implementada
- Sem reserva de geração: o modelo trunca suas respostas
- Mesmas informações em 3 locais (prompt do sistema, documento recuperado, histórico): desduplicar
- Utilização do contexto acima de 60%: você está deixando pouco espaço para o modelo “pensar”