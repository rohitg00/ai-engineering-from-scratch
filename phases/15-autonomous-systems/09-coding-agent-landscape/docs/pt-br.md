# O Panorama de Agents de Codificação Autônomos (2026)

> SWE-bench Verified passou de 4% para 80.9% em menos de três anos. O mesmo Claude Sonnet 4.5 pontuou 43.2% no SWE-agent v1 e 59.8% no Cline autonomous — a estrutura ao redor do modelo agora importa tanto quanto o modelo em si. OpenHands (antigo OpenDevin) é a plataforma MIT mais ativa e seu loop CodeAct executa ações Python diretamente em um sandbox ao invés de chamadas JSON de ferramenta. Os números de destaque escondem uma questão metodológica: 161 das 500 tarefas do SWE-bench Verified requerem apenas uma mudança de 1-2 linhas, e SWE-bench Pro (tarefas de 10+ linhas) fica em 23-59% para os mesmos modelos de fronteira.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, comparação CodeAct vs chamadas JSON de ferramenta)
**Pré-requisitos:** Fase 14 · 07 (Uso de ferramentas), Fase 15 · 01 (Agents de longo prazo)
**Tempo:** ~45 minutos

## O Problema

"Qual agente de codificação é melhor" é a pergunta errada. A pergunta certa é: em uma distribuição de tarefas que combina com meu trabalho, com a estrutura que vou rodar em produção, qual confiabilidade fim a a ponto recebo?

Entre 2022 e 2026 o campo aprendeu que a estrutura — a camada de recuperação, o planejador, o sandbox, o loop de edição-verificação, o formato de feedback — é estrutural. Claude Sonnet 4.5 no SWE-agent v1 pontuou 43.2% no SWE-bench Verified; o mesmo modelo dentro da estrutura autônoma do Cline pontuou 59.8%. 16.6 pontos percentuais absolutos de diferença, mesmos pesos. O modelo base é um componente; o loop é o produto.

O problema complementar é que saturação de benchmark esconde regressões. SWE-bench Verified está perto de saturado, e a cauda de tarefas fáceis (161 de 500 tarefas requerendo ≤2 linhas) puxa scores altos para cima. Qualidade do mundo real é melhor medida em distribuições como SWE-bench Pro (mudanças de 10+ linhas), onde os mesmos líderes ainda ficam em 23-59%.

## O Conceito

### SWE-bench, um parágrafo

SWE-bench (Jimenez et al.) pega issues reais do GitHub com patches ground-truth e pede a um agente que produza um patch que faça o conjunto de testes passar. SWE-bench Verified (OpenAI, 2024) é um subconjunto de 500 tarefas curado por humanos, com as tarefas ambíguas e quebradas removidas. SWE-bench Pro é o sucessor mais difícil — tarefas que requerem 10+ linhas de mudança, onde agentes de fronteira atuais ficam em 23-59%.

### O que a curva 2022 → 2026 realmente mostra

- **2022**: modelos de pesquisa em ~4% no SWE-bench bruto.
- **2024**: GPT-4 + estrutura no estilo Devin em ~14%; SWE-agent em ~12%.
- **2025**: Claude 3.5/3.7 Sonnet dentro de Aider e SWE-agent chegam à faixa de 40-55%.
- **2026**: Claude Sonnet 4.5 e concorrentes de fronteira em 70-80%+ no SWE-bench Verified. Epoch AI rastreia isso em tempo real.

A inclinação veio de três fontes compostas: melhores modelos base, melhor estrutura (CodeAct, reflexão, loops verificadores) e melhores benchmarks (Verified removendo ruído).

### CodeAct vs chamadas JSON de ferramenta

OpenHands (All-Hands-AI, arXiv:2407.16741, antigo OpenDevin) fez uma aposta arquitetural eespecificaçãoífica: em vez do modelo emitir chamadas JSON de ferramenta que um host decodifica e executa, o modelo emite código Python e um kernel estilo Jupyter o roda em um sandbox. O agente pode iterar sobre arquivos, encadear ferramentas e capturar suas próprias exceções dentro de uma ação.

O tradeoff:

- **Chamadas JSON de ferramenta**: cada ação é um turno; fácil de auditar; composicionalidade limitada; seguro por padrão porque cada chamada passa por um validador explícito.
- **CodeAct**: uma ação pode ser um programa inteiro; composicional; requer sandbox endurecido (OpenHands usa isolamento Docker); modos de falha incluem qualquer coisa que o runtime do sandbox permita.

Ambas as arquiteturas estão em produção. CodeAct é dominante em plataformas abertas (OpenHands, smolagents). Chamadas JSON de ferramenta continuam dominantes em serviços gerenciados (Anthropic Managed Agents, OpenAI Assistants) onde o provedor controla o executor.

### Estruturas no panorama de 2026

| Estrutura | Licença | Modelo de execução | Propriedade notável |
|---|---|---|---|
| OpenHands (OpenDevin) | MIT | CodeAct em Docker | Plataforma aberta mais ativa; replay de event-stream |
| SWE-agent | MIT | Agent-Computer Interface (ACI) | Primeira estrutura de ponta a ponta no SWE-bench |
| Aider | Apache-2 | edição via diff em repo local | Estrutura mínima, forte estabilidade de regressão |
| Cline | Apache-2 | agente VS Code com política de ferramentas | Estrutura aberta com maior score no Sonnet 4.5 |
| Devin (Cognition) | Proprietário | VM gerenciada + planejador | Primeira categoria de produto "engenheiro de software AI" |
| Claude Code | Proprietário | Modos de permissão + rotinas | Aula 10 cobre o agente loop em detalhes |

