---
name: skill-cot-patterns
description: Estrutura de decisão para escolher a técnica de raciocínio correta com base na complexidade da tarefa, requisitos de precisão e restrições de custo
version: 1.0.0
phase: 11
lesson: 02
tags: [chain-of-thought, few-shot, self-consistency, tree-of-thought, react, reasoning, prompting]
---

# Guia de seleção de técnica de raciocínio

Quando você precisar de um LLM para raciocinar sobre um problema, escolha a técnica antes de escrever o prompt. A técnica determina a arquitetura do raciocínio. O prompt o preenche.

## Árvore de decisão rápida

1. A tarefa é uma simples pesquisa factual ou uma classificação em uma única etapa?
   - Sim: use **disparo zero**. CoT adiciona custo sem ganho de precisão.
   - Não: continue.

2. A tarefa requer raciocínio em várias etapas (matemática, lógica, planejamento)?
   - Sim: use **Cadeia de Pensamento**. Continue para a etapa 3.
   - Não: use **poucas fotos** se o formato for importante, e zero fotos se não for.

3. É aceitável um único erro de raciocínio?
   - Sim: use **CoT de poucas doses** (amostra única, temperatura 0,0).
   - Não: use **autoconsistência** (N=5, temperatura 0,7). Continue para a etapa 4.

4. O problema é um problema de busca/planejamento com muitos caminhos possíveis?
   - Sim: use **Árvore do Pensamento**.
   - Não: a autoconsistência é suficiente.

5. A tarefa requer informação ou computação externa?
   - Sim: use **ReAct** (raciocínio + chamadas de ferramentas).
   - Não: as técnicas de raciocínio puro são suficientes.

## Matriz Técnica

| Técnica | Elevador de precisão | Multiplicador de custos | Latência | Melhor para |
|-----------|--------------|-----------------|---------|----------|
| Tiro zero | Linha de base | 1x | ~1s | Tarefas simples, perguntas e respostas factuais |
| Poucos tiros | +5-15% | 1,2x | ~1s | Correspondência de formato, classificação |
| CoT de tiro zero | +10-20% | 1,3x | ~1,5s | Aumento de raciocínio rápido |
| CoT de poucos tiros | +15-25% | 1,5x | ~2s | Matemática, lógica, várias etapas |
| Autoconsistência (N=5) | +2-5% sobre CoT | 5x | ~5s | Raciocínio de alto risco |
| Autoconsistência (N=10) | +1-2% sobre N=5 | 10x | ~10s | Apenas decisões críticas |
| Árvore do Pensamento | Dependente da tarefa | 10-40x | ~30s+ | Pesquisa, planejamento, quebra-cabeças |
| Reagir | Dependente da tarefa | 3-10x | ~5-15s | Tarefas baseadas no conhecimento |
| Encadeamento de prompt | +5-10% em relação ao single | 2-5x | ~5-10s | Tarefas complexas com várias partes |

## Orientação específica do modelo

### GPT-4o/GPT-4.1
- Forte raciocínio de base. CoT de tiro zero geralmente é suficiente.
- CoT de poucas fotos com 3 exemplos atinge 95% no GSM8K.
- A autoconsistência proporciona ganhos marginais (95% a 97%) – só vale a pena para tarefas críticas.
- Suporta saídas estruturadas nativamente para extração de respostas.

### Soneto de Claude 3.5 / Soneto de Claude 3.7
- Excelente em seguir formatos de prompt estruturados (tags XML).
- CoT de poucas tentativas com exemplos delimitados por XML funciona melhor.
- O pensamento estendido (Claude 3.7) é um CoT nativo – não há necessidade de solicitá-lo.
- A autoconsistência é eficaz porque o raciocínio de Claude varia bem na temperatura 0,7.

