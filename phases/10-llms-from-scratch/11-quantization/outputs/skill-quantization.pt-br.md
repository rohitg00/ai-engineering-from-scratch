---
name: skill-quantization
description: Escolha a estratégia de quantização certa para implantar LLMs com base em restrições de hardware, qualidade e latência
version: 1.0.0
phase: 10
lesson: 11
tags: [quantization, inference, deployment, optimization, fp8, int4, int8, gptq, awq, gguf]
---

# Estrutura de decisão de quantização

Ao implantar um modelo de linguagem, use esta estrutura para selecionar o formato numérico, o método de quantização e a estratégia de validação de qualidade corretos.

## Requisitos de entrada

Fornecer:
- **Modelo** (nome, contagem de parâmetros, precisão original)
- **Hardware de destino** (modelo de GPU/VRAM, CPU, Apple Silicon, dispositivo de borda)
- **Meta de latência** (tokens/segundo, tempo até o primeiro token)
- **Piso de qualidade** (aumento máximo de perplexidade aceitável, delta de referência)
- **Padrão de veiculação** (tamanho do lote, comprimento máximo do contexto, usuários simultâneos)

## Seleção Rápida

| Sua situação | Formato | Método | Perda de qualidade esperada |
|---------------|--------|--------|-----------|
| GPU H100, rendimento máximo | 8.º PQ E4M3 | Fundição H100 nativa | <0,1% |
| A100/A10, precisa de 2x de rendimento | INT8 | LLM.int8() ou SmoothQuant | <0,5% |
| GPU única de 24 GB, modelo 70B | INT4 | AWQ ou GPTQ | 1-3% |
| MacBook / Apple Silício | INT4 GGUF | Q4_K_M via lhama.cpp | 1-2% |
| Dispositivo móvel/de ponta | INT4 ou INT3 | QAT + específico do dispositivo | 2-5% |
| Compressão máxima, alguma perda OK | INT2 | QuIP# ou AQLM | 5-15% |
| Treinamento (precisão mista) | BF16 + FP32 acumulado | Suporte de estrutura nativa | 0% |

## Seleção de precisão por componente

Nem todos os tensores devem receber o mesmo tratamento.

| Componente | Mínimo Seguro | Recomendado | Evite |
|-----------|------------|-------------|-------|
| Pesos FFN | INT4 | INT4 (AWQ/GPTQ) | INT2 sem QAT |
| Pesos de atenção | INT4 | INT8 ou FP8 | INT2 |
| Camada de incorporação | INT8 | FP16 (manter original) | INT4 |
| Cabeça de saída | INT8 | FP16 (manter original) | INT4 |
| Cache KV | 8º PQ | FP8 ou INT8 | INT4 em contexto longo |
| Atenção logits | FP16 | FP16 ou BF16 | INT8 |
| Ativações (inferência) | INT8 | FP8 ou INT8 | INT4 |

## Comparação de métodos

###GPTQ
- **Quando:** inferência de GPU, você deseja um modelo compatível com Hugging Face
- **Dados de calibração:** 128 exemplos, 2.048 tokens cada
- **Tempo:** 30-60 minutos para 70B na A100
- **Ferramentas:** `auto-gptq`, `exllama`, `exllamav2`
- **Força:** Modelo de zoológico enorme e bem testado no Hugging Face
- **Fraqueza:** Aplicação mais lenta que AWQ, qualidade ligeiramente inferior a AWQ em alguns modelos

###AWQ
- **Quando:** inferência de GPU, você deseja a melhor qualidade por bit
- **Dados de calibração:** 128 exemplos
- **Tempo:** 15-30 minutos para 70B na A100
- **Ferramentas:** `autoawq`, `vLLM` (suporte nativo)
- **Força:** Melhor qualidade INT4, aplicação rápida, integração vLLM
- **Fraqueza:** Zoológico modelo menor que o GPTQ

