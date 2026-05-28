---
name: prompt-reward-model-designer
description: Projetar pipelines de treinamento de modelo de recompensa para alinhamento RLHF
version: 1.0.0
phase: 10
lesson: 7
tags: [rlhf, reward-model, ppo, alignment, human-feedback, preference-learning]
---

# Designer de modelo de recompensa

Ao construir um pipeline RLHF para alinhar um modelo de linguagem a um comportamento alvo (utilidade, capacidade de codificação, segurança, honestidade), use esta estrutura para projetar o protocolo de coleta de dados, treinar o modelo de recompensa e configurar o PPO.

## Requisitos de entrada

Fornecer:
- **Comportamento alvo** (por exemplo, "assistente prestativo e inofensivo", "codificador especialista em Python", "perguntas e respostas médicas com segurança")
- **Modelo básico** (por exemplo, Llama 3 8B após SFT, Mistral 7B Chat)
- **Tamanho do modelo de recompensa** (normalmente do mesmo tamanho ou maior que o modelo de política)
- **Orçamento de anotação** (horas humanas ou pares de comparação disponíveis)
- **Orçamento de computação** (horas de GPU para treinamento de modelo de recompensa + PPO)

## Etapa 1: coleta de dados de preferência

### Protocolo de anotação

1. **Seleção de prompts**: Amostra da distribuição de treinamento SFT mais avisos fora de distribuição (10-20% novos)
2. **Geração de resposta**: Gere de 2 a 4 respostas por prompt usando o modelo SFT com diferentes temperaturas (0,3, 0,7, 1,0)
3. **Formato de comparação**: mostre aos anotadores exatamente 2 respostas e pergunte "Qual resposta é melhor?"
4. **Rubrica de critérios**: defina o que "melhor" significa para seu caso de uso

### Modelo de rubrica

| Critério | Peso | Descrição |
|-----------|--------|-------------|
| Utilidade | 40% | Ele responde à pergunta completa e corretamente? |
| Inocuidade | 25% | Evita conteúdo prejudicial, tendencioso ou enganoso? |
| Honestidade | 20% | Reconhece a incerteza em vez de ter alucinações? |
| Concisão | 15% | A resposta tem um comprimento apropriado para a pergunta? |

Ajuste os pesos para seu caso de uso. Um assistente de codificação pode ponderar a correção em 60% e a concisão em 20%.

### Diretrizes de tamanho de dados

| Escala | Pares de comparação | Horas do anotador | Precisão RM esperada |
|-------|-----------------|-----------------|---------------------|
| Mínimo viável | 5.000-10.000 | 400-800 | 60-65% |
| Produção v1 | 20.000-50.000 | 1.600-4.000 | 65-72% |
| Produção v2 | 100.000-500.000 | 8.000-40.000 | 72-78% |

O InstructGPT usou 33.000 comparações de 40 prestadores de serviços. O artigo inicial da Anthropic usou 22.000 de 20 anotadores. A concordância entre anotadores é normalmente de 70-75% – o modelo de recompensa não pode exceder os níveis de concordância humana.

### Controle de Qualidade

- **Filtragem de acordo**: descarte pares onde menos de 70% dos anotadores concordam
- **Calibração do anotador**: execute rodadas de calibração com pares em bom estado antes da anotação real
- **Detecção de preconceito**: monitore se os anotadores preferem consistentemente respostas mais longas, linguagem formal ou padrões específicos
- **Exemplos adversários**: inclua de 5 a 10% de exemplos projetados para capturar anotadores que não estão lendo com atenção

## Etapa 2: Arquitetura do modelo de recompensa

### Decisões de Arquitetura

| Decisão | Recomendação | Justificativa |
|----------|---------------|----------|
| Arquitetura básica | Mesmo transformador da política | A inicialização do peso do ponto de verificação SFT oferece fortes recursos iniciais |
| Cabeça de saída | Projeção linear única do último estado oculto | Recompensa escalar da representação de posição mais completa |
| Tamanho do modelo | >= tamanho do modelo de política | RM menor produz sinais não confiáveis ​​que desestabilizam o PPO |
| Inicialização | Ponto de verificação SFT com novo cabeçote de saída | Recursos pré-treinados já capturam a qualidade da linguagem |

### Configuração de treinamento

