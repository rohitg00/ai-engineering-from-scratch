---
name: memory-auditor
description: Audite o design de memória compartilhada de um sistema multiagente para verificar a origem, o controle de versão, a separação do verificador e o esquema de projeção. Sinalize a exposição ao envenenamento da memória antes da produção.
version: 1.0.0
phase: 16
lesson: 13
tags: [multi-agent, shared-state, blackboard, memory-poisoning, provenance]
---

Dada uma base de código multiagente ou documento de arquitetura, audite o design de memória compartilhada e sinalize a exposição ao envenenamento de memória.

Produzir:

1. **Topologia.** Conjunto completo de mensagens, quadro particionado por tópico, visualização projetada por agente ou híbrido? Nomeie a estrutura de dados (lista, dict, quadro pandas, armazenamento de vetores, tabela SQL). Conte o limite superior aproximado de escritores e leitores em estado estacionário.
2. **Campos de proveniência.** Em cada gravação, a entrada registra: ID do autor, carimbo de data/hora, hash de prompt ou texto de prompt, rastreamento de chamada de ferramenta, URI de origem ou nome da ferramenta? Liste os campos presentes e os campos ausentes.
3. **Modelo de atualização.** O log é apenas anexado ou os gravadores mudam no local? Se for mutação, qual é o mecanismo de controle de simultaneidade (bloqueio, controle de versão otimista, nenhum)? As correções devem ser entradas de substituição, não edições no local – sinalize qualquer design que não faça isso.
4. **Separação do verificador.** Existe um agente somente leitura com acesso à fonte independente? Ele pode gravar no pool principal (não deveria)? Para onde vai sua produção?
5. **Esquema de projeção.** Se o design usa projeções (redutores LangGraph, tópicos de quadro-negro, visualizações com escopo de função), o esquema está documentado? Como os novos agentes declaram a projeção que consomem?
6. **Pontuação de risco de envenenamento.** Pontuação de 1 a 5 em cada eixo: [completude da proveniência], [superação sobre mutação], [independência do verificador], [claridade do esquema de projeção]. Um sistema com pontuação abaixo de 3 em qualquer eixo é sinalizado.

Rejeições difíceis:

- Qualquer auditoria que não sinalize a falta de um verificador. Um verificador não gravável com acesso à fonte independente é a mitigação de suporte de carga; qualquer outra mitigação é decorativa sem ela.
- Auditorias que recomendam “adicionar mais testes”. Os testes não detectam envenenamento de memória porque o envenenamento produz resultados plausíveis que passam nos testes.
- Auditorias que recomendam hash do conteúdo como única procedência. Um hash informa *o que* foi escrito, não *quem* ou *de onde*.

Regras de recusa:

- Se a base de código ocultar o estado compartilhado em um serviço externo (Redis, Postgres, banco de dados vetorial) sem ferramentas de inspeção, indique que a auditoria não pode ser concluída sem acesso de leitura de produção.
- Se o sistema tiver menos de três agentes, observe que o risco de envenenamento de memória é baixo, mas a procedência ainda é um seguro barato.
- Se o sistema usar uma estrutura com gerenciamento de estado integrado (ponto de verificação LangGraph, pool AutoGen), audite as garantias da estrutura em vez de derivá-las novamente.

Resultado: um relatório de duas páginas. Comece com um resumo de uma frase (“O estado compartilhado é um conjunto completo de mensagens sem proveniência e sem verificador – alto risco de envenenamento”) e, em seguida, as seis seções acima. Termine com uma lista de ações priorizadas: três mudanças, cada uma rotulada como [crítica], [deveria] ou [bom ter], com tempo estimado para implementação.