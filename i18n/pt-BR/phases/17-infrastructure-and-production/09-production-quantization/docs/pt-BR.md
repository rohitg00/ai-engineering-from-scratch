# Quantização da produção  AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4

> O formato de quantização não é uma escolha universal  é uma função de hardware, motor de serviço e carga de trabalho. O GGUF Q4_K_M ou Q5_K_M possui CPU e Edge, entregues através de llama.cpp e Ollama. O GPTQ ganha dentro do VLLM quando você precisa de multi-LoRA na mesma base. AWQ com kernels Marlin-AWQ entrega ~741 tok/s em um modelo de classe 7B com o melhor Pass@1 em INT4  o padrão 2026 para produção de datacenter. FP8 permanece no meio de Hopper, Ada e Blackwell  quase sem perdas e amplamente apoiado. NVFP4 e MXFP4 (microscaling Blackwell) são agressivos e exigem validação por bloco. Duas equipes de armadilhas: o conjunto de dados de calibração deve corresponder ao domínio de implantação, e o cache KV é separado da quantização de peso  a lição AWQ "meu modelo é 4 GB agora" esquece o cache KV de 10-30 GB em tamanhos de lote de produção.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy memory and throughput comparison across formats)
**Prerequisites:** Phase 10 · 13 (Quantization foundations), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Nomear os seis formatos de quantização da produção e os seus pontos de sucesso em 2026.
- Escolha um formato dado ao hardware (CPU vs GPU, Hopper vs Blackwell), motor (vLLM, TRT-LLM, llama.cpp), e carga de trabalho (chat de rotina, raciocínio, multi-LoRA).
- Calcule a memória de peso salvada e o cache KV deixado intocado para um formato escolhido.
- Nomear a armadilha do conjunto de dados de calibração que degrada os modelos quantizados no tráfego de domínio.

## O problema

A quantização reduz a memória e a largura de banda HBM, que é exatamente o que a decodificação precisa. Um modelo FP16 70B é de 140 GB de pesos. Quantize pesos para INT4 (AWQ ou GPTQ) e o modelo é de 35 GB  cabe em um H100 com espaço para cache KV, o que importa porque em 128 sequências simultâneas com contexto 2k, o cache KV sozinho é de 20-30 GB.

Mas a quantização não é gratuita. A quantização agressiva degrada a qualidade, especialmente em tarefas pesadas de raciocínio. Diferentes formatos funcionam com diferentes motores. Diferentes hardware suportam diferentes precisões nativamente. O formato zoológico 2026 é real e você não pode copiar a escolha de outra pessoa.

## O conceito

### Os seis formatos

| Format | Bits | Sweet spot | Engines |
|--------|------|-----------|---------|
| GGUF Q4_K_M / Q5_K_M | 4-5 | CPU, edge, laptops | llama.cpp, Ollama |
| GPTQ | 4-8 | Multi-LoRA on vLLM | vLLM, TGI |
| AWQ | 4 | Datacenter GPU production | vLLM (Marlin-AWQ), TGI |
| FP8 | 8 | Hopper/Ada/Blackwell datacenter | vLLM, TRT-LLM, SGLang |
| MXFP4 | 4 | Blackwell multi-user | TRT-LLM |
| NVFP4 | 4 | Blackwell multi-user | TRT-LLM |

### GGUF  o padrão de CPU/edge

GGUF é um formato de arquivo, não um esquema de quantização por si só. Ele agrupa variantes K-quantificadas (Q2_K, Q3_K_M, Q4_K_M, Q5_K_M, Q6_K, Q8_0) em um recipiente. Q4_K_M e Q5_K_M são os padrões de produção  qualidade próxima de BF16 em 4-5 bits. A melhor escolha para CPU ou Edge serve porque llama.cpp é de longe o motor de inferência de CPU mais rápido.

Penaltia de throughput em vLLM: ~93 tok/s em 7B  o formato não é otimizado para kernels de GPU. Use GGUF quando o objetivo de implantação é CPU/edge. Não de outra forma.

### GPTQ  multi-LoRA em VLLM

O GPTQ é um algoritmo de quantização pós-treino com um passo de calibração.

A vitória única: o GPTQ-Int4 suporta adaptadores LoRA em vLLM. Se você estiver servindo um modelo base mais 10 a 50 variantes afinadas (cada uma como um LoRA), o GPTQ é o seu caminho.

### AWQ  o GPU padrão do datacenter

Quantização de peso consciente de ativação. Protege os ~1% mais salientes durante a quantização. Núcleos Marlin-AWQ: 10,9x velocidade versus ingênuo. ~ 741 tok/s em 7B, melhor Pass@1 entre formatos INT4.

Escolha AWQ para o novo GPU de serviço, a menos que você precise de multi-LoRA (GPTQ) ou Blackwell FP4 agressivo (NVFP4).

### FP8  o meio confiável

FP8 é o padrão seguro de 2026 quando a qualidade não é negociável (razão, médico, código-gen).

### MXFP4 / NVFP4  Blackwell agressivo

Microescalação FP4. Cada bloco de pesos tem seu próprio fator de escala. Agressivo, mas acelerado por hardware em Blackwell Tensor Cores.

Cavernas:
- Ainda não há apoio ao LoRA (inicial de 2026).
- A queda de qualidade é visível nas cargas de trabalho pesadas.
- Valida o seu conjunto de avaliações por modelo.

### A armadilha de calibração

