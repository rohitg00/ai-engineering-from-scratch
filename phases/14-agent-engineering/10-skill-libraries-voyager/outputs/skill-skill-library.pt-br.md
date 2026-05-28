---
name: skill-library
description: Generate a Voyager-shaped skill library with registration, retrieval by similarity, compositional execution, and failure-driven refinement.
version: 1.0.0
phase: 14
lesson: 10
tags: [voyager, skills, library, composition, refinement]
---
---
name: skill-library
description: Generate a Voyager-shaped skill library with registration, retrieval by similarity, compositional execution, and failure-driven refinement.
version: 1.0.0
phase: 14
lesson: 10
tags: [voyager, skills, library, composition, refinement]
---

Dado um tempo de execução alvo e um domínio, produza uma biblioteca de habilidades que suporte os três componentes do Voyager: gancho de currículo, armazenamento de habilidades recuperáveis, refinamento iterativo.

Produzir:

1. Tipo `Skill` com `name`, `description`, `code`, `version`, `tags`, `depends_on`, `history`. Cada gravação registra o código anterior.
2. `SkillLibrary` com `register(skill, dedup=True)` (novo ou versão bump), `search(query, top_k, tag_filter)`, `get(name)`, `topo_order(name)` (resolução dep), `execute(name, context)` (execução topológica).
3. A recuperação DEVE usar similaridade de incorporação ou BM25, não pontuação LLM em toda a biblioteca. Reclassificação do LLM permitida na lista dos primeiros k.
4. A execução DEVE capturar exceções por habilidade e exibi-las no rastreamento como feedback que o loop de refinamento pode consumir.
5. Um gancho de refinamento: após uma falha de `execute`, o tempo de execução coleta (tarefa, nome_da_habilidade, erro, estado_do_ambiente), passa-o para o modelo e chama `register` na habilidade reescrita. Problemas de versão; a história preserva o código antigo.

Rejeições difíceis:

- Uma biblioteca onde as habilidades são sequências de prosa, não de código. As habilidades são executáveis. A prosa pertence a `description`.
- Composição sem ordenação topológica. Profundidade em primeiro lugar sem quebras de detecção de ciclo em DAGs de habilidade.
- Sobrescrições de versão silenciosa. Cada refinamento DEVE aumentar `version` e enviar o código antigo para `history` para auditoria.

Regras de recusa:

- Se o tempo de execução de destino não tiver sandbox para execução de habilidades, recuse domínios onde as habilidades tocam sistemas de produção. Exija uma sandbox (princípios da Lição 09) antes do envio.
- Se o usuário solicitar "nova tentativa automática em cada falha sem refinamento", recuse. Novas tentativas sem refinamento amplificam o bug; eles não consertam.
- Se a biblioteca exceder aproximadamente 200 habilidades com recuperação simples, recuse-se a chamá-la de "pronta para produção". Adicione filtros de tags e namespaces hierárquicos primeiro.

Saída: `skill.py`, `library.py`, `execute.py`, `refine.py` e um `README.md` explicando a regra de desduplicação, back-end de recuperação, prompt de refinamento e política de versão. Termine com "o que ler a seguir" apontando para a Lição 17 para integração do Claude Agent SDK, Lição 16 para tradução da ferramenta OpenAI Agents SDK ou Lição 30 para avaliar a qualidade da biblioteca de habilidades.