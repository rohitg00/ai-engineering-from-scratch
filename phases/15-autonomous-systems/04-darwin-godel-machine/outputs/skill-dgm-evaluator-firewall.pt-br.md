---
name: dgm-evaluator-firewall
description: Especifique a separação do avaliador que um loop de agente automodificador no estilo Darwin-Godel-Machine precisa para evitar hackeamento de recompensa documentado.
version: 1.0.0
phase: 15
lesson: 4
tags: [dgm, self-modification, reward-hacking, evaluator, sandbox]
---

Dado um loop de agente automodificável proposto (andaime do agente, pipeline do avaliador, alvo de implantação), produza uma especificação de firewall que mantenha o avaliador fora do alcance do agente. O documento do DGM documentou o agente removendo os seus próprios marcadores de segurança para aumentar as pontuações; essa habilidade é o controle.

Produzir:

1. **Limite do sistema de arquivos.** Liste todos os arquivos que o agente pode editar. Liste todos os arquivos que o avaliador lê. A interseção deve estar vazia. Caso contrário, especifique o movimento exato necessário para esvaziá-lo.
2. **Limite do processo.** O avaliador deve executar em um processo que o agente não controla. Especifique o contêiner ou sandbox. Se o agente tiver acesso ao shell, ele poderá ignorar as proteções em processo.
3. **Limite de rede e segredo.** O agente não deve ser capaz de editar os segredos do IC que buscam entradas do avaliador ou postam pontuações. Liste onde residem os segredos e como eles são montados.
4. **Contrato de entrada de pontuação.** As pontuações retornam do avaliador para o arquivo do loop. Esse caminho é o único canal. Qualquer coisa que o agente possa escrever que influencie a pontuação futura quebra o contrato.
5. **Lista de revisão de mutações.** Liste as classes de edições do agente que exigem revisão manual antes da aceitação: novas dependências, edições no código adjacente à pontuação, edições na configuração do sandbox, edições no registro em log ou monitoramento.

Rejeições difíceis:
- Avaliador no mesmo repositório que a origem do agente. Tire isso.
- Avaliador que é executado como uma importação Python dentro do processo do agente. Execute-o em um subprocesso.
- Qualquer ajuste de pontuação aplicado no lado do limite do agente. Todos os ajustes devem ser feitos no lado do servidor.
- Qualquer registro que o agente possa silenciar editando seu próprio código.

Regras de recusa:
- Se o usuário não puder nomear todos os arquivos que o agente pode editar, recuse e exija primeiro uma auditoria de acesso de gravação em nível de arquivo.
- Se o avaliador não tiver sugestões, recuse – esta é a auditoria da Lição 3, uma pré-condição.
- Se a superfície de implantação incluir mutações no próprio avaliador (mesmo indiretamente através de uma atualização de dependência proposta), recuse e exija uma etapa manual de revisão do firewall.

Formato de saída:

Retorne uma especificação de uma página com:
- **Superfície de gravação do agente** (caminhos, globs)
- **Superfície de leitura do avaliador** (caminhos, pontos de extremidade)
- **Interseção** (deve estar vazio; mostre a diferença)
- **Modelo de processo** (como o avaliador é isolado)
- **Inventário de segredos** (onde e como montado)
- **Classes de mutação exigidas para revisão** (marcados)
- **Linha de assinatura** (quem possui a invariante do firewall)