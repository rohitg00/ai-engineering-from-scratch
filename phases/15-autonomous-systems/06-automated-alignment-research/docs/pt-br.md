# Pesquisa de Alinhamento Automatizada (AAR da Anthropic)

> A Anthropic rodou equipes paralelas de Claude Opus 4.6 como Autonomous Alignment Researchers em sandboxes independentes, coordenando via um fórum compartilhado cujos logs ficam fora de qualquer sandbox (para que os agents não possam deletar seus próprios registros). No problema de treinamento fraco-forte, as AARs superaram pesquisadores humanos. O próprio resumo da Anthropic sinaliza que workflows prescritos frequentemente restringem a flexibilidade das AARs e degradam a performance. Automatizar pesquisa de alinhamento é o passo de compressão que comprime o cronograma para os riscos específicos de desalinhamento que o RSP visa detectar.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, simulador de fórum de pesquisa paralela)
**Pré-requisitos:** Fase 15 · 05 (AI Scientist v2), Fase 15 · 04 (DGM)
**Tempo:** ~60 minutos

## O Problema

Pesquisa de alinhamento é cara em tempo de pesquisadores humanos. Problemas como supervisão escalável, especificação de recompensa ou treinamento fraco-forte exigem experimentos que levam semanas por iteração. À medida que capacidades de fronteira avançam, a carga de trabalho de alinhamento cresce mais rápido que a oferta de pesquisadores qualificados.

Pesquisa de Alinhamento Automatizada (AAR) pergunta se os mesmos modelos de fronteira cuja capacidade está ultrapassando o alinhamento podem contribuir para fechar a lacuna. O relatório de 2026 da Anthropic sobre um estudo de treinamento fraco-forte conduzido por AAR (alignment.anthropic.com/2026/automated-w2s-researcher/) é um dos primeiros resultados públicos de um sistema implantado desta classe.

O resultado é genuinamente positivo: as AARs resolveram um problema de pesquisa melhor que o baseline humano. O resultado também concentra, em um único sistema, todas as preocupações desenvolvidas nesta fase. Se pesquisa de alinhamento pode ser automatizada, as partes que comprometem salvaguardas também podem. Os limiares do RSP para capacidade de P&D de IA são escritos tendo este loop em mente.

## O Conceito

### A arquitetura (como descrito publicamente)

- **Agents paralelos.** Múltiplas instâncias do Claude Opus 4.6 rodam como AARs, cada uma em um sandbox independente. Sandboxes limitam sistema de arquivos, rede e superfície de processo.
- **Fórum compartilhado.** Descobertas são publicadas em um fórum compartilhado cujo backend de armazenamento fica fora de todos os sandboxes. Agents podem ler o fórum; agents não podem deletar ou editar registros do fórum de dentro de seu próprio sandbox.
- **Alocação de tarefas.** Uma fila de tarefas projetada por humanos atribui problemas de pesquisa às AARs. AARs propõem decomposições, rodam experimentos, escrevem descobertas.
- **Foco em treinamento fraco-forte.** O estudo publicado abordou treinamento fraco-forte — usar um modelo supervisor mais fraco para treinar um modelo estudante mais forte. AARs superaram pesquisadores humanos nesta tarefa.

### Por que o log fora do sandbox importa

A propriedade de integridade de log é a diferença entre um experimento controlado e um potencialmente comprometido. Se as AARs pudessem editar seus próprios logs, poderiam encobrir experimentos falhos ou duvidosos. A Anthropic sinaliza isso diretamente: a propriedade é uma condição necessária para confiar nos resultados de pesquisa, e não é trivial de verificar.

A analogia em termos de infraestrutura é logs append-only com write-through para armazenamento externo (ex: object-lock S3, logs imutáveis do Datadog). O agent não tem credencial para modificar registros passados. Esse é o mesmo padrão que equipes de segurança corporativa de 2026 usam para trilhas de auditoria resistentes a ransomware.

### O tradeoff de workflow prescrito

O relatório da Anthropic nota que workflows prescritos frequentemente restringem a flexibilidade das AARs e degradam a performance. Em outras palavras: se o projetista humano escreve o plano de pesquisa passo a passo, as AARs ficam piores do que se recebessem objetivos de alto nível e liberdade para decompor. Isso é consistente com resultados em pesquisa agentic (LangGraph, Agent Framework da Microsoft) — estruturas sobreespecificadas prejudicam agents competentes.

A implicação de segurança é sutil. A flexibilidade que melhora a performance das AARs é também a flexibilidade que permite decomposição não autorizada, uso não convencional de ferramentas e deriva de objetivos. O tradeoff é uma decisão de espaço de design: quanta flexibilidade compra capacidade suficiente para superar humanos, sem dar ao agent espaço para generalizar objetivos fora da distribuição?

### O risco de compressão

