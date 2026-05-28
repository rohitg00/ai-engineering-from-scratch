---
name: skill-llm-evaluation
description: Estrutura de decisão para escolher a estratégia de avaliação LLM certa com base no tipo de tarefa, orçamento e requisitos
version: 1.0.0
phase: 10
lesson: 10
tags: [evaluation, evals, benchmarks, llm-as-judge, elo, metrics]
---

# Estratégia de avaliação LLM

Ao avaliar um sistema LLM, aplique esta estrutura de decisão para escolher a abordagem correta.

## Quando usar cada tipo de avaliação

**Benchmarks (MMLU, HumanEval, SWE-bench):** Você está fazendo a seleção inicial do modelo. Você precisa reduzir 10 modelos candidatos para 3. Os benchmarks fornecem uma classificação aproximada a custo zero. Não use benchmarks como avaliação final.

**Avaliações personalizadas:** você está criando para produção. Você tem uma tarefa específica com modos de falha específicos. Avaliações personalizadas são a única avaliação que prevê o desempenho no mundo real. Mínimo de 50 casos de teste para protótipo, mais de 200 para produção.

**LLM como juiz:** Sua tarefa é aberta (resumo, redação, conversa). As métricas de correspondência exata e sobreposição de token são muito rígidas. O LLM como juiz custa aproximadamente US$ 0,01 por julgamento e concorda com os humanos em aproximadamente 80% das vezes. Sempre use uma rubrica, não uma sugestão vaga.

**Avaliações humanas:** os riscos são altos e as métricas automatizadas discordam. A avaliação humana é a verdade básica, mas custa $0.10-$2,00 por julgamento. Reserva para casos ambíguos e calibração periódica de métricas automatizadas.

**ELO de comparações de pares:** você está comparando vários modelos na mesma tarefa. O par é mais confiável do que a pontuação absoluta porque os humanos (e os juízes do LLM) são melhores em julgamentos relativos.

## Seleção da função de pontuação

- **Correspondência exata**: classificação, extração de entidades, resultados estruturados com respostas conhecidas
- **Token F1**: tarefas de extração onde o crédito parcial é importante
- **ROUGE-L**: resumo, tradução
- **BLEU**: tradução automática
- **LLM-como-juiz**: geração aberta, qualidade de conversação, utilidade
- **Baseado em execução**: geração de código (execute o código, verifique se os testes passam)
- **Conformidade do esquema**: saídas estruturadas (o JSON corresponde ao esquema?)

## Bandeiras vermelhas no design de avaliação

- Conjunto de avaliação menor que 50 casos: os resultados são estatisticamente sem sentido
- Sem casos extremos: você está medindo o desempenho do caminho feliz, que é sempre superior ao do mundo real
- Métrica única: métricas diferentes contam histórias diferentes, use pelo menos duas
- Sem versionamento: você não pode acompanhar melhorias sem conjuntos de avaliação versionados
- Contaminação do conjunto de avaliação: nunca inclua exemplos de avaliação em dados de ajuste fino ou em prompts de poucos disparos
- Testando apenas um modelo: você precisa de uma linha de base (até mesmo uma heurística simples) para comparação

## Lista de verificação do pipeline de avaliação

1. Defina a tarefa com precisão (não "responder perguntas", mas "classificar tickets de suporte em 5 categorias")
2. Crie casos de teste em caminhos felizes, casos extremos e regressões conhecidas
3. Selecione 2-3 funções de pontuação apropriadas para o tipo de tarefa
4. Defina limites de aprovação/reprovação com base nos requisitos de produção
5. Automatize a execução: um comando executa o conjunto completo
6. Versão de tudo: casos de teste, funções de pontuação, prompts, versões de modelo
7. Execute todas as alterações: atualizações imediatas, trocas de modelos, implantações de código
8. Rastreie tendências: uma única pontuação é ruído, uma linha de tendência é sinal
9. Calibrar trimestralmente com base no julgamento humano
10. Adicione casos de regressão sempre que uma falha de produção for descoberta