# Fine-Tuning com LoRA & QLoRA

> Fine-tuning completo de um modelo 7B requer 56GB de VRAM. Você não tem isso. A maioria das empresas também não tem. LoRA permite fazer fine-tuning do mesmo modelo com 6GB treinando menos de 1% dos parâmetros. Não é um compromisso — corresponde à qualidade de fine-tuning completo na maioria das tarefas. O ecossistema inteiro de fine-tuning open-source roda nesse truque.

**Tipo:** Construção
**Linguagens:** Python
**Pré-requisitos:** Fase 10, Aula 06 (Instruction Tuning / SFT)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Implementar LoRA injetando matrizes de adaptador de baixo rank (A e B) nas camadas de attention de um modelo pré-treinado
- Calcular a economia de parâmetros de LoRA vs fine-tuning completo
- Fazer fine-tuning com QLoRA (base quantizada em 4-bit + adaptadores LoRA) para caber na memória de GPUs de consumo
- Mesclar pesos LoRA de volta no modelo base para implantação e comparar velocidade de inferência com e sem adaptadores

## O Problema

Você tem um modelo base. Llama 3 8B. Quer que ele responda tickets de suporte com a voz da sua empresa. SFT é a resposta. Mas SFT tem problema de custo.

Fine-tuning completo atualiza cada parâmetro do modelo. Llama 3 8B tem 8 bilhões de parâmetros. Em fp16, cada parâmetro ocupa 2 bytes. São 16GB só para carregar os pesos. Durante o treino, você também precisa de gradientes (16GB), estados do otimizador Adam (32GB) e ativações. Total: ~56GB de VRAM.

Um A100 80GB mal cabe. Dois A100s custam $3-4/hora. Treinar 3 épocas em 50.000 exemplos leva 6-10 horas. São $30-40 por experimento. Rode 10 experimentos para ajustar hiperparâmetros e gastou $400 antes de implantar qualquer coisa.

Tem um problema mais profundo: fine-tuning completo modifica cada peso. Se você faz fine-tuning com dados de suporte, pode degradar capacidades gerais do modelo. Isso se chama esquecimento catastrófico.

## O Conceito

### LoRA: Low-Rank Adaptation

Edward Hu e colegas publicaram LoRA em 2021. Insight: as atualizações de peso durante fine-tuning têm rank intrínseco baixo. Você não precisa atualizar todos os 16.7 milhões de parâmetros em uma matriz de 4096x4096.

```
y = Wx          # Camada linear padrão
y = Wx + BAx    # Com LoRA (B: d_out x r, A: r x d_in)
```

Para r=16 em uma camada de 4096x4096:
- Parâmetros originais: 16.777.216
- Parâmetros LoRA: 131.072
- Redução: 0,78%

Você treina 0,78% dos parâmetros e obtém 95-100% da qualidade.

### QLoRA: Quantização 4-bit + LoRA

| Método | Memória Pesos (7B) | Memória Treino (7B) | GPU Necessária |
|--------|-------------------|--------------------|----|
| Fine-tune completo (fp16) | 14GB | ~56GB | 1x A100 80GB |
| LoRA (base fp16) | 14GB | ~18GB | 1x A100 40GB |
| QLoRA (base 4-bit) | 3,5GB | ~6GB | 1x RTX 3090 24GB |

QLoRA faz três contribuições técnicas:
- **NF4 (Normal Float 4-bit)**: Tipo de dado 4-bit com níveis de quantização em quantis de distribuição normal
- **Double quantization**: Quantiza as constantes de escala para fp8, reduzindo overhead
- **Paged optimizers**: Usa memória unificada da NVIDIA para paginação automática para CPU

### Quando NÃO Fazer Fine-Tuning

1. **Primeiro: prompt engineering.** Custo zero, minutos para implementar.
2. **Segundo: RAG.** Se o modelo precisa de dados eespecificaçãoíficos, retrieval é mais barato.
3. **Terceiro: fine-tuning.** Use quando precisa de estilo/formato eespecificaçãoífico, output estruturado consistente ou destilar modelo maior em menor.

## Construa

### Passo 1: A Camada LoRA

```python
import torch
import torch.nn as nn
import math

class LoRALayer(nn.Module):
    def __init__(self, in_features, out_features, rank=8, alpha=16):
        super().__init__()
        self.rank = rank
        self.alpha = alpha
        self.scaling = alpha / rank

        self.A = nn.Parameter(torch.randn(in_features, rank) * (1 / math.sqrt(rank)))
        self.B = nn.Parameter(torch.zeros(rank, out_features))

    def forward(self, x):
        return (x @ self.A @ self.B) * self.scaling
```

### Passo 2: Linear com LoRA

```python
class LinearWithLoRA(nn.Module):
    def __init__(self, linear, rank=8, alpha=16):
        super().__init__()
        self.linear = linear
        self.lora = LoRALayer(
            linear.in_features, linear.out_features, rank, alpha
        )
        for param in self.linear.parameters():
            param.requires_grad = False

    def forward(self, x):
        return self.linear(x) + self.lora(x)
```

### Passo 3: Injetar LoRA no Modelo