| Parâmetro | Alcance | Notas |
|-----------|-------|-------|
| Taxa de aprendizagem | 1e-5 a 5e-5 | Inferior ao SFT porque a tarefa é mais simples |
| Épocas | 1-3 | Overfitting é um grande risco com dados de comparação limitados |
| Tamanho do lote | 64-256 | Cada "exemplo" é um par, então os dados efetivos são 2x |
| Função de perda | Bradley-Terry: -log(sigmoid(r_preferred - r_rejected)) | Padrão para comparações pareadas |
| Divisão de validação | 10-20% | Monitore a precisão em pares mantidos |

### Métricas de avaliação

1. **Precisão aos pares**: Que fração de pares de preferências mantidos o RM classifica corretamente? Meta: > 65%
2. **Distribuição de margem**: Trace a distribuição de (r_preferido - r_rejeitado). Deve ser centralizado acima de 0 com poucos negativos.
3. **Calibração**: O sigmoid(r_preferred - r_rejected) está próximo da probabilidade real de preferência humana?
4. **Generalização OOD**: teste em prompts de uma distribuição diferente da do treinamento. A precisão deve cair <10%.

## Etapa 3: Configuração do PPO

### Hiperparâmetros

| Parâmetro | Valor típico | Efeito de estar muito alto | Efeito de estar muito baixo |
|-----------|--------------|--------------|------------------------|
| Coeficiente KL (beta) | 0,01-0,05 | Modelo mal aprende e fica muito próximo do SFT | Recompensa hacking, resultados degenerados |
| Taxa de aprendizagem | 5e-6 a 3e-5 | Instabilidade de treinamento, divergência | Convergência lenta, computação desperdiçada |
| Proporção de clipe (épsilon) | 0,1-0,3 | Atualizações grandes e potencialmente desestabilizadoras | Atualizações muito conservadoras, aprendizagem lenta |
| Épocas PPO por lote | 1-4 | Overfitting para o lote atual | Subutilização de cada lote |
| Tamanho do lote de geração | 128-512 | Problemas de memória | Estimativas de gradiente ruidoso |
| Comprimento máximo da resposta | 256-1024 | Geração lenta, problemas de memória | Trunca respostas úteis |

### Painel de monitoramento

Acompanhe estas métricas durante o treinamento PPO:

1. **Recompensa média**: Deve aumentar durante o treinamento. Platô está bem; diminuição significa instabilidade.
2. **Divergência KL**: Deve ficar abaixo de 10-20 nats. Spike = hacking de recompensa.
3. **Duração da resposta**: deve permanecer estável. Aumento monotônico = hacking de recompensa de verbosidade.
4. **Entropia**: A entropia da distribuição de tokens deve diminuir lentamente. Diminuição rápida = colapso do modo.
5. **Acordo de modelo de recompensa**: Pontue as respostas do PPO com o modelo de recompensa; acordo deverá melhorar.

### Bandeiras vermelhas durante o PPO

| Sintoma | Causa provável | Correção |
|--------|-------------|-----|
| A recompensa aumenta, mas os resultados diminuem | Hacking de recompensa | Aumentar o coeficiente KL, retreinar RM em exemplos adversários |
| A divergência KL explode | Taxa de aprendizagem demasiado elevada ou coeficiente KL demasiado baixo | Reduza lr, aumente beta |
| O comprimento da resposta cresce monotonicamente | RM recompensa verbosidade | Adicionar penalidade de comprimento à recompensa, treinar novamente RM com pares controlados por comprimento |
| Todas as respostas tornam-se idênticas | Colapso do modo | Aumentar a temperatura de geração, reduzir épocas de PPO |
| A recompensa oscila descontroladamente | Instabilidade do PPO | Reduza a taxa de aprendizagem, aumente a proporção do clipe |

## Etapa 4: Validação ponta a ponta

Antes de implantar um modelo treinado em RLHF:

1. **Teste A/B vs SFT**: Execute os modelos SFT e RLHF em mais de 200 prompts de teste. Peça a mais de 3 avaliadores que comparem as respostas. O modelo RLHF deve vencer > 60% das vezes.
2. **Avaliação de segurança**: teste em prompts adversários conhecidos (jailbreaks, solicitações prejudiciais). O modelo RLHF deveria recusar adequadamente.
3. **Verificação de regressão**: execute benchmarks padrão (MMLU, HumanEval, MT-Bench) para confirmar se o modelo RLHF não perdeu os recursos principais.
4. **Verificação de esquecimento**: Meça a perplexidade em um corpus de texto geral. O aumento deve ser <10% em relação ao modelo SFT.
5. **Análise de comprimento**: compare o comprimento médio de resposta entre os modelos SFT e RLHF. Se o RLHF for > 50% mais longo, o modelo de recompensa provavelmente terá um viés de verbosidade.