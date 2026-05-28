---
name: prompt-data-quality-checker
description: Validar e depurar a qualidade dos dados em pipelines de pré-treinamento LLM
version: 1.0.0
phase: 10
lesson: 3
tags: [data-pipeline, deduplication, quality-filter, pre-training, llm, data-cleaning]
---

# Verificador de qualidade de dados para pré-treinamento LLM

Ao construir ou auditar um pipeline de dados para pré-treinamento LLM, use esta estrutura para detectar problemas antes que eles cheguem ao modelo.

## Sinais de alerta na saída do pipeline

**A desduplicação removeu menos de 20% dos dados da web.** O rastreamento comum normalmente contém 30-40% de duplicatas. Se sua etapa de desduplicação remover menos de 20%, seus parâmetros MinHash são muito conservadores ou seu limite é muito alto. Verifique: tamanho da telha k, número de funções hash, número de bandas LSH, limite de Jaccard.

**Taxa de compactação abaixo de 2,0 caracteres/token.** Isso significa que seu tokenizer está se dividindo de forma muito agressiva. Treine novamente com mais mesclagens, aumente o tamanho do vocabulário ou verifique se a pré-tokenização não está fragmentando o texto desnecessariamente.

**Taxa de compactação acima de 6,0 caracteres/token.** Seu tokenizer aprendeu mesclagens muito específicas de domínio que podem não ser generalizadas. Isso é bom para modelos de domínio específico, mas é um sinal de alerta para modelos de uso geral.

**Utilização de sequência abaixo de 90%.** Muito preenchimento. Ou seus documentos são muito curtos (filtre-os ou aumente o comprimento mínimo do documento) ou seu empacotamento sequencial é ineficiente (mude do preenchimento simples para o empacotamento de vários documentos).

**Utilização de vocabulário abaixo de 50%.** Mais da metade do seu vocabulário não é utilizado neste corpus. Ou o vocabulário é muito grande para o seu domínio ou o tokenizer foi treinado com dados muito diferentes.

## Calibração de Filtro de Qualidade

Execute estas verificações em uma amostra aleatória de 1.000 documentos em cada estágio do pipeline:

1. **Leia 20 documentos aleatórios após a limpeza.** Eles contêm HTML, JavaScript, texto de navegação ou texto padrão residuais? Se sim, a remoção do HTML está incompleta.

2. **Leia 20 documentos aleatórios que PASSARAM no filtro de qualidade.** Algum deles é spam, lista de palavras-chave ou gerado por máquina? Se sim, aperte os limites do filtro.

3. **Leia 20 documentos aleatórios que FALHARAM no filtro de qualidade.** Algum deles tem conteúdo genuinamente bom? Se sim, seu filtro é muito agressivo. Relaxe os limites ou adicione exceções para padrões específicos.

4. **Leia 20 pares aleatórios quase duplicados da desduplicação.** Eles são realmente semelhantes? Caso contrário, diminua o limite do Jaccard ou aumente o número de funções hash.

## Razões de mistura de dados

Não existe uma fórmula universal. Comece com estas linhas de base e ajuste com base na avaliação:

| Categoria | Proporção de lhama 3 | Ponto de partida |
|----------|-------------|----------------|
| Texto da web | 50% | 50% |
| Código | 25% | 15-25% |
| Livros/acadêmicos | 13% | 10-15% |
| Matemática | 8% | 5-10% |
| Web multilíngue | 4% | 5-10% |

Aumente a proporção do código se o modelo for forte em programação. Aumente a proporção matemática se o raciocínio for importante. Diminua a proporção da web se precisar de menos ruído. Sempre avalie com base em benchmarks após alterar os índices.

## Estimativas de escalonamento

Para uma determinada contagem de tokens de destino:

- Tokens de 1T da web: espere ~3-5TB de texto bruto, ~1,5-2TB após limpeza e desduplicação
- Velocidade de tokenização (Rust): ~100 milhões de tokens/segundo por núcleo
- Velocidade de tokenização (Python): ~1-10 milhões de tokens/segundo por núcleo
- Desduplicação MinHash em 128 hashes, 16 bandas: ~10 mil documentos/segundo por núcleo
- Embalagem de sequência: limite de E/S, use arquivos mapeados em memória para corpora acima de 10 GB

Para tokens de 15T (escala Llama 3), planeje cerca de 30 a 50 TB de dados de entrada brutos, 1 a 2 semanas de pré-processamento em uma máquina de 64 núcleos e mais de 100 TB de disco para arquivos intermediários.

## Lista de verificação antes do treino

1. A contagem total de tokens corresponde ao seu orçamento de computação (use o dimensionamento do Chinchilla ou a taxa de overtrain do Llama 3 como guia)
2. A desduplicação removeu 30-40% dos dados da web
3. O filtro de qualidade removeu 10-20% dos dados restantes
4. A taxa de compactação é de 3 a 5 caracteres/token para inglês
5. A utilização da sequência está acima de 95%
6. Verificações aleatórias mostram texto limpo e coerente em cada estágio do pipeline
7. As proporções de combinação de dados foram validadas em um treinamento em pequena escala
8. A remoção de PII foi verificada em uma amostra
9. Todos os formatos binários (sequências compactadas, matrizes de ID de token) passam nos testes de codificação/decodificação de ida e volta
10. O pipeline é reproduzível: a mesma entrada produz uma saída idêntica com sementes aleatórias fixas