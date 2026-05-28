---
name: skill-tokenizer
description: Escolhendo e construindo tokenizadores para projetos LLM
version: 1.0.0
phase: 10
lesson: 1
tags: [tokenizer, bpe, wordpiece, sentencepiece, llm, nlp]
---

# Seleção e implementação do tokenizador

Ao iniciar um projeto LLM, aplique esta estrutura de decisão para seleção de tokenizador.

## Quando usar cada tokenizer

**BPE em nível de byte (tiktoken):** Você está desenvolvendo ou ajustando modelos da família GPT. Você precisa de manipulação garantida de qualquer sequência de bytes de entrada. Você não quer tokens desconhecidos.

**WordPiece (Hugging Face):** Você está trabalhando com modelos da família BERT para classificação, NER ou tarefas de incorporação. Você precisa do prefixo de continuação "##" para tarefas downstream que dependem de sinais de limite de palavra.

**SentencePiece (BPE ou Unigram):** Você está treinando do zero. Você precisa de tokenização independente de idioma. Seus dados incluem idiomas CJK, tailandês ou outros scripts sem limites de palavras com espaços em branco. LLaMA, T5 e a maioria dos modelos multilíngues usam isso.

## Diretrizes para tamanho de vocabulário

- Tokens de 32K: bom padrão para modelos de idioma único, mantém a camada de incorporação pequena
- Tokens de 50 mil a 64 mil: melhor para modelos multilíngues ou com muitos códigos
- Mais de 100 mil tokens: somente quando você possui dados de treinamento massivos e deseja sequências curtas

Vocabulário maior significa sequências mais curtas (inferência mais barata), mas mais parâmetros na matriz de incorporação. Para um vocabulário de 100K com incorporações de 4.096 dimensões, a camada de incorporação sozinha tem 400M de parâmetros.

## Regras de pré-tokenização que importam

1. Divida em espaços em branco antes do BPE para evitar mesclagens de palavras cruzadas
2. Separe os dígitos individualmente se quiser que o modelo aprenda aritmética
3. Normalize o Unicode (NFC) antes da tokenização para um comportamento consistente
4. Adicione tokens especiais para seu caso de uso: `<pad>`, `<eos>`, `<bos>`, `<unk>` e quaisquer marcadores específicos de tarefa

## Sinais de alerta no comportamento do tokenizer

- Fertilidade acima de 2,0 para seu idioma alvo: o modelo desperdiça janela de contexto
- Palavras de domínio comuns divididas em mais de 3 tokens: treinar novamente com dados de domínio
- Tokenização inconsistente de números: verifique as regras de divisão de dígitos
- Vocabulário grande com muitos tokens de uso único: reduza o tamanho do vocabulário

## Construindo um tokenizer personalizado - lista de verificação

1. Colete dados de treinamento representativos (pelo menos 1 GB de texto no domínio de destino)
2. Escolha o algoritmo: BPE para uso geral, Unigram para multilíngue
3. Defina o tamanho do vocabulário com base nas diretrizes acima
4. Configure a pré-tokenização: divisão de espaços em branco, manipulação de dígitos, pontuação
5. Adicione tokens especiais
6. Treine usando a biblioteca de tokenizers Hugging Face (backend Rust, rápido)
7. Validar: verifique a fertilidade do texto retido em todos os idiomas de destino
8. Teste casos extremos: string vazia, entrada muito longa, dados binários, emoji, texto RTL
9. Salve e versione o tokenizer junto com os pontos de verificação do modelo