---
name: skill-feature-selector
description: Árvore de decisão de referência rápida para escolher o método correto de seleção de recursos
version: 1.0.0
phase: 2
lesson: 18
tags: [feature-selection, mutual-information, rfe, lasso, tree-importance]
---

# Estratégia de seleção de recursos

Uma referência rápida para escolher e aplicar o método correto de seleção de recursos.

## Etapa 1: comece com a limpeza

Antes de aplicar qualquer método, remova recursos obviamente inúteis:

- **Recursos constantes**: variância = 0. Remova-os.
- **Recursos quase constantes**: variação < 0,01 (ou seu limite). Remova-os.
- **Recursos duplicados**: colunas idênticas. Fique com um, largue o resto.
- **Colunas de ID**: exclusivas por linha, não contêm informações generalizáveis. Remova-os.

Isso leva segundos e pode eliminar de 10 a 30% dos recursos em conjuntos de dados confusos do mundo real.

## Etapa 2: Escolha um método com base na sua situação

### Árvore de decisão rápida

1. **< 50 recursos?** Comece com uma classificação de informações mútuas. Mantenha o topo K.
2. **50 - 500 recursos?** Use primeiro o limite de variância, depois L1 (Lasso) se estiver usando um modelo linear, ou a importância da árvore se estiver usando árvores.
3. **> 500 recursos?** Métodos de cadeia: limite de variação -> filtro de informações mútuas (50% principais) -> RFE em sobreviventes.
4. **Precisa de interpretabilidade?** A regularização L1 fornece zero/diferente de zero exato. A importância da árvore fornece pontuações classificadas.
5. **Precisa capturar relacionamentos não lineares?** Informações mútuas ou importância baseada em árvore. Evite L1 (somente linear).
6. **Precisa de interações de recursos?** RFE ou importância baseada em árvore. Os métodos de filtro perdem interações.

### Referência do método

| Método | Quando usar | Quando evitar |
|--------|------------|---------------|
| Limite de variação | Sempre, como primeiro passo | Nunca pule isso |
| Informação mútua | Classificação rápida, relações não lineares | Quando você precisa de detecção de interação de recursos |
| RFE | Seleção completa, contagem moderada de recursos | Modelos muito caros, > 1000 recursos |
| L1 / Laço | Modelos lineares, seleção incorporada rápida | Problemas não lineares, características altamente correlacionadas |
| Importância da árvore | Relacionamentos não lineares, interações de recursos | Polarizado por recursos de alta cardinalidade |
| Importância da permutação | Validação independente do modelo, verificação final | Muito lento para triagem inicial |

## Passo 3: Valide sua seleção

- Compare o desempenho do modelo com recursos selecionados versus todos os recursos
- Use validação cruzada, não uma única divisão de treinamento/teste
- Se o desempenho cair mais de 1-2%, você pode ter removido recursos úteis
- Se o desempenho melhorar, você removeu o ruído com sucesso

## Etapa 4: lidar com armadilhas comuns

### Recursos correlacionados
- L1 escolhe arbitrariamente um de um grupo correlacionado e zera os outros
- Calcule primeiro a matriz de correlação e decida quais recursos correlacionados manter
- A importância da árvore distribui a importância entre recursos correlacionados

### Vazamento de dados
- Ajustar a seleção de recursos apenas nos dados de treinamento
- Aplique a mesma seleção aos dados de teste
- Na validação cruzada, a seleção de recursos deve acontecer dentro de cada dobra

### Overfitting para seleção de recursos
- RFE com muitas iterações pode se ajustar demais ao conjunto de treinamento
- Valide os dados retidos, não os dados usados para seleção
- Use seleção de estabilidade (repita em subamostras) para resultados mais robustos

## Etapa 5: Lista de verificação de produção

- [] Limite de variação aplicado como primeiro filtro
- [] Seleção de recursos ajustada apenas aos dados de treinamento
- [] Recursos selecionados documentados (nomes, método usado, pontuações)
- [] Desempenho comparado: recursos selecionados versus todos os recursos
- [] Avaliação cruzada, não de divisão única
- [] Seleção de recursos integrada ao pipeline de treinamento (não feita manualmente)
- [] Monitoramento em vigor para desvios de recursos (recursos selecionados podem ficar obsoletos)