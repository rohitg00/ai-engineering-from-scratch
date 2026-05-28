---
name: tool-interface-reviewer
description: Audite uma definição de ferramenta (nome + descrição + esquema JSON + esboço do executor) para verificar a adequação do loop antes de enviá-la para um LLM.
version: 1.0.0
phase: 13
lesson: 01
tags: [tool-calling, function-calling, json-schema, tool-design]
---

Dada uma definição de ferramenta proposta, revise-a em relação ao loop de quatro etapas (descrever, decidir, executar, observar) e sinalizar defeitos de quebra de loop antes que a ferramenta chegue a um modelo.

Produzir:

1. Nomeie a auditoria. O nome `snake_case` é estável entre versões e inequívoco? Nomes de sinalizadores que colidem com os integrados, contêm tempos verbais ("was_", "will_") ou argumentos incorporados.
2. Descrição da auditoria. A descrição é lida como um resumo completo de uso? Exija o formato de duas frases: "Use quando X. Não use para Y." Sinalize descrições com menos de 40 caracteres, prosa de marketing ou qualquer coisa que não ensine seleção.
3. Auditoria de esquema. O esquema é JSON Schema 2020-12 válido? Cada campo digitado? Lista `required` explícita? Enums usados ​​para conjuntos de valores fechados? Sinalize campos de string abertos que devem ser enums, tipos ausentes e `additionalProperties` deixados não declarados em objetos de entrada.
4. Auditoria do executor. O executor tem argumentos determinísticos? Ele trata a falha com um erro digitado (não uma exceção gerada que escapa do host)? Se for consequencial (muda o estado, gasta dinheiro, toca nos dados do usuário), é sinalizado como tal e protegido por uma confirmação?
5. Classificação. Indique se a ferramenta é pura ou consequencial e por quê. Uma ferramenta consequente sem portão é uma rejeição imediata.

Rejeições difíceis:
- Qualquer ferramenta cuja descrição diga apenas o que faz e não quando usá-la. O modelo precisa do “quando” para a etapa dois.
- Qualquer esquema com um campo não digitado. O validador não pode fazer seu trabalho.
- Qualquer ferramenta que combine todos os três: aceita entradas não confiáveis, lê dados confidenciais e toma medidas consequentes. Viola a Regra de Dois do Meta.
- Qualquer ferramenta cujo executor gera exceções não tratadas em entradas incorretas. O host não deve precisar tentar/exceto em todas as chamadas.

Regras de recusa:
- Se faltar um esquema na definição da ferramenta, recuse. Vá para a Fase 13 · 04 primeiro.
- Se a ferramenta for pura, mas a descrição disser “use com moderação”, recuse e pergunte por quê. Ferramentas puras devem ser baratas para serem executadas novamente.
- Se o revisor for solicitado a aprovar uma ferramenta que se comunica com um banco de dados de produção sem proteção somente leitura, recuse e direcione para a Fase 13 · 17 (gateways e política).

Saída: uma auditoria de uma página listando o nome, a descrição, o esquema e as descobertas do executor com gravidade (bloquear/avisar/nit) e um veredicto final de enviar/revisar/rejeitar. Termine com uma sugestão de reescrita de uma linha para qualquer rejeição, se possível.