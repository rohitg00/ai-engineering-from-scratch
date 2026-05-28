---
name: coding-scaffold-audit
description: Audite uma estrutura de agente de codificação proposta (recuperação, loop de verificação, sandbox, ajuste de benchmark) antes de adotá-la para alterações no código de produção.
version: 1.0.0
phase: 15
lesson: 9
tags: [coding-agent, scaffolding, swe-bench, codeact, openhands]
---

Dado um andaime de agente de codificação proposto (agente SWE, OpenHands, Aider, Cline, Devin, Claude Code ou uma construção interna), pontue-o em quatro eixos e sinalize onde os números de referência irão exagerar a qualidade da produção.

Produzir:

1. **Recuperação.** Descreva como o scaffold seleciona quais arquivos o agente lê antes de agir. Mapa de repositório, pesquisa incorporada, lista de arquivos explícita ou chamadas `grep` acionadas por agente. A qualidade da recuperação é o fator de confiabilidade silencioso dominante.
2. **Loop de verificação.** O andaime executa testes, lê o rastreamento de pilha e alimenta a falha no próximo turno? Se não houver loop de verificação, sinalizar como ausente - geralmente é um delta absoluto de mais de 10 pontos em tarefas do tipo SWE-bench.
3. **Sandbox e raio de explosão.** Onde as ações são executadas? Sistema de arquivos local, contêiner efêmero, VM gerenciada. Para scaffolds estilo CodeAct, confirme se o sandbox está protegido (sem saída, sem montagens de host, limite de tempo). Para estruturas de chamada de ferramenta JSON, confirme se os validadores da ferramenta rejeitam todos os efeitos colaterais não intencionais.
4. **Ajuste ao benchmark.** Que distribuição o número relatado (por exemplo, "80,9% no SWE-bench Verified") realmente cobre? Conte a fração do benchmark composta por tarefas de 1–2 linhas; compare a pontuação relatada com o SWE-bench Pro (mais de 10 tarefas de linha) para o mesmo modelo. Um andaime cujo número do título é impulsionado pela cauda fácil não é um sinal de produção.

Rejeições difíceis:
- Qualquer andaime sem loop verificador usado para tarefas acima da complexidade trivial.
- Scaffolds CodeAct sem isolamento de sandbox (sem Docker, sem contêiner sem raiz, sem VM) apontando para repositórios reais.
- Afirmações de referência que não divulgam a distribuição (fração de cauda fácil, pontuação pró-equivalente).
- Andaimes de chamada de ferramenta onde uma única ferramenta pode tocar caminhos arbitrários sem validador (por exemplo, uma ferramenta `shell_exec` bruta exposta ao modelo).

Regras de recusa:
- Se o usuário não conseguir produzir a taxa de aprovação do conjunto de testes do andaime em uma distribuição interna representativa, recuse e exija primeiro uma medição de amostra pequena. Os benchmarks públicos prevêem a ordem de classificação, não a qualidade absoluta.
- Se o andaime proposto for executado em um repositório de produção sem uma simulação de teste, recuse e exija o teste primeiro. Agentes de codificação reescrevem arquivos; agentes de codificação com recuperação incorreta reescrevem os arquivos errados.
- Se o usuário planeja usar apenas pontuações de benchmark (sem suas próprias avaliações) para tomar uma decisão de avançar/não avançar, recuse e exija dados de avaliação internos.

Formato de saída:

Retorne um memorando pontuado com:
- **Pontuação de recuperação** (0–5 com mecanismo descrito)
- **Pontuação do loop do verificador** (0–5 com formato de feedback)
- **Pontuação do sandbox** (0–5 com mecanismo de isolamento)
- **Pontuação de ajuste de referência** (0–5 com delta de distribuição interna)
- **Recomendação de implantação** (somente produção/preparação/pesquisa)
- **Resumo de risco em uma linha** (a primeira falha de produção mais provável)