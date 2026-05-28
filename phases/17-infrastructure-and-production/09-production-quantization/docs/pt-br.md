# Quantização em Produção — AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4

> Formato de quantização não é escolha universal — é função de hardware, engine de serving e workload. GGUF Q4_K_M ou Q5_K_M domina CPU e edge, entregue via llama.cpp e Ollama. GPTQ ganha dentro do vLLM quando você precisa de multi-LoRA na mesma base. AWQ com kernels Marlin-AWQ entrega ~741 tok/s em um modelo de classe 7B com o melhor Pass@1 em INT4 — o padrão de 2026 para produção em datacenter. FP8 continua sendo o meio-termo em Hopper, Ada e Blackwell — quase sem perda e amplamente suportado. NVFP4 e MXFP4 (microscaling Blackwell) são agressivos e requerem validação por bloco. Duas armadilhas pegam equipes: o dataset de calibração deve corresponder ao domínio de implantação, e KV cache é separado da quantização de pesos — a lição do AWQ "meu modelo agora tem 4 GB" esquece os 10-30 GB de KV cache em tamanhos de batch de produção.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, comparação toy de memória e throughput entre formatos)
**Pré-requisitos:** Fase 10 · 13 (Fundamentos de Quantização), Fase 17 · 04 (Internals de Serving vLLM)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Nomear os seis formatos de quantização em produção e seus pontos ideais em 2026.
- Escolher um formato dado hardware (CPU vs GPU, Hopper vs Blackwell), engine (vLLM, TRT-LLM, llama.cpp) e workload (chat rotineiro, raciocínio, multi-LoRA).
- Computar a memória economizada de pesos e o KV cache intocado para um formato escolhido.
- Nomear a armadilha do dataset de calibração que degrada modelos quantizados em tráfego de domínio.

## O Problema

Quantização reduz memória e largura de banda de HBM, que é exatamente o que decode precisa. Um modelo FP16 de 70B tem 140 GB de pesos. Quantize os pesos para INT4 (AWQ ou GPTQ) e o modelo tem 35 GB — cabe em uma H100 com espaço para KV cache, o que importa porque com 128 sequências concorrentes e contexto de 2k, o KV cache sozinho tem 20-30 GB.

Mas quantização não é grátis. Quantização agressiva degrada qualidade, eespecificaçãoialmente em tarefas com carga de raciocínio pesada. Diferentes formatos funcionam com diferentes engines. Diferentes hardware suportam diferentes precisões nativamente. O zoológico de formatos de 2026 é real e você não pode copiar a escolha de outro — tem que escolher baseado na sua stack.

## O Conceito

### Os seis formatos

| Formato | Bits | Ponto ideal | Engines |
|---------|------|-------------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA no vLLM | vLLM, TGI |
| AWQ | 4 | GPU de datacenter em produção | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Datacenter Hopper/Ada/Blackwell | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multiusuário | TRT-LLM |
| NVFP4 | 4 | Blackwell multiusuário | TRT-LLM |

### GGUF — o padrão CPU/edge

GGUF é um formato de arquivo, não um esquema de quantização em si — ele empacota variantes K-quant (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) em um único container. Q4_K_M e Q5_K_M são os padrões de produção — qualidade próxima a BF16 a 4-5 bits. Melhor escolha para serving em CPU ou edge porque o llama.cpp é de longe a engine de inferência para CPU mais rápida.

Penalidade de throughput no vLLM: ~93 tok/s em 7B — o formato não é otimizado para kernels de GPU. Use GGUF quando o alvo de implantação é CPU/edge. Caso contrário, não use.

### GPTQ — multi-LoRA no vLLM

GPTQ é um algoritmo de quantização pós-treinamento com uma passada de calibração. Os kernels Marlin o tornam rápido na GPU (speedup de 2,6x vs GPTQ sem Marlin). ~712 tok/s em 7B.

A vitória única: GPTQ-Int4 suporta adaptadores LoRA no vLLM. Se você está servindo um modelo base mais 10-50 variantes fine-tuned (cada uma como LoRA), GPTQ é seu caminho. NVFP4 ainda não suporta LoRA no início de 2026.

### AWQ — o padrão de GPU em datacenter

Activation-aware Weight Quantization. Protege os ~1% de pesos mais salientes durante a quantização. Kernels Marlin-AWQ: speedup de 10,9x vs ingênuo. ~741 tok/s em 7B, melhor Pass@1 entre formatos INT4.

Escolha AWQ para novo serving em GPU a menos que você precise de multi-LoRA (GPTQ) ou Blackwell FP4 agressivo (NVFP4).

### FP8 — o meio-termo confiável

Ponto flutuante de 8-bit. Quase sem perda. Amplamente suportado. Tensor Cores do Hopper aceleram FP8 nativamente. Blackwell herda. FP8 é o padrão seguro de 2026 quando qualidade é inegociável (raciocínio, médico, code-gen). Economia de memória é metade de INT4 mas risco de qualidade é muito menor.

