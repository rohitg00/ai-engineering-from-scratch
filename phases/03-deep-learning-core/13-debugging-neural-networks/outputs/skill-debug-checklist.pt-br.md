---
name: skill-debug-checklist
description: Lista de verificação da árvore de decisão para depuração de falhas de treinamento de redes neurais
version: 1.0.0
phase: 3
lesson: 13
tags: [debugging, neural-networks, training, diagnostics, deep-learning]
---

# Lista de verificação de depuração de rede neural

Protocolo de depuração sistemático para quando o treinamento dá errado. Trabalhe com eles em ordem - a maioria dos bugs são detectados nas três primeiras etapas.

## Antes do treino (prevenir bugs)

1. Imprima a arquitetura do modelo e a contagem de parâmetros. O tamanho faz sentido para seus dados?
2. Execute uma única passagem direta com entrada aleatória. O formato de saída corresponde ao formato de destino?
3. Verifique se os rótulos são do tipo correto (CrossEntropyLoss precisa de Long, BCELoss precisa de Float)
4. Verifique a normalização dos dados: as entradas devem ter média próxima de 0 e padrão próximo de 1
5. Imprima 5 pares aleatórios (entrada, rótulo). Os rótulos correspondem ao que você espera?
6. Confirme se a divisão de treinamento/teste não tem amostras duplicadas

## Teste Overfit-one-batch (60 segundos, detecta 80% dos bugs)

1. Pegue de 8 a 32 amostras do seu conjunto de treinamento
2. Treine 200 passos com uma taxa de aprendizado razoável
3. A perda deve se aproximar de 0. A precisão do treinamento deve atingir 100%
4. Se falhar: o bug está em seu modelo, função de perda ou loop de treinamento – não em seus dados ou hiperparâmetros
5. Se passar: prossiga para o treinamento completo

## Perda não diminuindo

1. Verifique a taxa de aprendizagem. Experimente 3 valores: atual/10, atual, atual*10
2. Imprima normas de gradiente por camada. Todos os zeros significam rede morta ou gráfico desanexado
3. Verifique `requires_grad=True` nos parâmetros. Verifique se `loss.backward()` é chamado
4. Verifique se `optimizer.zero_grad()` é chamado antes de `loss.backward()`
5. Verifique se `optimizer.step()` é chamado depois de `loss.backward()`
6. Verifique se os parâmetros do modelo foram passados para o otimizador: `optimizer = Adam(model.parameters())`

## A perda é NaN ou Inf

1. Reduza a taxa de aprendizagem em 10x
2. Adicione épsilon a todas as chamadas log(): `torch.log(x + 1e-7)`
3. Adicione épsilon a todas as divisões: `x / (y + 1e-8)`
4. Previsões de fixação: `torch.clamp(pred, 1e-7, 1 - 1e-7)` antes da perda BCE
5. Use `torch.autograd.detect_anomaly()` para encontrar a operação exata
6. Verifique NaN nos dados de entrada: `assert not torch.isnan(x).any()`

## Perda oscilante

1. Reduza a taxa de aprendizagem em 3 a 10x
2. Aumente o tamanho do lote (reduz o ruído gradiente)
3. Adicione recorte gradiente: `torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)`
4. Mude de SGD para Adam (LR adaptativo por parâmetro)
5. Adicione aquecimento à taxa de aprendizagem para os primeiros 5-10% do treinamento

## Overfitting (treinar acc alta, testar acc baixa)

1. Adicione dropout (comece com p = 0,1, aumente para 0,5)
2. Adicione redução de peso ao otimizador: `Adam(params, weight_decay=1e-4)`
3. Reduza o tamanho do modelo (menos camadas ou camadas mais estreitas)
4. Adicione aumento de dados
5. Use parada antecipada: pare quando a perda de validação aumentar por mais de 5 épocas
6. Verifique se há vazamento de dados entre o trem e os conjuntos de teste

## Underfitting (treinamento e teste com baixa contagem)

1. Aumente a capacidade do modelo (mais camadas, camadas mais largas)
2. Treine para mais épocas
3. Aumente a taxa de aprendizagem (com cuidado)
4. Remova a regularização temporariamente para verificar se o modelo pode aprender
5. Verifique se o seu modelo é expressivo o suficiente para a tarefa

## Neurônios ReLU mortos

1. Verifique a fração de zero ativações por camada. >50% é um problema
2. Mude para LeakyReLU(0.01) ou GELU
3. Use a inicialização Kaiming para pesos
4. Reduza a taxa de aprendizagem (grandes atualizações podem empurrar os neurônios para a zona morta)
5. Adicionar normalização em lote antes das funções de ativação

## Referência rápida: pontos iniciais da taxa de aprendizagem

| Otimizador | Tarefa | Iniciando o LR |
|-----------|------|-----------|
| Adão | Treinamento do zero | 1e-3 |
| Adão | Ajuste fino pré-treinado | 1e-5 |
| SGD + impulso | Treinamento do zero | 1e-1 |
| SGD + impulso | Ajuste fino pré-treinado | 1e-3 |
| Adam W | Treinamento de transformadores | 3e-4 |

## Referência rápida: efeitos de tamanho de lote

| Tamanho do lote | Ruído gradiente | Memória | Generalização |
|-----------|---------------|--------|---------------|
| 8-16 | Alto (ruído) | Baixo | Muitas vezes melhor |
| 32-64 | Moderado | Moderado | Bom padrão |
| 128-256 | Baixo (suave) | Alto | Pode precisar de aquecimento |
| 512+ | Muito baixo | Muito alto | Precisa de escala LR |

## Quando nada funciona

1. Simplifique o modelo para 1 camada oculta. Isso aprende?
2. Simplifique os dados para 100 amostras. Ele se ajusta demais?
3. Substitua sua perda por MSE. Isso converge?
4. Substitua seu otimizador por SGD(lr=0,01). Isso faz progresso?
5. Substitua seus dados por dados sintéticos (por exemplo, y = x[0] > 0). Isso aprende?
6. Se nada disso funcionar: o bug está no código que você não está vendo (carregamento de dados, pré-processamento, formas de tensor)