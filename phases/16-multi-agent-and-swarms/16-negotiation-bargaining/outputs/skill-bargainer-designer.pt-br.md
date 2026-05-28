---
name: bargainer-designer
description: Projete um protocolo de negociação: qual agente narra, qual componente gera ofertas, como os scratchpads privados se separam das mensagens públicas, qual é o limite da rodada e como a taxa de negociação é monitorada.
version: 1.0.0
phase: 16
lesson: 16
tags: [multi-agent, negotiation, bargaining, contract-net, OG-Narrator]
---

Dado um cenário de negociação ou de mercado de tarefas (negociação entre duas partes, leilão de N partes, alocação de tarefas em rede contratual), projete o protocolo.

Produzir:

1. **Mecanismo.** Negociação bipartidária, leilão com N licitantes, transmissão por rede contratual ou coalizão multipartidária. Dê um nome ao jogo.
2. **Gerador de ofertas.** Determinístico (concessão estilo Zeuthen, equilíbrio de Rubinstein, cronograma linear simples) ou solicitado por LLM. Padrão: determinístico, a menos que a oferta deva ser uma estrutura qualitativa (proposta, atribuição de função).
3. **Camada de narração.** O que o LLM contribui: o enquadramento amigável, táticas de persuasão, personalidade. Indique explicitamente o que o LLM NÃO decide.
4. **Canais privados versus canais públicos.** Como os rastros de raciocínio são mantidos fora do contexto da contraparte. "Rascunho privado" + "mensagem pública" como dois campos. Isso não é negociável por arXiv:2503.06416.
5. **Rodada limitada.** 3-5 rodadas no máximo para duas partes. Ilimitado não é uma opção; recompensa a conformidade e incentiva ofertas emocionais.
6. **Disciplina de reserva e BATNA.** Ambas as partes devem saber o preço da reserva. Se o outro lado investigar, o narrador do LLM não deve revelá-lo. Valide todas as mensagens enviadas em relação a esta regra.
7. **Monitoramento da taxa de negociação.** Taxa de negociação básica esperada para este protocolo (cite um número dos benchmarks de negociação: faixa de 27% a 89%, dependendo da função do LLM). Limite de alerta para regressões.
8. **Escalada.** Rodadas abaixo do limite, violações da ZOPA ou rota de quebra de regras da contraparte para um agente mediador ou humano.

Rejeições difíceis:

- Qualquer projeto onde o LLM calcula a oferta numérica sem um substituto determinístico. arXiv:2402.15813 mostra que isso produz taxas de negócios de aproximadamente 27%.
- Qualquer design sem canais privados e públicos separados. As contrapartes lerão seu raciocínio.
- Qualquer desenho com rodadas ilimitadas. Garante resultados orientados pela conformidade.
- Projetos que permitem que um único agente mantenha o estado de comprador e vendedor (negociação de roleplay). A propriedade da informação privada é o mecanismo; mesclar funções o remove.

Regras de recusa:

- Se a tarefa não tiver recompensa numérica (negociação qualitativa, termos contratuais), a decomposição do OG-Narrator poderá não ser aplicada. Em vez disso, recomende proposta estruturada + validação de esquema.
- Se o usuário não puder implementar um scratchpad separado (arquitetura de chamada LLM única), sinalize explicitamente o risco de vazamento e recomende uma arquitetura de duas chamadas.
- Se a negociação for contraditória com uma parte que possa mentir, recomende um agente mediador e ofertas registradas para auditoria.

Resultado: um resumo de uma página. Comece com um resumo de uma frase ("Barganha entre duas partes: gerador de oferta Zeuthen + narrador LLM, limite de 5 rodadas, bloco de notas separado, alerta de taxa de negociação abaixo de 85%.") e, em seguida, as oito seções acima. Termine com um exemplo de mensagem: o que a contraparte vê versus o que o bloco de notas privado contém.