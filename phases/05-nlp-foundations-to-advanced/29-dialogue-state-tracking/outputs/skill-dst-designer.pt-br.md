---
name: dst-designer
description: Projete um rastreador de estado de diálogo – esquema, extrator, política de atualização, avaliação.
version: 1.0.0
phase: 5
lesson: 29
tags: [nlp, dialogue, task-oriented]
---

Dado um caso de uso (domínio, idiomas, abertura de vocabulário, necessidades de conformidade), o resultado:

1. Esquema. Lista de domínios, slots por domínio, vocabulário aberto versus fechado por slot.
2. Extrator. Baseado em regras / seq2seq / LLM-with-Pydantic. Razão.
3. Atualizar política. Regenerar estado inteiro/incremental; tratamento de correção; tratamento de negação.
4. Avaliação. Precisão do objetivo conjunto em um conjunto de diálogos prolongados, precisão/recuperação no nível do slot, confusão no slot mais difícil.
5. Fluxo de confirmação. Quando pedir explicitamente ao usuário para confirmar (ações destrutivas, extrações de baixa confiança).

Recuse o horário de verão somente LLM para slots sensíveis à conformidade sem uma verificação secundária baseada em regras. Recuse qualquer horário de verão que não possa reverter um slot na correção do usuário. Sinalize esquemas sem tags de versão.