### Lhama 3.1/3.3 70B
- Beneficia-se mais do CoT de poucos tiros (maior lacuna de precisão versus tiro zero).
- Autoconsistência com N=5 recomendada para tarefas de raciocínio.
- Necessita de instruções de formato mais explícitas do que os modelos comerciais.
- ToT é caro na inferência local – considere apenas para processamento em lote.

### Gêmeos 2.5 Pró
- Forte no raciocínio em várias etapas pronto para uso.
- O modo de pensamento fornece CoT integrado sem engenharia imediata.
- Exemplos de poucas fotos ajudam mais na consistência do formato do que na precisão.
- A grande janela de contexto (1M) torna práticas algumas cenas com muitos exemplos.

## Antipadrões

**CoT para tarefas simples**: perguntar "Quanto é 2+2? Vamos pensar passo a passo" desperdiça tokens. O modelo acerta a aritmética simples sem traços de raciocínio. CoT ajuda quando há mais de 3 etapas.

**Autoconsistência na temperatura 0,0**: todas as N amostras serão idênticas. Você deve usar temperatura > 0 (0,5-0,8 recomendado) para diversos caminhos de raciocínio.

**ToT para tudo**: ToT requer chamadas O(b^d) LLM onde b=fator de ramificação ed=profundidade. Uma árvore com b=3, d=3 precisa de até 39 chamadas. Reserve para problemas onde as técnicas mais baratas falham.

**Poucas tentativas com exemplos ruins**: exemplos com erros de raciocínio ensinam o modelo a cometer esses erros. Cada exemplo deve ser verificado. Um exemplo errado pode reduzir a precisão mais do que nenhum exemplo.

**Extrair respostas sem um formato consistente**: a autoconsistência requer a comparação de respostas entre amostras. Se o formato da resposta variar ("$ 18", "18 dólares", "dezoito"), a votação falhará. Sempre aplique: "A resposta é [número]."

## Otimização de custos

Para um sistema de produção que processa 10.000 consultas/dia com preços GPT-4o (saída $2.50/1M input, $10/1M):

| Técnica | Média de tokens/consulta | Custo Diário | Precisão |
|-----------|-----------------|------------|----------|
| Tiro zero | ~200 | ~$5 | 78% |
| CoT de poucos tiros | ~600 | ~$15 | 95% |
| Autoconsistência (N=5) | ~3.000 | ~$75 | 97% |
| ToT (b=3, d=2) | ~6.000 | ~$150 | Dependente da tarefa |

A estratégia com melhor custo-benefício para a maioria das aplicações: comece com CoT de poucas doses. Adicione autoconsistência apenas para consultas em que a confiança é baixa (o padrão de escalonamento da seção Build It).

## Integração com encadeamento de prompts

Técnicas de raciocínio compostas com encadeamento imediato:

**Etapa 1 da cadeia** (Extração): disparo zero, temperatura 0,0
**Etapa 2 da cadeia** (motivo): CoT de poucas doses, temperatura 0,0
**Etapa 3 da cadeia** (Verificar): autoconsistência com N=3, temperatura 0,7

Essa cadeia de três etapas custa cerca de 3x uma única chamada CoT, mas detecta erros de extração, erros de raciocínio e fornece uma pontuação de confiança da etapa de verificação.

## Quando ir além da solicitação

Se você está gastando mais tempo com solicitações de engenharia do que escrevendo código de aplicativo, considere:

1. **Ajuste**: se você tiver mais de 500 exemplos rotulados e a tarefa for restrita
2. **Compilação DSPy**: se você deseja otimização automatizada de prompts
3. **Estruturas de agente**: se a tarefa exigir o uso de ferramenta multivoltas (Fase 14)
4. **RAG**: se o modelo precisa de acesso ao conhecimento privado/atual (Lições 06-07)

As técnicas de estímulo são a base. Eles funcionam com qualquer modelo, qualquer provedor e não requerem dados de treinamento. Mas eles têm limites. Saber quando passar para o próximo nível é tão importante quanto dominar as próprias técnicas.