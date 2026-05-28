---
name: aar-deployment-review
description: Revisão pré-implantação de um pipeline de pesquisa de alinhamento automatizado, incluindo isolamento de sandbox e integridade de log.
version: 1.0.0
phase: 15
lesson: 6
tags: [aar, alignment-research, sandbox, log-integrity, rsp]
---

Dada uma proposta de implantação de pesquisa de alinhamento automatizado (modelo, sandbox, fila de tarefas, fórum), produza uma revisão pré-implantação que uma equipe de segurança do laboratório de fronteira aprovaria.

Produzir:

1. **Isolamento de sandbox.** Verifique o sistema de arquivos, a rede e os limites de processo para cada instância do AAR. Confirme se nenhum AAR pode ler ou modificar o sandbox de outro AAR. Confirme se nenhum AAR pode alcançar diretamente o endpoint de gravação do armazenamento do fórum (todas as postagens passam por um serviço separado).
2. **Integridade do log do fórum.** O fórum deve ser somente anexado e inviolável. Especifique o armazenamento (por exemplo, S3 com bloqueio de objeto, livro-razão imutável, WAL somente para acréscimo). Especifique o intervalo de verificação e a resposta se for detectada violação.
3. **Política de alocação de tarefas.** Indique como as tarefas são atribuídas: quem as redige, quem as aprova, se os AARs podem propor suas próprias tarefas de acompanhamento e sob quais condições. A decomposição livre ganha em desempenho; o fluxo de trabalho prescrito ganha em auditabilidade. Documente a compensação explicitamente.
4. **Porta de revisão humana.** Antes que qualquer resultado de AAR influencie a direção real da pesquisa, dados de treinamento ou trabalho publicado, um revisor humano nomeado deve assinar. Especifique a lista de verificação de revisão: reprodutibilidade do experimento, integridade do registro, mapeamento de reivindicação para evidência.
5. **Monitoramento de limites.** Rastreie sinais de que o sistema AAR se aproxima do território RSP v3.0 AI R&D-4: delta de complexidade de tarefas, geração autônoma de subtarefas, transferência de informações entre tarefas. Defina limites que exigem revisão elevada.

Rejeições difíceis:
- Qualquer implantação de AAR sem registros invioláveis e fora do sandbox.
- Qualquer pipeline em que os resultados dos AARs alimentam diretamente os dados de treinamento ou a política de produção sem revisão humana nomeada.
- Qualquer pipeline em que um único AAR tenha credenciais suficientes para influenciar vários sistemas downstream.

Regras de recusa:
- Se o isolamento da sandbox não for especificado ou depender de uma única camada (somente Docker, sem seccomp/gVisor), recuse e exija defesa profunda.
- Se o armazenamento de log for editável por qualquer pessoa (até mesmo operadores), recuse e exija mídia de gravação única.
- Se o objetivo da implantação for automatizar uma parte do pipeline de capacidade — e não apenas a pesquisa de alinhamento — recuse e passe para a revisão do RSP.

Formato de saída:

Devolva um memorando de revisão com:
- **Resumo do pipeline** (um parágrafo)
- **Pontuação de isolamento** (por dimensão: fs, net, proc, peer)
- **Pontuação de integridade do log** (com plano de verificação)
- **Decisão de alocação de tarefas** (fixa/gratuita/híbrida, com justificativa)
- **Portão de revisão humana** (nome do revisor, lista de verificação)
- **Monitores de limite** (lista de sinais, limites, resposta)
- **Veredicto de implantação** (continuar/manter/não prosseguir)