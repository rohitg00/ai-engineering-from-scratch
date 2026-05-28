---
name: structured-output-designer
description: Projete um modelo JSON Schema plus Pydantic compatível com modo estrito para um destino de extração de texto livre, com recusa digitada e manipulação de novas tentativas inseridas.
version: 1.0.0
phase: 13
lesson: 04
tags: [structured-output, json-schema, pydantic, strict-mode, extraction]
---

Dado um alvo de extração de texto livre (faturas, currículos, tickets de suporte, resumos de pesquisas), produza um contrato de extração pronto para produção: JSON Schema 2020-12, modelo Pydantic, manipulador de recusas e política de novas tentativas.

Produzir:

1. Esquema JSON 2020-12. Cada propriedade digitada. `required` lista todas as propriedades. `additionalProperties: false` em cada objeto. Enums usados ​​para conjuntos de valores fechados. Não `$ref`. Nenhum `oneOf` / `anyOf` ambíguo. Validado de acordo com os requisitos de modo estrito do OpenAI.
2. Modelo Base Pydantic v2. Espelho do esquema com tipos Python. `model_json_schema()` deve produzir um esquema equivalente a (1).
3. Manipulador de recusa. Resultado `Refusal(reason: str, category: str)` digitado. Liste as categorias: `safety`, `input_mismatch`, `insufficient_info`.
4. Política de nova tentativa. Três formas de nova tentativa: (a) injetar erros de validação e tentar novamente uma vez (fora do modo estrito); (b) aceitar a recusa como definitiva (modalidade estrita); (c) evoluir para um modelo mais forte em caso de recusa repetida.
5. Teste os vetores. Dez entradas cobrindo caminho feliz, campos adversários, entrada parcial e um caso desencadeador de recusa. Cada um com resultado esperado.

Rejeições difíceis:
- Qualquer esquema com campos não digitados. Falha no modo estrito e no validador.
- Qualquer esquema faltando `additionalProperties: false`. Vaza alucinações.
- Qualquer esquema usando `oneOf` sem campo discriminador. Decodificação ambígua.
- Qualquer modelo Pydantic sem a verificação de ida e volta do esquema JSON.

Regras de recusa:
- Se o domínio alvo incluir dados de identificação pessoal sem finalidade documentada, recuse e encaminhe para a Fase 18 (ética) para o argumento de base legal.
- Se o usuário solicitar um esquema que não possa ser expresso no JSON Schema 2020-12 (por exemplo, gráficos arbitrários recursivos), recuse e proponha o relaxamento expressável mais próximo.
- Se o objetivo da extração for “extrair dados estruturados de qualquer coisa”, recuse e solicite o domínio específico.

Saída: um contrato de uma página com o esquema JSON, a classe Pydantic, a política de recusa e nova tentativa e os dez vetores de teste. Termine com uma observação sobre o primeiro fornecedor a ser alvo e por quê.