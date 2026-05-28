---
name: skill-prompt-patterns
description: Estrutura de decisão para escolher o padrão de prompt correto com base no tipo de tarefa, requisitos de confiabilidade e modelo de destino
version: 1.0.0
phase: 11
lesson: 01
tags: [prompt-engineering, patterns, llm, temperature, cross-model, few-shot, chain-of-thought]
---

# Guia de seleção de padrões de prompt

Ao construir um recurso com tecnologia LLM, escolha seu padrão de prompt antes de escrevê-lo. O padrão determina a estrutura. O conteúdo o preenche.

## Matriz de decisão padrão

| Tipo de tarefa | Padrão Primário | Padrão Secundário | Temperatura | São necessárias poucas fotos? |
|-----------|----------------|-------------------|-------------|-----------------|
| Extração de dados | Preenchimento de modelo | Poucos tiros | 0,0 | Sim (2-3 exemplos) |
| Classificação | Poucos tiros | Guarda-corpo | 0,0 | Sim (3-5 exemplos) |
| Resumo | Personagem + Modelo | Adaptação do público | 0,3 | Não |
| Geração de código | Pessoa | Cadeia de Pensamento | 0,0 | Opcional |
| Escrita criativa | Pessoa | Crítica | 0,7-1,0 | Não |
| Raciocínio em várias etapas | Cadeia de Pensamento | Decomposição | 0,3 | Opcional |
| Resposta a perguntas | Persona + Guarda-corpo | Limite | 0,3 | Não |
| Geração de prompt | Meta-Prompt | Crítica | 0,7 | Sim (1-2 exemplos) |
| Moderação de conteúdo | Guarda-corpo + Limite | Poucos tiros | 0,0 | Sim (5+ exemplos) |
| Tradução/adaptação | Adaptação do público | Poucos tiros | 0,3 | Sim (2-3 exemplos) |

## Quando usar cada padrão

**Padrão Persona**: use para cada prompt como linha de base. A única questão é quão específico será o papel. Para tarefas genéricas, basta uma função ampla. Para tarefas específicas de domínio, a função deve nomear o domínio, o nível de antiguidade e o contexto.

**Padrão de poucas fotos**: use quando o formato de saída é mais importante do que o conteúdo. Se o modelo precisar produzir uma forma JSON específica, um formato CSV ou um rótulo de classificação, os exemplos serão mais eficazes do que as instruções. Regra prática: 2-3 exemplos para formatos simples, 5+ para formatos complexos ou ambíguos.

**Padrão de Cadeia de Pensamento**: use para matemática, lógica, análise de várias etapas e qualquer tarefa em que o modelo precise "mostrar seu trabalho". Melhora a precisão em 10-40% em tarefas de raciocínio (Wei et al., 2022). NÃO use para pesquisas ou extrações factuais simples - isso desperdiça tokens.

**Padrão de preenchimento de modelo**: use para extração estruturada onde cada saída deve ter o mesmo formato. Funciona melhor com temperatura = 0,0 e tratamento explícito "N/A" para campos ausentes.

**Padrão de crítica**: use quando a qualidade é mais importante do que a velocidade. O modelo gera, critica e melhora. Duplica aproximadamente o custo do token, mas melhora significativamente a precisão e a integridade. Melhor para resultados de alto risco (relatórios, recomendações, conteúdo voltado ao público).

**Padrão Guardrail**: use para qualquer sistema voltado para o usuário. Sempre inclua: limites do escopo, comportamento de recusa para solicitações fora do escopo e tratamento explícito do tipo "não sei". Combine com validação de entrada no lado do aplicativo.

**Padrão Meta-Prompt**: use para gerar prompts para novas tarefas. Em vez de escrever um prompt do zero, descreva a tarefa e deixe o modelo escrever o prompt. Em seguida, teste e repita. Economiza tempo no desenvolvimento inicial imediato.

**Padrão de decomposição**: use para problemas complexos que se beneficiam da divisão para conquistar. O modelo divide o problema em partes, resolve cada uma e combina. Mais eficaz para tarefas com 3 a 7 subproblemas.

**Padrão de Adaptação de Público**: use quando o mesmo conteúdo precisa atender públicos diferentes. Especifique o público explicitamente – não confie na suposição do modelo a partir do contexto.

**Padrão de limite**: uso para sistemas de produção que NUNCA devem responder a determinados tipos de perguntas. Mais forte que as proteções porque define um escopo rígido com uma mensagem de recusa exata. Essencial para domínios sensíveis à conformidade.

## Compatibilidade entre modelos

Padrões classificados de acordo com a consistência com que funcionam no GPT-4o, Claude 3.5 Sonnet, Gemini 1.5 Pro e Llama 3:

| Padrão | Consistência entre modelos | Notas |
|--------|------------------------|-------|
| Poucos tiros | Muito alto | Os exemplos são bem transferidos para todos os modelos |
| Preenchimento de modelo | Muito alto | Estrutura explícita deixa pouco espaço para divergências |
| Cadeia de Pensamento | Alto | Todos os principais modelos suportam "pensar passo a passo" |
| Pessoa | Alto | Funciona em qualquer lugar, mas diferentes modelos respondem a diferentes níveis de especificidade de função |
| Guarda-corpo | Moderado | Claude segue as grades de proteção com mais rigor; GPT-4o às vezes flutua em longas conversas |
| Crítica | Moderado | A qualidade da autocrítica varia significativamente por modelo |
| Meta-Prompt | Moderado | GPT-4o e Claude produzem diferentes estilos de prompt |
| Limite | Baixo-Moderado | O comportamento de recusa varia; teste por modelo |

## Erros Comuns

1. **Usando Cadeia de Pensamento para tudo**: CoT adiciona tokens e latência. Use-o apenas quando forem necessárias etapas de raciocínio.
2. **Muitas restrições**: mais de 5 a 7 restrições e o modelo começa a eliminar algumas. Priorize os 3 mais importantes.
3. **Persona contraditória + restrições**: “Você é um escritor criativo” + “Nunca use metáforas” confunde o modelo.
4. **Sem especificação de temperatura**: deixando a temperatura padrão (geralmente 1,0) quando você precisar de saída determinística.
5. **Avisos para copiar e colar entre modelos**: sempre teste. Um prompt ajustado para GPT-4o pode ter desempenho inferior em Claude e vice-versa.
6. **Ignorando mensagem do sistema**: colocar tudo na mensagem do usuário em vez de usar a mensagem do sistema para regras persistentes.
7. **Confiar excessivamente em restrições negativas**: "NÃO faça X, Y, Z, A, B, C" é menos eficaz do que "SOMENTE faça W." O enquadramento positivo dá ao modelo um alvo claro.

## Metas de confiabilidade

| Caso de uso | Combinação de padrões | Precisão Esperada | Custo do token |
|----------|-------------------|-------------------|------------|
| Extração de produção | Modelo + Algumas fotos | 95%+ | Baixo (500-1K) |
| Perguntas e respostas voltadas para o usuário | Persona + Guarda-corpo + Limite | 90%+ | Médio (1-2K) |
| Geração de código | Persona + Cadeia de Pensamento | 85%+ | Médio (1-3K) |
| Geração de conteúdo | Persona + Crítica | 90%+ qualidade | Alto (2-4K, passagem dupla) |
| Classificação | Poucos tiros + guarda-corpo | 95%+ | Baixo (300-800) |
| Análise complexa | Decomposição + Cadeia de Pensamento | 85%+ | Alto (3-5K) |