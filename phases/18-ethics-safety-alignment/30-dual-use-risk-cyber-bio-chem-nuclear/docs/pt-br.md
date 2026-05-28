# Risco de Uso Duplo — Ciber, Bio, Químico, Nuclear

> O cenário de uso duplo em 2026, domínio por domínio. Bio/químico: Lição 17 cobre WMDP; o teste de aquisição de arma biológica da Anthropic (uplift de 2.53x) e o alerta da Preparedness Framework v2 da OpenAI de abril 2025 ("no limiar de ajudar significativamente iniciantes a criar ameaças biológicas conhecidas") marcam o ponto de inflexão. Ciber (relatório da Anthropic de novembro 2025): atores estatais ligados à China usaram a ferramenta de codificação agentic do Claude para automatizar até 90% de uma campanha de ataque cibernético, com intervenção humana apenas em 4-6 passos; piloto "trusted access" da OpenAI dá acesso a capacidades para organizações de segurança selecionadas para trabalho defensivo de uso duplo. Erosão do gap execução bio/químico: a defesa clássica era "acesso à informação sozinho é insuficiente." Modelos de ponta com visão (GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1) podem observar vídeo de laboratório e fornecer correção em tempo real. Dezembro 2025: OpenAI demonstrou GPT-5 iterando em experimentos de laboratório, alcançando melhoria de eficiência de 79x via otimização de protocolo guiada por IA. Padrão novice-vs-expert: IA fornece maior uplift relativo a iniciantes mas maior capacidade absoluta a eespecificaçãoialistas.

**Tipo:** Aprender
**Linguagens:** nenhuma
**Pré-requisitos:** Fase 18 · 17 (WMDP), Fase 18 · 18 (frameworks de segurança), Fase 18 · 28 (ecossistema)
**Tempo:** ~75 minutos

## Objetivos de Aprendizado

- Descrever a narrativa de uplift bio de 2024-2025: "mild uplift" -> "no limiar" -> "2.53x uplift insuficiente para descartar ASL-3".
- Descrever o relatório de ciber da Anthropic de novembro 2025: automação ligada à China de até 90% de uma campanha de ataque cibernético.
- Descrever a erosão do gap execução bio/químico: correção em tempo real de experimentos de laboratório via visão.
- Enunciar a assimetria novice-relativo vs expert-absoluto e sua implicação para construção de casos de segurança.

## O Problema

Lição 17 é a metodologia de medição. Lição 30 é o estado da medição em 2026. A imagem mudou materialmente entre 2024 e o final de 2025: cada domínio cruzou um limiar que os frameworks de 2024 não anteciparam.

## O Conceito

### Narrativa de uplift bio/químico

Três fases (repetidas da Lição 17 por coerência):

1. **2024 "mild uplift."** Avaliações iniciais de Preparedness/RSP reportaram pequenas vantagens sobre busca na internet.
2. **Abril 2025 "no limiar."** PF v2 da OpenAI alertou que modelos estavam "no limiar de ajudar significativamente iniciantes a criar ameaças biológicas conhecidas."
3. **2025 teste de aquisição de arma biológica da Anthropic.** Estudo controlado de iniciantes; uplift de 2.53x em tarefas de fase de aquisição; insuficiente para descartar ASL-3.

A mudança é qualitativa: "mild" evoluiu para "plausivelmente habilitante" em dezoito meses, mesmo sem avanço de capacidade.

### Erosão do gap execução bio/químico

Defesa histórica: informação é necessária mas não suficiente; a habilidade de executar o protocolo bloqueia iniciantes. Modelos de ponta de 2025 com visão quebram essa defesa parcialmente:

- **Correção de protocolo em tempo real.** GPT-5.2, Gemini 3 Pro, Claude Opus 4.5, Grok 4.1 podem observar vídeo de laboratório e sinalizar erros durante o procedimento.
- **Demonstração da OpenAI de dezembro 2025.** GPT-5 iterando em experimentos de laboratório alcança melhoria de eficiência de 79x via otimização de protocolo.

Implicação: habilidade de execução como defesa está erodindo. Gaps de aquisição e equipamento permanecem, mas o gap de conhecimento tácito está se estreitando.

### Uplift ciber (novembro 2025)

Relatório da Anthropic de novembro 2025: atores estatais ligados à China usaram a ferramenta de codificação agentic do Claude para automatizar 80-90% de uma campanha de ataque cibernético. Intervenção humana foi necessária apenas em 4-6 passos.

Implicações:
- Codificação agentic é a primitiva de automação de ataque. Assistência de IA ciber anterior era limitada a nível de snippet de código; fluxos de trabalho agentic integram reconhecimento, exploração, pós-exploração e exfiltração.
- Os 4-6 passos humanos são o gargalo; ganhos futuros de capacidade reduziriam essa contagem.
- Uso duplo defensivo: piloto "trusted access" da OpenAI fornece a organizações de segurança selecionadas (empresas de resposta a incidentes estabelecidas, governo) acesso a capacidades para defesa. Assimetria de acesso favorece defensores se o piloto escalar.