AWQ e GPTQ exigem um conjunto de dados de calibração  tipicamente C4 ou WikiText. Para modelos de domínio (código, médico, legal), calibrar em texto web genérico permite que o algoritmo tome decisões erradas sobre quais pesos proteger. Pass@1 no HumanEval pode cair vários pontos.

A solução é calibrar os dados do domínio, centenas de amostras de domínio são suficientes, testar o conjunto de avaliação antes de ser enviado.

### A armadilha de cache KV

AWQ reduz os pesos para 4 bits. O cache KV é separado e permanece em FP16/FP8. Para um modelo 70B com AWQ:

- Peso: ~ 35 GB (INT4 a partir de 140 GB).
- Cachem KV em 128 conteúdo simultâneo × 2k: ~ 20 GB.
- Ativações: ~ 5 GB.
- Total: ~ 60 GB  cabe no H100 80 GB.

Naivamente "Quantizei o meu modelo para 4 GB" esquece os outros 30-50 GB.

Separadamente, a quantização do cache KV (FP8 KV ou INT8 KV) é uma escolha diferente com suas próprias compensações  afeta diretamente a precisão da atenção e não é uma vitória livre.

### AWQ INT4 é perigoso para o raciocínio

Cadeia de pensamento, matemática, código-gen com longo contexto  estes sofrem visiblemente de quantização agressiva. AWQ INT4 perde ~ 3-5 pontos em MATH. Para cargas de trabalho pesadas de raciocínio, envia FP8 ou BF16; aceitar o custo de memória.

### Guia de escolha 2026

- Serviço de CPU/edge: GGUF Q4_K_M. Feito.
- Serviço de GPU, chat de rotina, sem LoRA.
- GPU serve, multi-LoRA: GPTQ com Marlin.
- Carga de trabalho de raciocínio: FP8.
- Centro de dados Blackwell, qualidade validada: NVFP4 + FP8 KV.
- Ambiguos: executar uma avaliação de 1000 amostras em cada formato candidato.

```figure
gpu-memory-breakdown
```

## Usá-lo

`code/main.py`Computa a pegada de memória (pesos + KV + ativações) e o throughput relativo nos seis formatos para uma gama de tamanhos de modelos. Mostra onde o cache KV domina, onde a compressão de peso paga e onde FP8 é a escolha segura.

O [Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?dtype=fp8&users=64)A máquina mostra FP8 em um NVIDIA L4. Os pesos caem de 15,28 GB para 8,81 GB, o pool de KV cresce de 24,094 para 142,369 tokens, e a saída medida em 64 usuários vai de 250,85 para 735,91 tokens por segundo.

## Envia-o

Esta lição produz`outputs/skill-quantization-picker.md`. Tendo em conta o hardware, o tamanho do modelo, o tipo de carga de trabalho e a tolerância à qualidade, escolhe um formato e elabora um plano de calibração/validação.

## Exercícios

1. Corra .`code/main.py`Para um modelo 70B em 128 simultâneos com contexto 2k, calcular o total de HBM para cada formato.
2. Se você estava errado sobre a tolerância de qualidade, qual é o caminho de recuperação?
3. Calcule o tamanho do conjunto de dados de calibração necessário para calibrar o AWQ para um modelo de domínio médico.
4. Leia o documento do kernel Marlin-AWQ ou as notas de lançamento. Explique em três frases por que AWQ atinge 741 tok/s em 7B enquanto GPTQ bruto atinge ~712.
5. Quando faz sentido combinar pesos AWQ com FP8 KV cache vs manter KV em BF16?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| GGUF | "llama.cpp format" | File format bundling K-quant variants; CPU/edge default |
| Q4_K_M | "Q4 K M" | 4-bit K-quant medium; the production GGUF default |
| GPTQ | "gee pee tee q" | Post-train INT4 with calibration; supports LoRA in vLLM |
| AWQ | "a w q" | Activation-aware INT4; Marlin kernels; best Pass@1 at INT4 |
| Marlin kernels | "fast INT4 kernels" | Custom CUDA kernels for INT4 on Hopper; 10x speedup |
| FP8 | "eight-bit float" | Safe precision default on Hopper/Ada/Blackwell |
| MXFP4 / NVFP4 | "microscaling four" | Blackwell 4-bit FP with per-block scale factors |
| Calibration dataset | "cal data" | Input text used to pick quantization parameters; must match domain |
| KV cache quantization | "KV INT8" | Separate choice from weights; affects attention accuracy |

## Mais leitura

- [VRLA Tech — LLM Quantization 2026](https://vrlatech.com/llm-quantization-explained-int4-int8-fp8-awq-and-gptq-in-2026/) índices de referência comparativos.
- [Jarvis Labs — vLLM Quantization Complete Guide](https://jarvislabs.ai/blog/vllm-quantization-complete-guide-benchmarks) Números de transmissão por formato.
- [PremAI — GGUF vs AWQ vs GPTQ vs bitsandbytes 2026](https://blog.premai.io/llm-quantization-guide-gguf-vs-awq-vs-gptq-vs-bitsandbytes-compared-2026/) Selecção por formato.
- [vLLM docs — Quantization](https://docs.vllm.ai/en/latest/features/quantization/index.html) formatos e bandeiras suportados.
- [AWQ paper (arXiv:2306.00978)](https://arxiv.org/abs/2306.00978) formulação original da AWQ.
- [GPTQ paper (arXiv:2210.17323)](https://arxiv.org/abs/2210.17323) formulação original do GPTQ.