### MXFP4 / NVFP4 — Blackwell agressivo

Microscaling FP4. Cada bloco de pesos tem seu próprio fator de escala. Agressivo mas acelerado por hardware nos Tensor Cores do Blackwell. Reduz os bytes por token pela metade comparado a FP8 — a vitória econômica na Fase 17 · 07.

Ressalvas:
- Sem suporte a LoRA ainda (início de 2026).
- Queda de qualidade visível em workloads com carga de raciocínio pesada.
- Valide no seu eval set por modelo.

### A armadilha da calibração

AWQ e GPTQ requerem um dataset de calibração — tipicamente C4 ou WikiText. Para modelos de domínio (código, médico, jurídico), calibrar em texto genérico da web deixa o algoritmo tomar decisões erradas sobre quais pesos proteger. Pass@1 no HumanEval pode cair vários pontos.

A correção: calibre em dados do domínio. Centenas de amostras do domínio normalmente são suficientes. Teste no eval set antes de implantar.

### A armadilha do KV cache

AWQ encolhe os pesos para 4 bits. KV cache é separado e fica em FP16/FP8. Para um modelo 70B com AWQ:

- Pesos: ~35 GB (INT4 de 140 GB).
- KV cache a 128 concorrentes × contexto 2k: ~20 GB.
- Ativações: ~5 GB.
- Total: ~60 GB — cabe em uma H160 80GB.

Ingênuamente "eu quantizei meu modelo para 4 GB" esquece os outros 30-50 GB. Orce HBM de forma holística.

Separadamente, quantização de KV cache (FP8 KV ou INT8 KV) é uma escolha diferente com seus próprios tradeoffs — afeta a acurácia da attention diretamente e não é uma vitória grátis.

### AWQ INT4 é perigoso para raciocínio

Chain-of-thought, matemática, code-gen com contexto longo — esses sofrem visivelmente com quantização agressiva. AWQ INT4 perde ~3-5 pontos em MATH. Para workloads com carga de raciocínio pesada, entregue FP8 ou BF16; aceite o custo de memória.

### Guia de escolha para 2026

- Serving em CPU/edge: GGUF Q4_K_M. Pronto.
- Serving em GPU, chat rotineiro, sem LoRA: AWQ.
- Serving em GPU, multi-LoRA: GPTQ com Marlin.
- Workload de raciocínio: FP8.
- Datacenter Blackwell, qualidade validada: NVFP4 + FP8 KV.
- Ambíguo: rode um eval de 1.000 amostras em cada formato candidato.

## Use

`code/main.py` computa pegada de memória (pesos + KV + ativações) e throughput relativo entre os seis formatos para uma faixa de tamanhos de modelo. Mostra onde KV cache domina, onde compressão de pesos paga e onde FP8 é a escolha segura.

## Entregue

Esta aula produz `outputs/skill-quantization-picker.md`. Dado hardware, tamanho de modelo, tipo de workload e tolerância de qualidade, escolhe um formato e produz um plano de calibração/validação.

## Exercícios

1. Execute `code/main.py`. Para um modelo 70B a 128 concorrentes com contexto 2k, compute o HBM total para cada formato. Qual formato permite que você caiba em uma H100 80GB?
2. Você tem um modelo de código 7B. Escolha um formato e justifique. Se você errou na tolerância de qualidade, qual é a rota de recuperação?
3. Compute o tamanho do dataset de calibração necessário para calibrar AWQ para um modelo de domínio médico. Por que mais dados nem sempre são melhores?
4. Leia o paper ou release notes do kernel Marlin-AWQ. Explique em três frases por que AWQ atinge 741 tok/s em 7B enquanto GPTQ cru atinge ~712.
5. Quando faz sentido combinar pesos AWQ com KV cache FP8 vs manter KV em BF16?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| GGUF | "formato do llama.cpp" | Formato de arquivo empacotando variantes K-quant; padrão CPU/edge |
| Q4_K_M | "Q4 K M" | K-quant médio de 4-bit; o padrão GGUF em produção |
| GPTQ | "gee pee tee q" | INT4 pós-treinamento com calibração; suporta LoRA no vLLM |
| AWQ | "a w q" | INT4 activation-aware; kernels Marlin; melhor Pass@1 em INT4 |
| Kernels Marlin | "kernels INT4 rápidos" | Kernels CUDA custom para INT4 no Hopper; speedup de 10x |
| FP8 | "float de oito bits" | Precisão segura padrão em Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling de quatro" | FP de 4-bit do Blackwell com fatores de escala por bloco |
| Dataset de calibração | "dados de cal" | Texto de entrada usado para escolher parâmetros de quantização; deve corresponder ao domínio |
| Quantização de KV cache | "KV INT8" | Escolha separada dos pesos; afeta acurácia da attention |

## Leitura Complementar

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) — benchmarks comparativos.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) — números de throughput por formato.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) — escolha formato por formato.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) — formatos e flags suportados.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) — formulação original do AWQ.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) — formulação original do GPTQ.