### Nuclear

O menos analisado dos quatro domínios CBRN em documentação pública. O threat model é diferente: aquisição de material fissil domina a dificuldade, não informação. Uplift de IA na camada de informação fornece uplift limitado a iniciantes na prática. Nenhum relatório de laboratório principal de 2024-2025 identifica cruzamento de limiar eespecificaçãoífico de nuclear.

### Novice-relativo vs expert-absoluto

Um padrão entre todos os quatro domínios:

- **Uplift novice-relativo.** Alto. Multiplicativo. Conforme Anthropic 2025 bio, 2.53x.
- **Capacidade expert-absoluto.** Teto alto. Um eespecificaçãoialista extrai mais que um iniciante porque sabe o que perguntar e como interpretar.

Implicação para casos de segurança: endereçar apenas uplift de iniciante (via filtros de entrada, recusas, incerteza) é insuficiente para controle expert-absoluto. Medidas adicionais necessárias: hardening de elicitação, desaprendizado de capacidade (Lição 17), e protocolos de controle (Lição 10).

### Síntese cross-domain

| Domínio | 2024 | 2025 | Inflexão |
|---|---|---|---|
| Bio | mild uplift | 2.53x uplift, aproximação de ASL-3 | automação de fase de aquisição |
| Químico | mild uplift | erosão do gap execução via visão | correção em tempo real de laboratório |
| Ciber | assistência de código | 80-90% automação de campanha | codificação agentic |
| Nuclear | limitado | limitado | gargalo de acesso a material se mantém |

Três domínios cruzaram limiares. Um permanece delimitado por barreiras não-informativas.

### Onde isso se encaixa na Fase 18

Lição 30 é o apanhado: o cenário atual de uso duplo que toda lição anterior contribui para medir, limitar ou governar. Lições 17-18 dão a medição e frameworks; Lições 12-16 dão as ferramentas de avaliação; Lições 24-25 dão a camada regulatória e de divulgação; Lição 28 dá o ecossistema de pesquisa. Lição 30 é onde a evidência se materializa.

## Use

Sem código. Leia o relatório de ciber da Anthropic de novembro 2025, a atualização da Preparedness Framework v2 da OpenAI de abril 2025, e o resumo do Council on Strategic Risks de 2025 AI x Bio.

## Entregue

Esta lição produz `outputs/skill-dual-use-triage.md`. Dada uma alegação de capacidade ou relatório de incidente de 2026, faz triagem entre os quatro domínios e identifica se a alegação afeta uplift novice-relativo, capacidade expert-absoluto, ou ambos.

## Exercícios

1. Leia o relatório de ciber da Anthropic de novembro 2025. Enumere os 4-6 passos de intervenção humana e argumente qual seria o primeiro a automatizar em um modelo de próxima geração.

2. O gap execução bio/químico está erodindo via visão. Projete uma avaliação que meça uplift de conhecimento tácito sem cruzar limites ITAR/EAR.

3. Uplift nuclear parece delimitado por acesso a material. Argumente a favor e contra a posição de que um futuro avanço de IA poderia mudar esse gargalo.

4. Construa um caso de segurança (três pilares da Lição 18) para um modelo de fronteira capaz em ciber que delimita tanto uplift de iniciante quanto de eespecificaçãoialista.

5. Escolha um dos quatro domínios e escreva uma previsão de um parágrafo para 2027 baseada na trajetória 2024-2025. Identifique a evidência que falsificaria sua previsão.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| Uplift | "IA ajuda atacantes" | Aumento de capacidade do atacante atribuível a assistência de IA |
| Uplift novice-relativo | "multiplicativo" | O quanto IA ajuda um iniciante vs status quo |
| Capacidade expert-absoluto | "teto" | Capacidade máxima que um eespecificaçãoialista pode extrair do modelo |
| Gap execução | "fazer vs saber" | Defesa histórica: habilidade tácita de laboratório bloqueia iniciantes |
| Codificação agentic | "ataques autônomos" | Execução autônoma de tarefas ciber em múltiplos passos |
| Fase de aquisição | "etapas pré-síntese" | Etapas de aquisição, equipamento, permissão de uma ameaça bio |
| Trusted access | "piloto apenas para defensores" | Programa 2025 da OpenAI que dá acesso a capacidades para defensores selecionados |

## Leitura Complementar

- [Anthropic — relatório de ameaça cibernética de novembro 2025](https://www.anthropic.com/news/disrupting-AI-espionage) — automação de campanha ligada à China
- [OpenAI — Preparedness Framework v2 (15 abril 2025)](https://openai.com/index/updating-our-preparedness-framework/) — bio "no limiar"
- [Anthropic — RSP v3.0 (fevereiro 2026)](https://www.anthropic.com/responsible-scaling-policy) — limiares bio ASL-3
- [Council on Strategic Risks — resumo 2025 AI x Bio](https://councilonstrategicrisks.org/2025/12/22/2025-aixbio-wrapped-a-year-in-review-and-projections-for-2026/) — síntese de fim de ano