### Por que estrutura domina

Uma execução de codificação é uma trajetória de longo prazo (Aula 1). Confiabilidade se acumula ao longo dos passos. Três lugares onde a estrutura compra pontos:

1. **Recuperação**: encontrar os arquivos certos para ler é o gargalo silencioso. ACI do SWE-agent, índice de arquivos do OpenHands e repo-map do Aider atacam isso.
2. **Loop verificador**: rodar testes, ler stack traces e tentar novamente é um delta de 10+ pontos no SWE-bench.
3. **Contenção de falhas**: um sandbox que reverte em erro previne dano acumulado. O mesmo modelo com e sem loop verificador parece dois produtos diferentes.

### Saturação de benchmark e a distribuição real

Os autores do OpenHands e Epoch AI sinalizam ambos que SWE-bench Verified tem uma cauda fácil: 161 de 500 tarefas precisam apenas de 1-2 linhas de mudança. Scores altos são impulsionados parcialmente por essa cauda. SWE-bench Pro restringe a mudanças de 10+ linhas e retorna scores na faixa de 23-59% mesmo para sistemas de fronteira. Sua distribuição de produção é quase certamente mais próxima de Pro do que de Verified.

Implicação para escolher um agent: rode um subconjunto tipo Pro do seu backlog de bugs. O score que importa é o score em tarefas representativas do que você lança.

## Use

`code/main.py` compara duas estruturas de agente de brinquedo em uma distribuição fixa de mini-tarefas:

1. Uma estrutura de **chamada JSON de ferramenta** que pega uma ação por turno.
2. Uma estrutura **CodeAct** que pode emitir um snippet Python pequeno por ação.

Ambas usam um "modelo" stub (regras determinísticas), para que a comparação isole a estrutura da qualidade do modelo. A saída mostra que a estrutura CodeAct resolve mais tarefas em menos turnos ao custo de um raio de explosão maior por ação.

## Entregue

`outputs/skill-scaffold-audit.md` ajuda a auditar uma estrutura de agente de codificação proposta antes de adotar: qualidade de recuperação, presença de verificador, isolamento de sandbox e adequação benchmark-à-distribuição.

## Exercícios

1. Rode `code/main.py`. Quantos turnos cada estrutura leva no mesmo conjunto de tarefas? Qual o raio de explosão por ação de cada uma?

2. Leia o paper do OpenHands (arXiv:2407.16741). O paper argumenta que CodeAct supera chamadas JSON de ferramenta em tarefas complexas. Identifique um modo de falha que o paper reconhece e escreva uma frase sobre quando esse modo dominaria em produção.

3. Escolha uma tarefa do seu backlog de bugs que requereria 10+ linhas de mudança em dois arquivos. Estime a probabilidade de sucesso fim a a ponto para um modelo de fronteira sob (a) chamadas JSON de ferramenta e (b) CodeAct. Justifique a lacuna.

4. SWE-bench Verified tem 161 tarefas single-file de 1-2 linhas. Construa um score que as exclua. Como o ranking muda?

5. Leia "Introducing SWE-bench Verified" (OpenAI). Explique a metodologia eespecificaçãoífica usada para remover tarefas ambíguas e nomeie uma categoria que a curadoria perderia.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| SWE-bench | "Benchmark de codificação" | Issues reais do GitHub com patches ground-truth e conjuntos de testes |
| SWE-bench Verified | "Subconjunto limpo" | 500 tarefas curadas por humanos, com cauda fácil presente |
| SWE-bench Pro | "Subconjunto mais difícil" | Mudanças de 10+ linhas; fronteira em 23-59% |
| CodeAct | "Código como ação" | Agent emite Python; kernel estilo Jupyter executa em sandbox |
| Chamada JSON de ferramenta | "Function calling" | Cada ação é um payload JSON estruturado validado antes da execução |
| Estrutura | "Framework do agent" | Recuperação + planejador + executor + loop verificador ao redor do modelo base |
| ACI (Agent-Computer Interface) | "Formato do SWE-agent" | Conjunto de comandos projetado para ergonomia de LLMs, não shells humanos |
| Loop verificador | "Testar e tentar novamente" | Rodar testes, ler saída, revisar patch; maior ganho de confiabilidade não-modelo |

## Leituras Adicionais

- [Jimenez et al. — SWE-bench](https://www.swebench.com/) — o benchmark original e metodologia.
- [OpenAI — Introducing SWE-bench Verified](https://openai.com/index/introducing-swe-bench-verified/) — como o subconjunto curado foi construído.
- [Wang et al. — OpenHands: An Open Platform for AI Software Developers](https://arxiv.org/abs/2407.16741) — arquitetura CodeAct e design de event-stream.
- [Epoch AI — SWE-bench leaderboard](https://epoch.ai/benchmarks) — scores rastreados em tempo real.
- [Anthropic — Measuring agente autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — enquadramento de confiabilidade de agente de codificação de longo prazo.
