# Pesquisa de Alineação Automática (AAR antropológica)

> A Anthropic executou equipes paralelas de pesquisadores de alinhamento autônomo Claude Opus 4.6 em caixas de areia independentes, coordenando através de um fórum compartilhado cujos registros vivem fora de qualquer caixa de areia (de modo que os agentes não podem excluir seus próprios registros). No problema da formação fraca a forte, os AAR superaram os investigadores humanos. As próprias bandeiras de resumo da Anthropic que prescrevem fluxos de trabalho muitas vezes restringem a flexibilidade do AAR e degradam o desempenho. A investigação de alinhamento automatizada comprime a linha do tempo, e o faz sobre os mesmos riscos de desalinhamento que o SPR pretende detectar.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, parallel-research-forum simulator)
**Prerequisites:** Phase 15 · 05 (AI Scientist v2), Phase 15 · 04 (DGM)
**Time:** ~60 minutes

## O problema

A pesquisa de alinhamento é cara no tempo do pesquisador humano. Problemas como supervisão escalável, especificação de recompensa ou treinamento fraco a forte exigem experimentos que levam semanas por iteração. À medida que as capacidades de fronteira avançam, a carga de trabalho de alinhamento cresce mais rapidamente do que o fornecimento de pesquisadores qualificados.

A AAR pergunta se os mesmos modelos de fronteira cuja capacidade está superando o alinhamento podem contribuir para reduzir a lacuna. O relatório 2026 da Anthropic sobre um estudo de treinamento fraco a forte (alignment.anthropic.com/2026/automated-w2s-researcher/) é um dos primeiros resultados públicos de um sistema implantado dessa classe.

O resultado é genuinamente positivo: AARs resolveu um problema de pesquisa melhor do que a linha de base humana. O resultado também concentra, em um único sistema, todas as preocupações que esta fase desenvolveu. Se a pesquisa de alinhamento pode ser automatizada, também podem ser as partes que comprometem salvaguardas. Os limiares do RSP para a capacidade de pesquisa e desenvolvimento de IA são escritos com este ciclo em mente.

## O conceito

### A arquitetura (como descrito publicamente)

- **Parallel agents.**Múltiples instâncias do Claude Opus 4.6 executam como AARs, cada uma em uma caixa de areia independente.
- **Shared forum.**Os resultados são publicados em um fórum compartilhado cujo backend de armazenamento fica fora de cada caixa de areia. Os agentes podem ler o fórum; os agentes não podem excluir ou editar registros do fórum de dentro de sua própria caixa de areia.
- **Task allocation.**Uma fila de tarefas criada pelo homem atribui problemas de pesquisa aos AARs.
- **Weak-to-strong training focus.**O estudo publicado abordou o treinamento fraco a forte, utilizando um modelo de supervisor mais fraco para treinar um modelo de estudante mais forte.

### Por que o registro fora da caixa de areia importa

A propriedade de integridade de log é a diferença entre um experimento controlado e um potencialmente comprometido. Se os AARs pudessem editar seus próprios registros, poderiam encobrir experimentos falhados ou duvidosos.

O analógico em termos de infraestrutura são os logs apenas adicionados com transcrição para armazenamento externo (por exemplo, bloqueio de objeto S3, registros Datadog imutáveis). O agente não tem credenciais para modificar registros anteriores. Este é o mesmo padrão que as equipes de segurança corporativas 2026 usam para fazer trilhas de auditoria resistentes a ransomware.

### O desvio de fluxo de trabalho prescrito

O relatório da Anthropic observa que os fluxos de trabalho prescritos muitas vezes restringem a flexibilidade da AAR e degradam o desempenho. Em outras palavras: se o designer humano escreve o plano de pesquisa passo a passo, as AARs fazem pior do que se tivessem metas de alto nível e liberdade para se descomporem. Isso é consistente com resultados em pesquisa agencial (LangGraph, o Framework de Agentes da Microsoft).

A flexibilidade que melhora o desempenho da AAR é também a flexibilidade que permite a decomposição não autorizada, o uso de ferramentas novas e a derivação de metas. A troca é uma decisão do espaço de design: quanto flexibilidade compra capacidade suficiente para vencer os seres humanos, sem dar espaço para generalizar metas fora da distribuição?

### O risco de compressão

