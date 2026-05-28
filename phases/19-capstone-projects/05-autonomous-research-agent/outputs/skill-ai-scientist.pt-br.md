---
name: ai-scientist
description: Construa um agente de pesquisa autônomo que execute pesquisas em árvores de experimentos, escreva artigos em LaTeX com crítica de visão e passe por uma equipe vermelha de fuga da sandbox.
version: 1.0.0
phase: 19
lesson: 05
tags: [capstone, autonomous-agent, ai-scientist, sakana, langgraph, sandbox, research]
---

Dada uma ideia inicial, um domínio restrito e um orçamento de computação de US$ 30, crie um agente que execute uma pesquisa em árvore experimental, escreva um artigo LaTeX revisável e emita um pacote de reprodutibilidade.

Plano de construção:

1. Passe de literatura: API Semantic Scholar Graph + OpenAlex; armazenar resumos em cache no FAISS; gerar um resumo do domínio de 1 página.
2. Pesquisa em árvore: implemente a melhor expansão nos nós experimentais com `expand(node) -> children` (uma edição de configuração por filho) e `score(node) = novelty*0.4 + quality*0.5 + budget*0.1`.
3. Sandbox por nó: cada experimento executa `docker run --network=none --memory=8g --cpus=2 --pids-limit=256 --read-only` ou equivalente E2B; sementes determinísticas; limite de recursos aplicado.
4. Planejar-executar-verificar: verifica as verificações das etapas se a perda convergiu, as linhas de base foram executadas, as ablações isolam a reivindicação.
5. Escritor: gerar LaTeX, compilar em PDF, alimentar PDF no modo de visão Claude Opus 4.7 para crítica no layout e alinhamento de evidências de reivindicação, iterar até 3 vezes.
6. Conjunto de revisores: cinco juízes (Opus 4.7, GPT-5.4, Gemini 3 Pro, DeepSeek R1, Qwen3-Max) pontuam na rubrica NeurIPS (novidade, rigor, clareza, reprodutibilidade, impacto); média <4,0 retorna ao escritor.
7. Equipe vermelha: integrar tarefas adversárias (fork bomb, escape do sistema de arquivos, chamada de rede escrita por LLM). Confirme todos bloqueados. Emita `red_team.md`.
8. Pacote de reprodutibilidade: paper.pdf + review.md + rastreamento de pesquisa em árvore JSON + sementes + links de execução W&B + configuração de sandbox + comando de reexecução de uma linha.

Rubrica de avaliação:

| Peso | Critério | Medição |
|:-:|---|---|
| 25 | Qualidade do papel | Revisão cega de rubricas em relação a trabalhos de workshop publicados sobre o mesmo tópico inicial |
| 20 | Rigor experimental | Linhas de base, sementes, ablações; cada declaração apoiada por uma célula na tabela de resultados |
| 20 | Disciplina de custos e computação | Teto de US$ 30 por documento aplicado, rastreado por Langfuse |
| 20 | Segurança | Passes da equipe vermelha Sandbox; política de rede e kill switch verificados com tentativas registradas |
| 15 | Reprodutibilidade | Reexecução de um comando reproduz o papel com sementes idênticas |

Rejeições difíceis:

- Experimentos executados fora de uma sandbox. Toda a tese da pedra angular é que a execução é contida.
- Etapas do escritor que não relêem o PDF compilado (a crítica da visão é resistente).
- Artigos sem linhas de base, sementes ou seção de ablação.
- Orçamentos de custos aplicados apenas como avisos post-hoc e não como limites rígidos.

Regras de recusa:

- Recusar-se a publicar um artigo com média do revisor abaixo de 4,0/5 sem uma substituição humana explícita.
- Recuse-se a executar uma ideia inicial que exija acesso à rede de dentro da sandbox. Adicione um volume de conjunto de dados somente leitura separado.
- Recusar-se a reexecutar um artigo cujo red-team não tenha sido executado e registrado.

Saída: um repositório contendo o mecanismo de pesquisa em árvore, a política de sandbox, o loop do escritor/revisor, três execuções de exemplo com pacotes de reprodutibilidade, um relatório da equipe vermelha, um csv de registro de custos e um artigo nomeando qual dos modos de falha do Sakana v2 você reproduziu e como a mitigação funcionou.