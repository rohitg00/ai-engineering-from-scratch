---
name: prompt-tokenizer-builder
description: Crie e depure tokenizers com qualidade de produção para projetos LLM
version: 1.0.0
phase: 10
lesson: 2
tags: [tokenizer, bpe, byte-level, special-tokens, chat-template, multilingual]
---

# Construtor de tokenizador de produção

Ao construir ou depurar um tokenizer para um projeto LLM, siga esta estrutura.

## Lista de verificação do pipeline

Todo tokenizador de produção precisa desses cinco estágios. Se um estiver faltando, você encontrará casos extremos na produção.

1. **Normalizar** – Aplicar normalização NFKC Unicode. Isso recolhe ligaduras ("fi" -> "fi"), normaliza caracteres de largura total e padroniza espaços em branco. Ignore isso e a mesma palavra obterá IDs de token diferentes dependendo de como foi digitada.

2. **Pré-Tokenize** – Divida o texto em partes antes do BPE. Use o padrão regex do GPT-2 para modelos centrados no inglês. Use a abordagem de bytes brutos do SentencePiece para modelos multilíngues. A escolha determina se o BPE pode ser mesclado através dos limites das palavras.

3. **BPE Merge** – Aplique a tabela de mesclagem aprendida às sequências de bytes dentro de cada bloco. A tabela de mesclagem É o conhecimento aprendido do tokenizer. Todo o resto é encanamento.

4. **Injeção de token especial** – Combine tokens especiais exatamente antes da execução do BPE. [BOS], [EOS], [PAD], marcadores de modelo de chat recebem IDs fixos. Eles nunca participam de fusões.

5. **Mapeamento de ID** – Converte strings de token em números inteiros. O modelo vê apenas números inteiros.

## Depurando problemas do tokenizador

**Sintoma: o modelo produz lixo na entrada do chat**
- Verifique o modelo de chat. Cada modelo tem um formato diferente. Llama 3 usa marcadores `<|start_header_id|>`. ChatGPT usa marcadores `<|im_start|>`. Um modelo errado coloca informações fora da distribuição de treinamento.

**Sintoma: o texto que não está em inglês usa muitos tokens**
- Verifique a fertilidade (tokens por palavra). Acima de 2.0 significa que o tokenizer desperdiça janela de contexto nesse idioma. Soluções: treine novamente com mais dados multilíngues, aumente o tamanho do vocabulário ou use SentencePiece com Unigram.

**Sintoma: números e falha aritmética**
- Verifique como os dígitos são tokenizados. "1234" como um token significa que o modelo não pode realizar operações em nível de dígito. Divida os dígitos individualmente durante a pré-tokenização.

**Sintoma: tokens de código são ineficientes**
- Verifique como o recuo é tratado. O tokenizer do GPT-2 desperdiça tokens em espaços. Codex e StarCoder usam tokens de indentação especiais (4 espaços = 1 token).

## Decisão sobre o tamanho do vocabulário

- Tokens de 32 mil: idioma único, modelo pequeno, computação limitada. A camada de incorporação tem 32K * parâmetros d_model.
- 50K-64K: multilíngue ou com muitos códigos. Bom equilíbrio para a maioria dos projetos.
- 100K+ (GPT-4, Llama 3): somente com dados de treinamento massivos. Sequências mais curtas, mas parâmetros de incorporação de 100K * d_model.

Para um modelo de 4096 dimensões: vocabulário de 32K = 131M de parâmetros de incorporação. Vocabulário de 128K = parâmetros de incorporação de 524M. São 400 milhões de parâmetros apenas na camada de incorporação.

## Requisitos de velocidade

- Tokenização de dados de treinamento: use bibliotecas apoiadas por Rust (tiktoken, tokenizers HuggingFace). Pure Python é 10-100x mais lento.
- Tokenização de inferência: a latência é menos importante (sequência única), mas ainda usa implementações compiladas.
- Benchmark: tokenize 1 GB de texto e meça o tempo do relógio de parede. Se demorar mais de 60 segundos, mude para um back-end Rust.

## Validação de modelo de bate-papo

Antes de implantar qualquer modelo de chat, verifique o modelo:

1. Codifique uma conversa conhecida com o tokenizer
2. Decodifique de volta para texto
3. Compare caractere por caractere com o formato esperado da documentação do modelo
4. Preste atenção a: novas linhas após os tokens de cabeçalho, espaços antes do conteúdo, marcadores de final de turno
5. Casos extremos de teste: mensagem de sistema vazia, mensagem de usuário muito longa, vários turnos de assistente

Errar no modelo de chat é a fonte mais comum de degradação do desempenho do modelo de chat.