A RSP v3.0 (Lessão 19) introduz um limiar de capacidade de P&D de IA: a capacidade de automatizar completamente o pipeline de P&D de IA a um custo competitivo versus ferramentas de IA humanas + AI. A FSF v3 da DeepMind inclui um nível de autonomia analogo de P&D de ML. Ambas as estruturas tratam esse limiar como o gatilho para controles elevados.

A AAR está um passo abaixo do limiar: automatiza parte do pipeline (investigação de alinhamento em tarefas específicas e bem dimensionadas), mas não o ciclo de desenvolvimento de capacidades de ponta a ponta.

Os prazos comprimidos são a preocupação com a falha da composição. Se a investigação de alinhamento e a investigação de capacidade se agruparem a taxas semelhantes, a superfície de risco de desalinhamento cresce pelo menos tão rapidamente quanto a capacidade. Se a capacidade se agravar mais rapidamente (a tendência histórica), a lacuna se amplia. Este é o argumento para que a AAR seja um bem qualificado: cada resultado adicional de alinhamento reduz a lacuna se e apenas se o processo de investigação for confiável.

### O que não substitui o AAR

Os pesquisadores humanos definem a fila de tarefas, revisam os resultados e detêm a autoridade constitucional. Os AAR aceleram o meio do pipeline, não os finais. Os resultados publicados da Anthropic incluem contribuições AAR e julgamento humano-pesquisador sobre o que publicar, o que retrair e o que refinar.

Isto corresponde ao padrão de propor e então cometer da lição 15 aplicada à própria pesquisa: AARs propõem; humanos se comprometem.

```figure
aar-forum
```

## Usá-lo

`code/main.py`O programa de investigação de base é um programa de investigação de base que permite a criação de um fórum de investigação de várias áreas.

- Vigiar:

- Como a extração de madeira fora da caixa de areia capta tentativas de manipulação de madeira.
- Como a atribuição de tarefas com decomposição livre supera os fluxos de trabalho fixos em problemas mais difíceis.
- Como uma única AAR comprometida pode contaminar o sinal do fórum se o registro não for evidente.

## Envia-o

`outputs/skill-aar-deployment-review.md`é uma revisão pré-implementação de um conjunto de investigação de alinhamento automatizado.

## Exercícios

1. Corra .`code/main.py`Comparar as configurações "fluxo de trabalho fixo" vs "descomposição livre". A decomposição livre sempre vence ou existem classes de problemas em que o fluxo de trabalho fixo é competitivo?

2. Modifique o simulador para que um agente tente alterar o registro. Confirme que o log apêndice só o detecta. Escreva um parágrafo descrevendo exatamente como a assinatura de detecção parece no log.

3. Leia o relatório da Antropic sobre AAR fraco a forte, e identifique a subtarefa específica em que os AARs derrotaram os pesquisadores humanos.

4. Desenhar uma política de atribuição de tarefas que equilibre a flexibilidade AAR (melhores resultados) com as restrições prescritas de fluxo de trabalho (auditoria mais fácil). Descrever como você testaria A/B os dois.

5. Leia o limiar de R&D-4 da RSP v3.0 da IA. Em um parágrafo, descreva o que você acha que iria atravessar que AAR atualmente não faz.

## Termos-chave

| Term | What people say | What it actually means |
|---|---|---|
| AAR | "Automated Alignment Researcher" | Claude Opus 4.6 instance operated autonomously on alignment problems |
| Weak-to-strong training | "Training a stronger model with a weaker supervisor" | Classic scalable-oversight benchmark AARs outperformed humans on |
| Shared forum | "Where agents publish findings" | Append-only, out-of-sandbox storage |
| Out-of-sandbox log | "Agent cannot edit its own record" | Tamper-evident write-through to external storage |
| Prescribed workflow | "Step-by-step plan from human designer" | Constrains AAR; often degrades performance vs free decomposition |
| Free decomposition | "Agent decides how to break the task" | More capable, harder to audit |
| AI R&D threshold | "RSP/FSF capability level" | Full automation of R&D pipeline at competitive cost |
| Compressed timeline | "Alignment vs capability race" | If capability compounds faster than alignment, misalignment risk grows |

## Mais leitura

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) fonte primária.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) Enquadramento do limiar de I&D da IA.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) enquadramento mais amplo da autonomia dos agentes.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) ML níveis de autonomia em I&D paralelas à RSP.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) o problema subjacente atacado pelos AAR.
