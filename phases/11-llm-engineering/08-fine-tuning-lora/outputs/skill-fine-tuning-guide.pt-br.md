---
name: skill-fine-tuning-guide
description: Decision tree for when and how to fine-tune LLMs with LoRA and QLoRA
version: 1.0.0
phase: 11
lesson: 8
tags: [fine-tuning, lora, qlora, peft, llm-engineering]
---
---
name: skill-fine-tuning-guide
description: Decision tree for when and how to fine-tune LLMs with LoRA and QLoRA
version: 1.0.0
phase: 11
lesson: 8
tags: [fine-tuning, lora, qlora, peft, llm-engineering]
---

# Guia de decisão de ajuste fino

Antes do ajuste fino, tente estes em ordem:

```
1. Prompt engineering (minutes, $0)
2. Few-shot examples in prompt (minutes, $0)
3. RAG for knowledge retrieval (days, $10-100/month)
4. Fine-tuning with LoRA/QLoRA (days, $5-50 per experiment)
5. Full fine-tuning (weeks, $100-10,000 per run)
```

Só passe para a próxima etapa se a anterior for mensuravelmente insuficiente.

## Quando fazer o ajuste fino

- O modelo precisa de um estilo ou formato de saída consistente que o prompt não consegue alcançar
- Você está destilando um modelo maior (qualidade GPT-4 de um modelo 8B)
- A latência é importante e exemplos de poucas tentativas adicionam muitos tokens
- Você precisa que o modelo siga de forma confiável um padrão de raciocínio complexo
- Você tem mais de 1.000 exemplos de alta qualidade do comportamento de entrada-saída desejado

## Quando NÃO fazer o ajuste fino

- O modelo já faz o que você quer com o prompt certo
- Você precisa do modelo para conhecer os fatos (use RAG)
- Você tem menos de 500 exemplos de treinamento (provavelmente superajustados)
- A tarefa muda frequentemente (a reciclagem é cara)
- Você precisa auditar quais dados influenciaram um resultado específico (o ajuste fino é uma caixa preta)

## Seleção de método

| GPU VRAM | Modelo 7B | Modelo 13B | Modelo 70B |
|----------|----------|-----------|-----------|
| 16 GB (T4) | QLoRA | Não é viável | Não é viável |
| 24 GB (3090/4090) | QLoRA ou LoRA | QLoRA | Não é viável |
| 40 GB (A100) | LoRA ou Completo | QLoRA ou LoRA | QLoRA |
| 80GB (A100/H100) | Completo | LoRA ou Completo | QLoRA ou LoRA |

## Lista de verificação de configuração LoRA

1. Comece com r=16, alfa=32 (padrão seguro para a maioria das tarefas)
2. Almeje q_proj e v_proj primeiro (LoRA mínimo viável)
3. Use a taxa de aprendizagem 2e-4 para QLoRA, 5e-5 para LoRA fp16
4. Defina lora_dropout=0,05
5. Treine por 1-3 épocas (mais riscos de overfitting)
6. Avalie cada 100 passos em um conjunto resistido
7. Salve pontos de verificação e escolha o melhor por perda de avaliação

## Erros comuns

- Treinamento para muitas épocas (overfitting após a época 2-3 em pequenos conjuntos de dados)
- Usando a mesma taxa de aprendizagem do ajuste fino completo (LoRA precisa de LR mais alto)
- Esquecer de definir o pad token (causa perdas de NaN com modelos Llama)
- Não congelar o modelo base (anula o propósito do LoRA)
- Avaliar apenas os dados de treinamento (sempre espere 10-20% para avaliação)
- Ignorar a linha de base de engenharia do prompt (ajustar um problema que o prompt já resolve)

## Verificação de qualidade

Após o treinamento, compare mais de 200 exemplos sustentados:
1. Modelo base com melhor prompt (linha de base)
2. Modelo básico com adaptador LoRA (seu modelo ajustado)
3. GPT-4 ou Claude com o mesmo prompt (teto)

Se o modelo LoRA não superar a linha de base solicitada, seus dados ou configuração de treinamento precisarão de trabalho, e não de mais computação.

## Gerenciamento de adaptador

- Mantenha os adaptadores separados para atendimento multitarefa (troque os adaptadores por solicitação)
- Mesclar adaptadores em pesos básicos para implantação de tarefa única
- Armazene adaptadores no Hugging Face Hub (10-100 MB, fácil de versionar e compartilhar)
- Teste as saídas do modelo mesclado que correspondam às saídas não mescladas antes da implantação
- Use TIES-Merging ou DARE para combinar vários adaptadores em um

## Treinamento de depuração

Se a perda não diminuir:
1. Verifique a taxa de aprendizagem (muito baixa para LoRA, tente 2e-4)
2. Verifique se as camadas LoRA estão realmente recebendo gradientes
3. Confirme se os pesos do modelo base estão congelados
4. Verifique a formatação dos dados (o tokenizer deve corresponder ao formato esperado do modelo)

Se a perda diminuir, mas a qualidade da avaliação for ruim:
1. Problema de qualidade dos dados de treinamento (entra lixo, sai lixo)
2. Overfitting (reduzir épocas, aumentar o abandono, adicionar mais dados)
3. Módulos de destino errados (adicionar camadas MLP para tarefas complexas)
4. Classificação muito baixa (tente r=32 ou r=64)