###GGUF
- **Quando:** inferência de CPU, Apple Silicon, ecossistema llama.cpp
- **Variantes:** Q2_K, Q3_K_S/M/L, Q4_K_S/M, Q5_K_S/M, Q6_K, Q8_0, F16
- **Padrão recomendado:** Q4_K_M (melhor equilíbrio qualidade/tamanho)
- **Ferramentas:** `llama.cpp`, `ollama`, `LM Studio`
- **Força:** Arquivos independentes, precisão mista, ecossistema massivo
- **Fraqueza:** Não é ideal para GPU (projetado para CPU/Metal)

### SmoothQuant
- **Quando:** INT8 na GPU, precisa de quantização de peso e ativação
- **Ideia principal:** Migre a dificuldade de quantização de ativações para pesos por meio de escalonamento por canal
- **Ferramentas:** `smoothquant`, `TensorRT-LLM`
- **Força:** Habilita W8A8 (pesos e ativações em INT8) para aceleração de 2x
- **Fraqueza:** Apenas INT8, não se estende a INT4

## Protocolo de validação de qualidade

Após a quantização, valide antes de implantar:

1. **Teste de perplexidade.** Calcule no WikiText-2 ou no corpus do seu domínio. Delta < 0,5 é excelente, 0,5-1,0 é bom, > 2,0 é um problema.

2. **Varredura de benchmark.** Execute MMLU (geral), GSM8K (matemática), HumanEval (código). Matemática e código são mais sensíveis à perda de precisão.

3. **Comparação de resultados.** Gere 100 respostas do modelo original e quantizado. Use LLM como juiz para calcular a taxa de vitórias. Meta: o modelo quantizado vence ou empata em > 90% dos prompts.

4. **Medição de latência.** Meça tokens/segundo no tamanho de lote 1 e no tamanho de lote desejado. Verifique se a aceleração justifica o custo da qualidade.

5. **Teste de contexto longo.** Se estiver servindo contextos longos (> tokens de 4K), teste no comprimento máximo do contexto. Erros de quantização do cache KV são compostos pelo comprimento da sequência.

## Calculadora de orçamento de memória

```
Weight memory (GB) = parameters (B) * bits / 8 / 1.073741824
KV cache per token (MB) = 2 * num_layers * d_model * bits / 8 / 1048576
KV cache for context (GB) = kv_per_token * max_context_length / 1024
Activation memory (GB) ~ 1-4 GB (relatively constant, depends on batch size)
Total = weight_memory + kv_cache + activation_memory + overhead (10-20%)
```

Exemplo para Llama 3 70B em INT4, contexto 32K:
Pesos: 70B * 4/8 / 1,07 = 32,6 GB
- Cache KV (FP16): 2 * 80 * 8192 * 16/8 / 1e9 * 32768 = ~ 40 GB
- Cache KV (FP8): ~20 GB
- Total com FP8 KV: ~55 GB (cabe em um A100 de 80GB)

## Erros Comuns

| Erro | Por que falha | Correção |
|--------|-------------|-----|
| Quantizando a camada de incorporação para INT4 | A primeira camada amplifica os erros em todo o modelo | Manter embeddings em FP16 ou INT8 |
| Usando escalas por tensor para INT4 | Uma linha discrepante destrói a precisão de todas as linhas | Use escalas por canal ou por grupo |
| Não calibrando GPTQ/AWQ | Fatores de escala estão errados sem dados representativos | Use 128 exemplos do seu domínio |
| Mesma largura de bits para todas as camadas | A primeira/última camada é mais sensível | Precisão mista: bits mais altos para primeiro/último |
| Quantizando cache KV em contexto muito longo | Erros compostos quadraticamente com comprimento de sequência | Use FP8 para cache KV, não INT4 |
| Ignorando validação de qualidade | Alguns modelos quantizam mal (especialmente nos limites) | Sempre execute avaliações de perplexidade + tarefa |

## Receitas de implantação

### Receita 1: vLLM com AWQ (servidor GPU)
```
pip install vllm autoawq
vllm serve model-awq --quantization awq --dtype half --max-model-len 8192
```

### Receita 2: llama.cpp com GGUF (MacBook)
```
./llama-server -m model.Q4_K_M.gguf -c 4096 -ngl 99
```

### Receita 3: TensorRT-LLM com FP8 (H100)
```
trtllm-build --model_dir model --output_dir engine --dtype float16 --use_fp8
```