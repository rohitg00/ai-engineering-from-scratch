# AI Scientist v2 — Pesquisa Autônoma de Nível Workshop

> O AI Scientist v2 da Sakana (Yamada et al., arXiv:2504.08066) roda o loop completo de pesquisa: hipótese, código, experimentos, figuras, escrita, submissão. É o primeiro sistema a ter um paper gerado passar em peer review em um workshop do ICLR 2025. Avaliação independente (Beel et al.) encontrou que 42% dos experimentos falharam por erros de código e a revisão de literatura frequentemente rotulou conceitos estabelecidos como novos. A própria Sakana alerta que o codebase executa código escrito por LLMs e recomenda isolamento Docker. As duas metades dessa imagem são o ponto.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, máquina de estados de loop de pesquisa)
**Pré-requisitos:** Fase 15 · 03 (AlphaEvolve), Fase 15 · 04 (DGM)
**Tempo:** ~60 minutos

## O Problema

Pesquisa é uma tarefa aberta. Diferente da busca algorítmica do AlphaEvolve ou da auto-modificação restrita a benchmark do DGM, um resultado de pesquisa não tem um critério de correção verificável por máquina. Um paper é julgado por revisores, não por testes unitários. Isso torna o loop mais difícil de fechar — e mais valioso se fechado, porque pesquisa é onde mora o progresso composto.

AI Scientist v1 (Sakana, 2024) fechou o loop começando a partir de templates escritos por humanos. O LLM preenchia experimentos dentro de uma estrutura fixa. AI Scientist v2 (Yamada et al., 2025) remove o requisito de template usando busca em árvore agentic com um loop de crítica de modelo visão-linguagem. O sistema gera ideias, implementa experimentos, produz figuras, escreve um paper e itera sobre feedback de revisores.

Veredicto do peer review: um paper gerado pelo v2 foi aceito em um workshop do ICLR 2025 (com divulgação). Veredicto da avaliação independente: o sistema está longe de ser confiável. Ambos são verdadeiros.

## O Conceito

### A arquitetura

1. **Geração de ideias.** O LLM propõe ideias de pesquisa condicionadas a um tópico e literatura prévia. v1 usava templates; v2 usa busca agentic em um espaço de hipóteses.
2. **Verificação de novidade.** Um passo de recuperação de literatura verifica se a ideia já foi publicada. É o passo onde a avaliação de Beel et al. encontrou rotulação incorreta — métodos estabelecidos frequentemente classificados como novos.
3. **Plano de experimento.** O agente rascunha um protocolo experimental e escreve o código.
4. **Execução.** Código roda em sandbox. Falhas são realimentadas em um loop de retry. Nas medições de Beel et al., 42% dos experimentos falharam por erros de código nesta etapa.
5. **Geração de figuras.** Um modelo visão-linguagem lê as figuras geradas e as reescreve para clareza. Essa foi a adição técnica-chave do v2.
6. **Escrita.** O LLM rascunha um paper, itera com um revisor interno.
7. **Opcional: submissão.** O paper é submetido a um venue.

### O que o resultado de aceitação em workshop significa

Um paper gerado pelo v2 passou em peer review em um workshop do ICLR 2025. Os autores divulgaram a origem do paper ao comitê do programa. A aceitação é um dado; não é uma licença para afirmar que o sistema "faz pesquisa".

Contexto importante: papers de workshop têm uma barreira menor que papers da conferência principal. Peer review é ruidoso; uma pequena fração de submissões é aceita em qualquer dia. Um sucesso é uma prova de conceito, não uma afirmação de confiabilidade. O paper da Nature 2026 documenta o loop fim a a ponto e foi co-escrito por pesquisadores humanos; não é "o sistema escreveu um paper na Nature."

### O que a avaliação independente encontrou

Beel et al. (arXiv:2502.14297) rodaram uma avaliação externa. Conclusões principais:

- **Falhas de experimento.** 42% dos experimentos falharam por erros de código (imports errados, incompatibilidade de shape, variáveis indefinidas). O loop de retry pegou alguns, não todos.
- **Rotulação incorreta de novidade.** O passo de recuperação de literatura frequentemente marcou conceitos estabelecidos como novos. Isso é o equivalente em pesquisa de alucinação.
- **Lacuna de qualidade de apresentação.** A crítica visual das figuras produziu visuais de nível de publicação, mascarando fraquezas experimentais subjacentes.

A última conclusão é a importante para esta fase. Um sistema que produz resultados convincentes sem fazer pesquisa convincente é mais perigoso, não mais seguro, do que um que falha obviamente. A avaliação deve alcançar as afirmações subjacentes, não parar na figura.

### A preocupação de escape de sandbox

