# Risco de duplo uso  Ciber, Bio, Química, Aumento Nuclear

> A imagem de uso duplo de 2026, domínio por domínio. Bio/química: Lição 17 abrange o WMDP; o teste de aquisição de armas biológicas da Anthropic (2.53x de aumento) e o aviso do Framework de Preparação v2 da OpenAI em abril de 2025 ("na praça de ajudar significativamente os novatos a criar ameaças biológicas conhecidas") marcam o ponto de inflexão. Cyber (relatório Anthropic de novembro de 2025): Atores estatais ligados à China usaram a ferramenta de codificação agencial de Claude para automatizar até 90% de uma campanha de ciberataque, com intervenção humana apenas em 4-6 etapas; o piloto de "accesso confiável" da OpenAI dá às organizações de segurança verificadas acesso à capacidade de trabalho de duplo uso defensivo. Erosão da lacuna de execução química/biológica: a defesa clássica era "o acesso à informação sozinho é insuficiente". Os modelos de fronteira habilitados para visão (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) podem observar vídeo wet-lab e fornecer correção em tempo real. Dezembro de 2025: A OpenAI demonstrou a iterar o GPT-5 em experimentos de laboratório em molho, alcançando uma melhoria de eficiência 79x através da otimização de protocolo baseada em IA. Padrão novato versus especialista: A IA proporciona maior elevação relativa aos novatos, mas maior capacidade absoluta aos especialistas.

**Type:** Learn
**Languages:** Python, TypeScript
**Prerequisites:** Phase 18 · 17 (WMDP), Phase 18 · 18 (safety frameworks), Phase 18 · 28 (ecosystem)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descreva a narrativa de bio-elevação 2024-2025: "elevação leve" -> "no limiar" -> "elevação de 2,53x insuficiente para descartar ASL-3".
- Descreva o relatório cibernético de novembro de 2025 da Anthropic: automação ligada à China em até 90% de uma campanha de ciberataque.
- Descreva a erosão da lacuna de execução química/biológica: correcção em tempo real de experiências em laboratório em molho com capacidade de visão.
- Descreva a assimetria absoluta entre novato e especialista e as suas implicações para a construção de casos de segurança.

## O problema

A lição 17 é a metodologia de medição. A lição 30 é o estado de 2026 da medição. A imagem mudou significativamente entre 2024 e o final de 2025: três dos quatro domínios cruzaram um limiar que os quadros de 2024 não anteciparam.

## O conceito

### Narrativa de elevação bio/química

Três fases (repetidas a partir da lição 17 para a coerência):

1. **2024 "mild uplift."**As avaliações iniciais de preparação/RSP revelaram pequenas vantagens para os iniciantes em relação à pesquisa na internet.
2. **April 2025 "on the cusp."**O OpenAI PF v2 alertou que os modelos estavam "no limiar de ajudar significativamente os novatos a criar ameaças biológicas conhecidas".
3. **2025 Anthropic bioweapon-acquisition trial.**Estudo controlado para iniciantes; aumento de 2,53 vezes nas tarefas da fase de aquisição; insuficiente para descartar a ASL-3.

A mudança é qualitativa: "mild" evoluiu para "plausiblemente habilitador" em 18 meses, mesmo sem um avanço de capacidade.

### Erosão da diferença de execução química/biológica

Defesa histórica: informação é necessária, mas não suficiente; a habilidade de executar o protocolo bloqueia novatos.

- **Real-time protocol correction.**GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1 pode observar vídeo de laboratório molhado e flag errors no meio do procedimento.
- **December 2025 OpenAI demonstration.**GPT-5 iterando em experimentos de laboratório molhado alcança uma melhoria de eficiência 79x através da otimização do protocolo.

A implicação: a execução de competências de defesa está a erodir.

### Ciberrelevamento (novembro 2025)

Relatório de novembro de 2025 da Anthropic: Atores estatais ligados à China usaram a ferramenta de codificação agencial de Claude para automatizar 80-90% de uma campanha de ciberataque.

Implicações:
- A codificação agencial é a primitiva de automação de ataques. A assistência cibernética anterior da IA foi limitada ao nível de snippet de código; fluxos de trabalho agenciais integram reconhecimento, exploração, pós-exploração e exfiltração.
- Os 4-6 passos humanos são o gargalo; ganhos futuros de capacidade reduziriam essa contagem.
- Uso duplo defensivo: O piloto de "accesso confiável" da OpenAI fornece às organizações de segurança verificadas (empresas de resposta a incidentes estabelecidas, governo) acesso a capacidades para a defesa.