```python
def inject_lora(model, target_modules, rank=8, alpha=16):
    for param in model.parameters():
        param.requires_grad = False

    lora_layers = {}
    for name, module in model.named_modules():
        if isinstance(module, nn.Linear):
            if any(t in name for t in target_modules):
                parent_name = ".".join(name.split(".")[:-1])
                child_name = name.split(".")[-1]
                parent = dict(model.named_modules())[parent_name]
                lora_linear = LinearWithLoRA(module, rank, alpha)
                setattr(parent, child_name, lora_linear)
                lora_layers[name] = lora_linear
    return lora_layers
```

### Passo 4: Merge dos Pesos

```python
def merge_lora_weights(model):
    for name, module in model.named_modules():
        if isinstance(module, LinearWithLoRA):
            with torch.no_grad():
                merged = (module.lora.A @ module.lora.B) * module.lora.scaling
                module.linear.weight.data += merged.T
            parent_name = ".".join(name.split(".")[:-1])
            child_name = name.split(".")[-1]
            if parent_name:
                parent = dict(model.named_modules())[parent_name]
            else:
                parent = model
            setattr(parent, child_name, module.linear)
```

## Use

### Hugging Face PEFT

```python
# from transformers import AutoModelForCausalLM, AutoTokenizer
# from peft import LoraConfig, get_peft_model, TaskType
#
# model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.1-8B")
# tokenizer = AutoTokenizer.from_pretrained("meta-llama/Llama-3.1-8B")
#
# lora_config = LoraConfig(
#     task_type=TaskType.CAUSAL_LM,
#     r=16,
#     lora_alpha=32,
#     lora_dropout=0.05,
#     target_modules=["q_proj", "v_proj"],
# )
#
# model = get_peft_model(model, lora_config)
# model.print_trainable_parameters()
```

### QLoRA com bitsandbytes

```python
# from transformers import BitsAndBytesConfig
#
# bnb_config = BitsAndBytesConfig(
#     load_in_4bit=True,
#     bnb_4bit_quant_type="nf4",
#     bnb_4bit_compute_dtype=torch.bfloat16,
#     bnb_4bit_use_double_quant=True,
# )
#
# model = AutoModelForCausalLM.from_pretrained(
#     "meta-llama/Llama-3.1-8B",
#     quantization_config=bnb_config,
#     device_map="auto",
# )
#
# model = get_peft_model(model, lora_config)
```

## Entregue

- `outputs/prompt-lora-advisor.md` — prompt para ajudar a decidir rank, target modules e hiperparâmetros
- `outputs/skill-fine-tuning-guide.md` — skill com árvore de decisão para quando e como fazer fine-tuning

## Exercícios

1. **Estudo de ablação de rank**: Execute com ranks 2, 4, 8, 16, 32 e 64. Plote loss final vs rank.

2. **Comparação de target modules**: Modifique inject_lora para alvo apenas camada "0", "2", "4" e todas.

3. **Análise de erro de quantização**: Calcule MSE, erro absoluto máximo e correlação antes/depois da quantização.

4. **Servindo multi-adapters**: Treine dois LoRA adapters em subsets diferentes dos dados. Troque entre eles.

5. **Merge vs não-merge**: Compare output antes e depois de merge_lora_weights nos mesmos 100 inputs.

## Termos-Chave

| Termo | O que o pessoal diz | O que realmente significa |
|-------|--------------------|-----------------------|
| LoRA | "Fine-tuning eficiente" | Low-Rank Adaptation: congelar pesos base, treinar duas matrizes pequenas A e B |
| QLoRA | "Fine-tuning no laptop" | LoRA quantizado: base em 4-bit NF4 + adaptadores LoRA em fp16 |
| Rank (r) | "Quanto o modelo pode aprender" | Dimensão interna das matrizes A e B; controla expressividade vs contagem de parâmetros |
| Alpha | "Taxa de aprendizado do LoRA" | Fator de escala aplicado à saída LoRA |
| NF4 | "Quantização 4-bit" | Normal Float 4: tipo de dado 4-bit otimizado para pesos de rede neural |
| Adapter | "Parte pequena treinada" | Matrizes LoRA A e B salvas como arquivo separado (10-100MB) |
| Merging | "Assentar no modelo" | Computar W + (alpha/r) * BA e substituir o peso original |
| Catastrophic forgetting | "Fine-tuning quebrou tudo" | Quando atualizar todos os pesos faz o modelo perder capacidades anteriores |

## Leitura Adicional

- [Hu et al., "LoRA: Low-Rank Adaptation" (2021)](https://arxiv.org/abs/2106.09685) — paper original do LoRA
- [Dettmers et al., "QLoRA" (2023)](https://arxiv.org/abs/2305.14314) — paper do QLoRA com NF4 e double quantization
- [PEFT documentation](https://huggingface.co/docs/peft) — documentação oficial do PEFT
- [TRL documentation](https://huggingface.co/docs/trl/) — referência para SFTTrainer, DPOTrainer
- [Unsloth documentation](https://docs.unsloth.ai/) — kernels fused para 2-5x de speedup
- [Axolotl documentation](https://axolotl-ai-cloud.github.io/axolotl/) — trainer SFT/DPO/QLoRA configurável via YAML