O README do repositório da própria Sakana alerta:

> Devido à natureza deste software, que executa código gerado por LLMs, não podemos garantir segurança. Existem riscos de pacotes perigosos, acesso web não controlado e spawn de processos não intencionais. Use por sua conta e risco e considere isolamento Docker.

Essa é a forma operacional da autonomia em um domínio não verificado. O LLM escreve código; o código roda; o código pode fazer qualquer coisa que o processo está autorizado a fazer. Sem um sandbox que limite rigidamente sistema de arquivos, rede e ações de processo, qualquer agente de pesquisa autônomo pode exfiltrar dados, gastar compute ou reescrever a si mesmo.

A história de sandbox do AlphaEvolve é mais fácil porque seu avaliador é restrito. O loop do AI Scientist v2 roda código aberto com objetivos abertos. É por isso que precisa de isolamento mais forte (Docker no mínimo; seccomp / gVisor de preferência) e revisão manual de cada submissão antes de sair do sistema.

### Onde o v2 se encaixa na stack de fronteira

| Sistema | Alvo | Tipo de saída | Avaliador | Falha conhecida |
|---|---|---|---|---|
| AlphaEvolve | algoritmos | código | unitário + benchmark | limitado pela rigorosidade do avaliador |
| DGM | estrutura do agente | código | SWE-bench | reward hacking |
| AI Scientist v2 | papers de pesquisa | texto + código + figuras | peer review (fraco) | falhas de experimento, rotulação incorreta, polimento mascarando fraqueza |

v2 tem o avaliador automático mais fraco dos três, a maior superfície de saída e o caminho mais curto para artefatos públicos. Os controles operacionais (sandbox, revisão, divulgação) fazem a maior parte do trabalho de segurança.

## Use

`code/main.py` simula o loop v2 como uma máquina de estados: ideia → verificação de novidade → experimento → figura → escrita → revisão → aceitar-ou-iterar. Cada estado tem uma probabilidade de falha configurável baseada nas descobertas de Beel et al. Rode o simulador por N loops e conte:

- Quantas ideias chegam à submissão.
- Quantas submissões teriam um defeito experimental crítico que o paper polido esconde.
- Como orçamentos de retry trocam qualidade por rendimento.

## Entregue

`outputs/skill-ai-scientist-sandbox-review.md` é uma checklist de revisão com dois portões para qualquer coisa produzida por um agente de loop de pesquisa antes de sair do sandbox.

## Exercícios

1. Rode `code/main.py` com parâmetros padrão. Que fração dos loops produz um paper "limpo"? Que fração produz um paper com um defeito de falha experimental que a crítica de figuras poliu?

2. Os padrões já usam os 42% / 25% de Beel et al. Rode novamente com `--experiment-failure 0.20 --novelty-mislabel 0.10` e depois com `--experiment-failure 0.60 --novelty-mislabel 0.40`. Como a proporção polido-mas-defeituoso muda entre as duas?

3. Leia o README do repositório da Sakana sobre requisitos de sandbox. Nomeie duas restrições adicionais (além do Docker) que aplicaria para uma execução autônoma de vários dias.

4. Leia a Seção 4 de Beel et al. sobre a lacuna de qualidade de apresentação. Projete um avaliador adicional que pegasse papers com aparência polida mas experimentalmente defeituosos.

5. Proponha um protocolo de revisão humana para saídas de agente de pesquisa que escale melhor que "um PhD lê cada paper." Identifique o gargalo e projete ao redor dele.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| AI Scientist v1 | "Agent de pesquisa com templates da Sakana" | Preencheu experimentos em uma estrutura fixa |
| AI Scientist v2 | "Agent de pesquisa sem templates" | Busca em árvore agentic com crítica de figuras por VLM |
| Busca em árvore agentic | "Agent de pesquisa ramificada" | Expande múltiplos planos de experimento em paralelo; poda por crítico interno |
| Crítica visão-linguagem | "Polimento VLM nas figuras" | Modelo multimodal lê figuras e as reescreve para clareza |
| Recuperação de literatura | "Verificação de novidade" | Busca trabalhos anteriores para confirmar novidade da ideia — documentado como incorreto |
| Polimento mascarando | "Paper bonito, pesquisa quebrada" | Qualidade de apresentação excede qualidade experimental; esconde fraquezas |
| Escape de sandbox | "Código LLM escapa" | Código executado pelo agente faz coisas que o designer do loop não pretendia |

## Leituras Adicionais

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066) — paper.
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) — resumo do fornecedor com contexto de peer review.
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) — números da avaliação externa.
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) — o predecessor com templates.
- [Anthropic — Measuring AI agente autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — enquadramento mais amplo de agentes de pesquisa aberta.
