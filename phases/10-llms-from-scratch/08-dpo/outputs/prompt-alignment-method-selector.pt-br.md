---
name: prompt-alignment-method-selector
description: Escolha o método de alinhamento correto (SFT, RLHF, DPO, KTO, ORPO, SimPO) para seu caso de uso
version: 1.0.0
phase: 10
lesson: 8
tags: [alignment, dpo, rlhf, kto, orpo, simpo, preference-optimization, fine-tuning]
---

# Seletor de Método de Alinhamento

Ao escolher um método de alinhamento para um modelo de linguagem, use esta estrutura para avaliar seus dados, computação e requisitos de qualidade e, em seguida, selecione o método que melhor se adapta às suas restrições.

## Requisitos de entrada

Fornecer:
- **Modelo básico** (por exemplo, Llama 3 8B, Mistral 7B, Qwen 2.5 72B)
- **Ponto de partida** (modelo básico ou já SFT?)
- **Dados disponíveis** (pares de instruções, pares de preferências, classificações não pareadas ou nenhuma)
- **Orçamento de computação** (horas de GPU, número de GPUs)
- **Meta de qualidade** (boa o suficiente para protótipo, competitiva com código aberto, estado da arte)
- **Cronograma** (dias, semanas, meses)

## Matriz de decisão

### Seleção Rápida

| Sua situação | Método recomendado | Por que |
|---------------|-----------------------|-----|
| Sem dados de preferência, apenas pares de instruções | Apenas OFVM | Você não pode alinhar sem sinal de preferência |
| <5.000 pares de preferências, computação limitada | DPO | Pipeline mais simples, funciona bem com pequenos dados |
| Feedback não pareado (apenas polegar para cima/para baixo) | KTO | Único método que funciona sem comparações entre pares |
| Quer alinhamento em uma única execução de treinamento | ORPO | Combina SFT + alinhamento, sem modelo de referência |
| Com restrição de memória (não cabe no modelo de referência) | SimPO | Não é necessário modelo de referência |
| Alinhamento multiobjetivo em grande escala | RLHF (PPO) | Modelo de recompensa separado captura preferências complexas |
| Alinhamento iterativo com dados online | RLHF (PPO) | Pode gerar, avaliar e treinar novamente em um loop |
| Refinamento pós-RLHF | DPO | Ajustar um modelo RLHF em preferências direcionadas |

### Comparação detalhada

| Método | Exigência de dados | Modelos na memória | Ciclos de treinamento | Estabilidade | Melhor Escala |
|--------|-----------------|-----------------|----------------|-----------|------------|
| OFVM | Pares de instruções (10K+) | 1 | 1 | Alto | Qualquer |
| RLHF | Pares de preferência (20K+) | 3-4 | 3 | Baixo | Grande (70B+) |
| DPO | Pares de preferência (5K+) | 2 | 2 (SFT + DPO) | Alto | Pequeno-Médio (7B-70B) |
| KTO | Avaliações não pareadas (5K+) | 2 | 2 (SFT + KTO) | Alto | Qualquer |
| ORPO | Pares de preferência (10K+) | 1 | 1 | Alto | Pequeno-Médio |
| SimPO | Pares de preferência (5K+) | 1 | 2 (SFT + SimPO) | Alto | Pequeno-Médio |

## Configuração específica do método

###FT

- **Quando parar**: após 1-3 épocas ou quando a perda de validação parar de diminuir
- **Hiperparâmetro principal**: Taxa de aprendizado (1e-5 a 5e-5, menor para modelos maiores)
- **Detalhe crítico**: mascarar tokens de instrução na perda
- **Te peguei**: Mais de 3 épocas causa memorização; misture 2-5% de dados de pré-treinamento

### RLHF (PPO)

- **Quando usar**: você tem mais de 20 mil pares de comparação, precisa de alinhamento multiobjetivo ou deseja aprendizagem on-line iterativa
- **Principais hiperparâmetros**: coeficiente KL (0,01-0,05), proporção de clipe PPO (0,1-0,3), taxa de aprendizagem (5e-6 a 3e-5)
- **Detalhe crítico**: o modelo de recompensa deve ser >= tamanho do modelo de política
- **Entendi**: PPO está instável; monitorar curvas de divergência e recompensa KL continuamente

###DPO

- **Quando usar**: você tem pares de preferência e deseja um pipeline mais simples que o RLHF
- **Hiperparâmetro principal**: Beta (0,1-0,5; menor = mais desvio da referência permitido)
- **Detalhe crítico**: o modelo de referência deve ser uma cópia congelada do ponto de verificação SFT
- **Te peguei**: Muito sensível ao beta; execute uma varredura em [0,05, 0,1, 0,2, 0,5]