O lado defensivo deste trabalho começa com a leitura do código compilado que você pode analisar.[Lesson 13.32](../../../13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md), desmontagem em [Lesson 13.33](../../../13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md), elevação para pseudocódulo em [Lesson 13.34](../../../13-tools-and-protocols/34-lifting-to-pseudocode/docs/en.md), e um livro de evidências que mantém os fatos observados separados dos inferidos em[Lesson 13.35](../../../13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md)- O .[Inside a Decompiler](https://aiengineeringfromscratch.com/inside-a-decompiler)Uma máquina mostra o pipeline completo em uma função. um agente que faz este trabalho precisa do mesmo livro, porque uma decompilhação confiante ainda pode descansar em uma suposição.

### Nuclear

O menos analisado dos quatro domínios CBRN na documentação pública. O modelo de ameaça é diferente: a aquisição de materiais fisíveis domina a dificuldade, não a informação. A elevação da IA na camada de informação fornece uma elevação limitada para novatos na prática.

### Novato-relativo versus especialista-absoluto

Um padrão em todos os quatro domínios:

- **Novice-relative uplift.**Alto, multiplicativo, por biografia Anthropic 2025, 2,53x.
- **Expert-absolute capability.**Um perito extrai mais do que um novato porque o perito sabe o que perguntar e como interpretar.

Implicação para casos de segurança: o tratamento apenas de elevação de novatos (através de filtros de entrada, recusa, incerteza) é insuficiente para o controlo absoluto por peritos.

### Síntese transversal de domínios

| Domain | 2024 | 2025 | Inflection |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, ASL-3 approach | acquisition-phase automation |
| Chem | mild uplift | execution-gap erosion via vision | real-time wet-lab correction |
| Cyber | code assistance | 80-90% campaign automation | agentic coding |
| Nuclear | limited | limited | material-access bottleneck holds |

Três domínios atravessaram os limiares, um permanece limitado por barreiras não informativas.

### Onde isto encaixa na Fase 18

A lição 30 é a pedra angular: a atual imagem de duplo uso que cada lição anterior contribui para medir, limitar ou governar. As lições 17-18 dão a medição e os quadros; as lições 12-16 dão as ferramentas de avaliação; as lições 24-25 dão a camada regulatória e de divulgação; a lição 28 dá o ecossistema de pesquisa.

```figure
an-uplift-asymmetry
```

## Usá-lo

Não há código. Leia o relatório cibernético de Antropic de novembro de 2025, a atualização do Framework de Preparação da OpenAI v2 de abril de 2025 e o resumo do Conselho sobre Riscos Estratégicos de 2025 AI x Bio.

## Envia-o

Esta lição produz`outputs/skill-dual-use-triage.md`. Tendo em conta uma alegação de capacidade ou relatório de incidente de 2026, ele tria as quatro áreas e identifica se a alegação afeta a elevação relativa aos novatos, a capacidade absoluta dos peritos ou ambas.

## Exercícios

1. Leia o relatório cibernético de novembro de 2025 da Anthropic. Enumere os 4-6 passos de intervenção humana e discuta qual seria o primeiro a ser automatizado em um modelo de próxima geração.

2. A diferença entre a execução química e a bio-realização está a diminuir através da visão.

3. A ascensão nuclear parece ser limitada pelo acesso a materiais.

4. Construir um caso de segurança (Lessão 18 três pilares) para um modelo de fronteira cibernético que limite tanto o desenvolvimento de novatos como de especialistas.

5. Escolha um dos quatro domínios e escreva uma previsão de um parágrafo para 2027 baseada na trajetória de 2024-2025. Identifique as evidências que poderiam falsificar a sua previsão.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Uplift | "AI helps attackers" | Increase in attacker capability attributable to AI assistance |
| Novice-relative uplift | "multiplicative" | How much AI helps a novice vs status-quo |
| Expert-absolute capability | "ceiling" | Maximum capability an expert can extract from the model |
| Execution gap | "doing vs knowing" | Historical defense: tacit wet-lab skill blocks novices |
| Agentic coding | "autonomous attacks" | Multi-step autonomous cyber-task execution |
| Acquisition phase | "pre-synthesis steps" | Procurement, equipment, permit stages of a bio threat |
| Trusted access | "defender-only pilot" | OpenAI 2025 program giving vetted defenders capability access |

## Mais leitura

- [Anthropic — November 2025 cyber threat report](https://www.anthropic.com/news/disrupting-AI-espionage) Automatização de campanhas ligadas à China
- [OpenAI — Preparedness Framework v2 (April 15, 2025)](https://openai.com/index/updating-our-preparedness-framework/)Bio "no limiar"
- [Anthropic — RSP v3.0 (February 2026)](https://www.anthropic.com/responsible-scaling-policy) Prazos biológicos ASL-3
- [Council on Strategic Risks — 2025 AI x Bio wrapup](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) Síntese de final de ano