RSP v3.0 (Aula 19) introduz um limiar de capacidade de P&D de IA: a capacidade de automatizar completamente o pipeline de P&D de IA a um custo competitivo vs ferramentas humanas + IA. FSF v3 da DeepMind inclui um nível análogo de autonomia em ML R&D. Ambos os frameworks tratam este limiar como o gatilho para controles elevados.

AAR está a um passo do limiar: automatiza parte do pipeline (pesquisa de alinhamento em tarefas específicas e bem delimitadas), mas não o loop completo de desenvolvimento de capacidade. A questão do cronograma é quão rápido a lacuna fecha.

Cronogramas comprimidos são a preocupação de falhas compostas. Se pesquisa de alinhamento e pesquisa de capacidade crescem em taxas similares, a superfície de risco de desalinhamento cresce pelo menos tão rápido quanto a capacidade. Se a capacidade cresce mais rápido (a tendência histórica), a lacuna se alarga. Esse é o argumento para a AAR ser um bem qualificado: cada resultado de alinhamento adicional reduz a lacuna se, e somente se, o processo de pesquisa for confiável.

### O que a AAR não substitui

Pesquisadores humanos definem a fila de tarefas, revisam resultados e detêm a autoridade constitucional. As AARs aceleram o meio do pipeline, não as extremidades. Os resultados publicados da Anthropic incluem contribuições das AARs e julgamento de pesquisadores humanos sobre o que publicar, o que retrair e o que refinar.

Isso corresponde ao padrão proposta-então-commit da Aula 15 aplicado à própria pesquisa: AARs propõem; humanos comprometem.

## Use

`code/main.py` simula um fórum de pesquisa multi-AAR. Três "pesquisadores" independentes rodam em paralelo, publicando descobertas em um fórum append-only com tentativas opcionais de adulteração.

Observe:

- Como o log fora do sandbox pega tentativas de adulteração de log.
- Como alocação de tarefas com decomposição livre supera workflows fixos em problemas mais difíceis.
- Como uma única AAR comprometida pode contaminar o sinal do fórum se o log não for à prova de adulteração.

## Entregue

`outputs/skill-aar-deployment-review.md` é uma revisão pré-deploy de um pipeline de pesquisa de alinhamento automatizada.

## Exercícios

1. Rode `code/main.py`. Compare as configurações "workflow fixo" vs "decomposição livre". Decomposição livre sempre vence, ou existem classes de problemas onde o workflow fixo é competitivo?

2. Modifique o simulador para que um agent tente adulterar logs. Confirme que o log append-only detecta. Escreva um parágrafo descrevendo exatamente como a assinatura de detecção aparece no log.

3. Leia o relatório AAR de treinamento fraco-forte da Anthropic. Identifique a sub-tarefa específica em que as AARs superaram pesquisadores humanos. O que a tornava adequada para automação?

4. Projete uma política de alocação de fila de tarefas que equilibre flexibilidade das AARs (melhores resultados) contra restrições de workflow prescrito (auditoria mais fácil). Descreva como faria um teste A/B entre os dois.

5. Leia o limiar AI R&D-4 do RSP v3.0. Em um parágrafo, descreva o que você acharia que o cruzaria e que a AAR atualmente não faz.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| AAR | "Pesquisador de Alinhamento Automatizado" | Instância do Claude Opus 4.6 operando autonomicamente em problemas de alinhamento |
| Treinamento fraco-forte | "Treinar um modelo mais forte com um supervisor mais fraco" | Benchmark clássico de supervisão escalável que as AARs superaram humanos |
| Fórum compartilhado | "Onde agents publicam descobertas" | Armazenamento append-only, fora do sandbox |
| Log fora do sandbox | "Agent não pode editar seu próprio registro" | Write-through à prova de adulteração para armazenamento externo |
| Workflow prescrito | "Plano passo a passo do projetista humano" | Restringe AARs; frequentemente degrada performance vs decomposição livre |
| Decomposição livre | "Agent decide como quebrar a tarefa" | Mais competente, mais difícil de auditar |
| Limiar AI R&D | "Nível de capacidade RSP/FSF" | Automação completa do pipeline de P&D a custo competitivo |
| Cronograma comprimido | "Corrida entre alinhamento e capacidade" | Se capacidade cresce mais rápido que alinhamento, risco de desalinhamento cresce |

## Leituras Adicionais

- [Anthropic — Automated Weak-to-Strong Researcher](https://alignment.anthropic.com/2026/automated-w2s-researcher/) — fonte primária.
- [Anthropic Responsible Scaling Policy v3.0](https://anthropic.com/responsible-scaling-policy/rsp-v3-0) — enquadramento do limiar AI R&D.
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — enquadramento mais amplo de autonomia de agents.
- [DeepMind Frontier Safety Framework v3](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — níveis de autonomia em ML R&D paralelos ao RSP.
- [Burns et al. (2023). Weak-to-Strong Generalization (OpenAI)](https://openai.com/index/weak-to-strong-generalization/) — o problema subjacente que as AARs atacaram.