###KTO

- **Quando usar**: você só tem rótulos "bons" ou "ruins" sem comparações entre pares
- **Hiperparâmetro chave**: Beta (igual ao DPO), multiplicador de aversão à perda (1,5x em respostas ruins)
- **Detalhes críticos**: Precisa de exemplos bons/maus aproximadamente equilibrados (divisão de 40-60%)
- **Peguei**: Sem pares, o sinal gradiente é mais fraco; pode precisar de mais dados que o DPO

###ORPO

- **Quando usar**: você deseja pular totalmente o SFT e ir direto da base para o alinhado
- **Hiperparâmetro principal**: Lambda (peso do termo de preferência vs termo SFT)
- **Detalhe crítico**: precisa de rótulos de instruções E pares de preferências em um conjunto de dados
- **Peguei**: O objetivo combinado pode ser difícil de equilibrar; se a perda SFT dominar, o alinhamento é fraco

###SimPO

- **Quando usar**: configuração com restrição de memória onde você não pode manter um modelo de referência
- **Hiperparâmetro chave**: Beta, gama (expoente de normalização de comprimento)
- **Detalhe crítico**: a normalização do comprimento evita que o modelo favoreça respostas curtas
- **Pegadinha**: Sem uma âncora de modelo de referência, o modelo pode desviar ainda mais; monitore cuidadosamente

## Modelos de pipeline

### Modelo 1: Protótipo Rápido (1-2 dias)

```
Base Model -> SFT (1 epoch, 10K examples) -> DPO (3 epochs, 5K pairs)
```

Cálculo: ~4 horas de GPU para o modelo 7B no A100
Qualidade: Seguimento de instruções sólidas, alinhamento de preferências básicas

### Modelo 2: Qualidade de produção (1-2 semanas)

```
Base Model -> SFT (2 epochs, 50K examples) -> DPO (5 epochs, 20K pairs) -> Eval -> Iterate
```

Computação: ~40 horas de GPU para 7B, ~200 horas de GPU para 70B
Qualidade: Competitiva com modelos RLHF de código aberto

### Modelo 3: Estado da Arte (1-3 meses)

```
Base Model -> SFT (2 epochs, 100K+ examples) -> RLHF (PPO, 50K+ pairs) -> DPO (targeted refinement) -> Eval -> Iterate
```

Computação: ~500+ horas de GPU para 70B
Qualidade: Aproximando-se do alinhamento do modelo de fronteira

### Modelo 4: dados mínimos (1-2 dias)

```
Base Model -> SFT (1 epoch, 5K examples) -> KTO (unpaired thumbs up/down from users)
```

Computação: ~2 horas de GPU para 7B
Qualidade: Melhor que apenas SFT com sobrecarga mínima de coleta de dados

## Protocolo de Avaliação

Após o alinhamento, avalie estas dimensões:

1. **Taxa de ganho de preferência**: compare o modelo alinhado com o modelo SFT em mais de 200 prompts de teste com juízes humanos. Meta: > 60% de taxa de vitória.
2. **Retenção de benchmark**: MMLU, HumanEval ou benchmarks específicos de domínio. Não deve cair > 5% da linha de base do SFT.
3. **MT-Bench ou AlpacaEval**: Referências de qualidade de alinhamento padrão. Compare com as linhas de base publicadas.
4. **Avaliação de segurança**: Teste contra solicitações adversárias, jailbreaks e categorias de solicitações prejudiciais.
5. **Diversidade de respostas**: Meça a entropia das respostas em 100 prompts. Baixa entropia = colapso do modo.

## Modos de falha comuns

| Sintoma | Causa | Correção específica do método |
|--------|-------|-------------------|
| Respostas detalhadas e preenchidas | Modelo de recompensa/recompensa implícita favorece duração | DPO: aumentar beta. RLHF: adiciona penalidade de comprimento. SimPO: ajuste gama. |
| Modelo concorda com tudo | Bajulação devido ao viés de dados de preferência | Adicionar pares de preferências onde a resposta correta discorda do usuário |
| Recusa pedidos benignos | Excesso de alinhamento nos dados de segurança | Reduzir a proporção de exemplos de segurança, adicionar mais pares de recusa benigna |
| Os resultados são quase idênticos aos SFT | Beta demasiado elevado (DPO/KTO) ou coeficiente KL demasiado elevado (PPO) | Coeficiente beta/KL inferior; o modelo não está aprendendo |
| Perda de treino oscila | Taxa de aprendizagem demasiado elevada ou dados insuficientes | Reduza lr em 2-3x; aumentar os dados de preferência |