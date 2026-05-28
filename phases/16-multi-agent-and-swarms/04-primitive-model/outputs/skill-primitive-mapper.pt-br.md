---
name: primitive-mapper
description: Mapeie qualquer estrutura ou base de código multiagente para os quatro eixos primitivos (agente, transferência, estado compartilhado, orquestrador).
version: 1.0.0
phase: 16
lesson: 04
tags: [multi-agent, primitives, framework-comparison, architecture]
---

Dada uma estrutura multiagente (ou uma base de código que a utilize), produza o mapeamento de quatro primitivos para que o leitor possa entender a estrutura em um parágrafo.

Produzir:

1. **Definição de agente.** Como um agente é construído? Quais parâmetros? Que estado ele carrega? Nomeie a classe ou fábrica exata.
2. **Mecanismo de transferência.** Qual dos três padrões de transferência ele usa — retorno de função, borda do gráfico ou seleção de alto-falante? Se for um híbrido, qual é o primário? Mostre o código mínimo que aciona uma transferência.
3. **Modelo de estado compartilhado.** Conjunto completo de mensagens ou visualização projetada? Na memória ou durável (com ponto de verificação)? É thread-safe para escritores simultâneos? Quem reconcilia conflitos?
4. **Tipo de orquestrador.** Estático, selecionado por LLM, orientado por transferência ou orientado por fila? Se o LLM for selecionado, qual modelo é padrão? Se estático, o gráfico é cíclico ou DAG?
5. **Compensações entre eixos.** Uma frase para cada: determinismo, limite de escalabilidade, capacidade de depuração, modo de falha típico.

Rejeições difíceis:

- Qualquer mapeamento que afirme que uma abstração é "nova" sem mostrá-la não colapsa para uma das quatro primitivas. Se você não puder reduzi-la, nomeie a lacuna com precisão, em vez de inventar uma quinta primitiva.
- Comparações de estruturas que citam apenas documentos de marketing. Sempre cite um exemplo de código concreto do repositório do framework ou do livro de receitas oficial.
- Declarações como "Framework X é melhor para agentes" sem especificar qual primitivo o framework otimiza.

Regras de recusa:

- Se a estrutura for de código fechado e os documentos públicos não exporem a superfície do orquestrador de estado de transferência de agente, declare que o mapeamento não é possível sem componentes internos.
- Se o usuário fornecer uma base de código, mas nenhuma estrutura (agentes rolados manualmente), mapeie a implementação personalizada e sinalize qual primitivo está subprojetado.
- Se a estrutura for anterior a 2024 (AutoGen v0.2 original, pré-Swarm) e não for mais mantida, inclua uma observação de uma linha sobre se seu sucessor preserva o mapeamento.

Resultado: um resumo da estrutura de uma página. Comece com um resumo de uma única frase ("Framework X corrige a transferência como borda do gráfico e expõe o estado compartilhado por meio de um redutor."), depois as cinco seções acima e, em seguida, um parágrafo final nomeando qual projeto de produção as primitivas desta estrutura se ajustam melhor.