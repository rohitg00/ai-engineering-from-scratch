---
name: prompt-sft-data-curator
description: Projetar e selecionar conjuntos de dados de instruções para ajuste fino supervisionado
version: 1.0.0
phase: 10
lesson: 6
tags: [sft, instruction-tuning, fine-tuning, data-curation, alignment]
---

# Curador de dados SFT

Ao projetar um conjunto de dados de ajuste de instruções para um recurso específico (geração de código, matemática, conversação, segurança), use esta estrutura para planejar a coleta de dados, definir critérios de qualidade e estruturar o pipeline de treinamento.

## Requisitos de entrada

Fornecer:
- **Capacidade alvo** (por exemplo, "geração de código Python", "perguntas e respostas médicas", "conversa multiturno")
- **Modelo básico** (por exemplo, Llama 3 8B, Mistral 7B, Qwen 2.5 72B)
- **Orçamento** (horas de anotação, custos de API para geração sintética)
- **Preferência de formato** (Alpaca, ShareGPT, ChatML)

## Etapa 1: Design do conjunto de dados

### Diretrizes de tamanho

| Nível de qualidade | Exemplos necessários | Resultado Esperado |
|--------------|----------------|------------------|
| Protótipo de pesquisa | 1.000-5.000 | Qualidade LIMA: comparável a conjuntos de dados maiores se os exemplos forem escritos por especialistas |
| Produção v1 | 10.000-50.000 | Nível Stanford Alpaca: instrução sólida seguindo tarefas comuns |
| Produção v2 | 50.000-200.000 | Nível de bate-papo Vicuna/Llama 2: cobertura robusta de vários turnos e domínio |

A qualidade sempre supera a quantidade. 1.000 exemplos escritos por especialistas (LIMA, maio de 2023) que correspondem a modelos treinados em mais de 50.000 exemplos. Priorizar:

1. **Diversidade** – abrange toda a gama de capacidades alvo
2. **Precisão** – todas as respostas devem ser factualmente corretas
3. **Clareza** – as respostas devem ser concisas e bem estruturadas
4. **Gradiente de dificuldade** – inclui exemplos fáceis, médios e difíceis

### Lista de verificação de diversidade

Para um assistente de uso geral:
- Perguntas abertas (20%)
- Perguntas e respostas factuais (20%)
- Escrita criativa (10%)
- Geração de código (15%)
- Raciocínio e matemática (15%)
- Resumo (10%)
- Instrução seguindo com restrições (10%)

Ajuste as porcentagens para modelos específicos de domínio. Um assistente de codificação pode alocar 60% para geração de código e 20% para explicação de código.

## Etapa 2: Formato dos dados

### Formato Alpaca (volta única)

```json
{
  "instruction": "Write a function that reverses a string in Python.",
  "input": "",
  "output": "def reverse_string(s):\n    return s[::-1]"
}
```

Use quando: tarefas de turno único, pares simples de instrução-resposta, prototipagem rápida.

### Formato ShareGPT (multivoltas)

```json
{
  "conversations": [
    {"from": "system", "value": "You are a Python expert."},
    {"from": "human", "value": "How do I reverse a string?"},
    {"from": "gpt", "value": "Use slicing: s[::-1]"},
    {"from": "human", "value": "What about for a list?"},
    {"from": "gpt", "value": "Same syntax works: my_list[::-1]"}
  ]
}
```

Use quando: aplicativos de conversação, contexto multiturno é importante.

### Formato ChatML (com tokens especiais)

```
<|im_start|>system
You are a Python expert.<|im_end|>
<|im_start|>user
How do I reverse a string?<|im_end|>
<|im_start|>assistant
Use slicing: s[::-1]<|im_end|>
```

Use quando: direcionar modelos que usam ChatML nativamente (Qwen, Yi).

## Etapa 3: Critérios de Qualidade

### Verificações por exemplo

1. **Relevância da resposta**: A resposta realmente responde à instrução?
2. **Precisão factual**: Todas as reivindicações são verificáveis ​​e corretas?
3. **Completude**: A resposta aborda totalmente a instrução?
4. **Concisão**: a mesma informação poderia ser transmitida em menos palavras?
5. **Consistência de formato**: A resposta segue o estilo esperado?

### Red Flags (rejeite o exemplo)

- A resposta se contradiz
- A resposta inclui conteúdo prejudicial sem recusa
- Resposta alucina fatos ou citações
- A instrução é ambígua e a resposta não esclarece
- A resposta é uma cópia da instrução reformulada

### Verificações em nível de conjunto de dados

- Não mais que 5% de exemplos de uma única fonte/modelo
- Pelo menos 80% dos tokens de resposta são significativos (não de preenchimento)
- O comprimento médio da resposta é de 50 a 200 tokens (evite muito curto ou muito longo)
- Diversidade de prompts do sistema: pelo menos 10 prompts de sistema diferentes representados

## Etapa 4: Configuração do treinamento

| Parâmetro | Faixa recomendada | Notas |
|-----------|------------------|-------|
| Taxa de aprendizagem | 1e-5 a 5e-5 | Inferior para modelos maiores (1e-5 para 70B, 5e-5 para 7B) |
| Épocas | 1-3 | Monitore a perda de validação, pare ao primeiro sinal de aumento |
| Tamanho do lote | 32-128 | Dimensionar com acumulação de gradiente se for limitado pela GPU |
| Aquecimento | 0-5% das etapas | Menos crítico que o pré-treinamento |
| Decadência de peso | 0,0-0,1 | Opcional para pequenas execuções de ajuste fino |
| Mascaramento de perdas | Somente tokens de resposta | Instrução de máscara e tokens de prompt do sistema |
| Mistura de dados pré-treinamento | 2-5% | Misture texto bruto para evitar esquecimento catastrófico |

## Etapa 5: Protocolo de Avaliação

Após o treinamento, avalie:

1. **Taxa de seguimento de instruções**: Porcentagem de prompts de teste em que o modelo produz uma resposta completa e relevante
2. **Pontuação de esquecimento**: Perplexidade em um corpus de texto geral retido em comparação com o modelo base
3. **Conformidade do formato**: porcentagem de respostas que seguem o formato de chat esperado
4. **MT-Bench ou AlpacaEval**: benchmarks padrão para modelos ajustados por instrução
5. **Avaliação específica de domínio**: avaliação personalizada para sua capacidade alvo

### Sinais de alerta

- A perda de validação aumenta após a época 1: você está ajustando demais, reduzindo épocas ou aumentando os dados
- A pontuação de esquecimento aumenta > 15%: taxa de aprendizagem muito alta ou muitas épocas
- O modelo reproduz exemplos de treinamento literalmente: overfitting severo, precisa de dados mais diversos
- Modelo recusa instruções benignas: treinamento excessivo em dados de segurança, reequilibra o conjunto de dados