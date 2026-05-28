---
name: skill-structured-outputs
description: Estrutura de decisão para escolher a estratégia de produção estruturada certa com base no fornecedor, na confiabilidade e na complexidade
version: 1.0.0
phase: 11
lesson: 03
tags: [structured-output, json, schema, constrained-decoding, pydantic, function-calling]
---

# Estratégia de produção estruturada

Ao construir um aplicativo LLM que requer dados estruturados, aplique esta estrutura de decisão.

## Quando usar cada abordagem

**Com base em prompt ("Return JSON"):** Somente prototipagem. Aceitável para ferramentas internas onde falhas ocasionais de análise são toleráveis. Adicione uma tentativa/exceto com nova tentativa. Nunca use em pipelines de produção.

**Modo JSON (sinalizador de API):** Você precisa de JSON válido garantido, mas o esquema é simples ou flexível. Funciona quando você valida a forma no lado do aplicativo. Disponível: OpenAI, Anthropic (via uso de ferramenta), Google.

**Modo esquema (decodificação restrita):** Sistemas de produção onde cada saída deve corresponder a um esquema específico. Zero falhas de análise. Zero violações de esquema. Use isso por padrão para qualquer tarefa de extração ou classificação de produção. Disponível: resultados estruturados OpenAI, esboços, orientações.

**Chamada de função/uso de ferramenta:** O modelo precisa escolher qual função chamar, não apenas preencher parâmetros. Você tem vários esquemas e o modelo seleciona o apropriado. Use também ao integrar com a infraestrutura de ferramentas/funções existente.

**Biblioteca de instrutores:** você deseja a validação do Pydantic com nova tentativa automática em qualquer provedor. Melhor DX para projetos Python. Inclui modelos OpenAI, Anthropic, Google e de código aberto.

## Orientação específica do provedor

**OpenAI:** Use `response_format` com o tipo `json_schema`. A decodificação restrita está integrada. Os modelos Pydantic funcionam diretamente. Implementação de saída estruturada mais confiável.

**Antrópico:** Use o uso de ferramentas para resultados estruturados. Defina uma única ferramenta com o esquema desejado. O modelo retorna argumentos de chamada de ferramenta correspondentes ao esquema. Confiável, mas requer o padrão API de uso da ferramenta.

**Modelos de código aberto (vLLM, Ollama):** Use Outlines ou Guidance para decodificação restrita. Essas bibliotecas compilam esquemas JSON em máquinas de estado finito que mascaram tokens inválidos durante a geração. Requer execução de inferência localmente.

## Diretrizes de design de esquema

1. Mantenha os esquemas simples quando possível. Objetos aninhados além de 2 níveis aumentam os erros de extração.
2. Use enums para campos categóricos. Não confie no modelo para inventar a corda certa.
3. Torne os campos ambíguos obrigatórios com suporte nulo explícito em vez de opcionais. Força o modelo a tomar uma decisão.
4. Adicione descrições às propriedades do esquema. O modelo lê isso como instruções.
5. Evite tipos de união (oneOf/anyOf), a menos que seja necessário. Eles aumentam a complexidade da decodificação.
6. Defina mínimo/máximo em números. Capta valores extremos alucinados.
7. Use minItems/maxItems em arrays para evitar saídas vazias ou ilimitadas.

## Padrões de falhas comuns e correções

- **O modelo envolve JSON em limites de remarcação**: alterne do modo baseado em prompt para o modo JSON ou modo de esquema
- **Esquema válido, mas factualmente errado**: adicione uma etapa de validação LLM como juiz após a extração
- **Valores enum inconsistentes**: mude para decodificação restrita ou adicione normalização pós-processamento
- **Campos opcionais ausentes**: torne-os obrigatórios ou adicione valores padrão no código do aplicativo
- **Extração muito lenta**: a decodificação restrita adiciona latência de 5 a 15%, reduz a complexidade do esquema se for sensível à latência
- **Grandes matrizes com itens variados**: fragmente a entrada e extraia por bloco e, em seguida, mescle os resultados

## Escada de confiabilidade

| Abordagem | Analisar sucesso | Correspondência de esquema | Esforço de configuração |
|----------|------------|-------------|-------------|
| Baseado em prompt | ~90% | ~80% | 1 minuto |
| Modo JSON | 100% | ~90% | 5 minutos |
| Modo de esquema | 100% | ~99% | 15 minutos |
| Decodificação restrita | 100% | 100% | 30 minutos |
| Instrutor + tentar novamente | 100% | ~99,5% | 10 minutos |