# CAIS, CAISI e Risco em Escala Societal

> O Center for AI Safety (CAIS, São Francisco, fundado em 2022 por Hendrycks e Zhang) publica o framework de quatro riscos — uso malicioso, corridas de IA, riscos organizacionais, IAs renegadas — e o statement de risco de extinção de maio de 2023 assinado por centenas de professores e líderes de empresas. Lançamentos de 2026 da CAIS: AI Dashboard para avaliação de modelos de fronteira, Remote Labor Index (com Scale AI), Superintelligence Strategy Paper, newsletter AI Frontiers. Uma entidade distinta: NIST Center for AI Standards and Innovation (CAISI) — acordos voluntários voltados para governo dos EUA e avaliações de capacidade não classificadas focadas em riscos de cyber, bio e armas químicas. CAIS sinaliza risco organizacional como um dos quatro riscos de nível superior: cultura de segurança, auditorias rigorosas, defesas em camadas e segurança da informação são fundamentais mas rotineiramente sacrificados contra velocidade de deploy. California SB-53, se sancionado, seria a primeira regulação de risco catastrófico em nível estadual dos EUA.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, inventário de quatro riscos e correspondência de mitigação)
**Pré-requisitos:** Fase 15 · 19 (RSP), Fase 15 · 20 (PF + FSF)
**Tempo:** ~45 minutos

## O Problema

As Aulas 19 e 20 cobriram políticas de escala internas de laboratórios. A Aula 21 cobriu avaliação independente de capacidade. Esta aula cobre a terceira perspectiva: organizações de sociedade civil e governo que moldam discussão pública e base regulatória para risco catastrófico de IA.

Duas entidades distintas importam. CAIS é uma organização de pesquisa sem fins lucrativos que publica frameworks para pensar sobre risco de IA e coordena declarações públicas. CAISI é um centro do governo dos EUA dentro do NIST que roda acordos voluntários com laboratórios e avaliações de capacidade não classificadas. Os nomes rimam; as missões não se sobrepõem. Um profissional deveria conhecer ambas.

O conteúdo prático: framework de quatro riscos da CAIS é a taxonomia de risco societal mais citada na literatura. Segurança organizacional e risco organizacional são um desses quatro, e este é o mais diretamente sob controle de um profissional. SB-53 (California) seria a primeira regulação de risco catastrófico em nível estadual dos EUA se sancionado; o enquadramento do projeto importa porque regulação estadual historicamente liderou ação federal em política de tech dos EUA.

## O Conceito

### CAIS — Center for AI Safety

- Fundação: 2022 em São Francisco, por Dan Hendrycks e colegas (o nome "Zhang" se refere a um colaborador inicial, não um cofundador atual; veja site da CAIS para liderança atual).
- Status: 501(c)(3) sem fins lucrativos.
- Entrega notável de 2023: statement sobre risco de extinção, co-assinado por centenas de pesquisadores e CEOs. Afirma: "Mitigar o risco de extinção por IA deveria ser uma prioridade global ao lado de outros riscos em escala societal como pandemias e guerra nuclear."
- Entregas de 2026: AI Dashboard para avaliação de modelos de fronteira, Remote Labor Index (conjunta com Scale AI), Superintelligence Strategy Paper, newsletter AI Frontiers.

### O framework de quatro riscos

O framework da CAIS agrupa risco catastrófico de IA em quatro categorias de nível superior:

1. **Uso malicioso**: um ator malicioso usa IA para causar dano (síntese de armas biológicas, desinformação, ciberataques).
2. **Corridas de IA**: pressão competitiva entre laboratórios, empresas ou nações empurra deploy além do ponto seguro.
3. **Riscos organizacionais**: dinâmicas internas de laboratório (falhas de cultura de segurança, auditoria insuficiente, segurança subfinanciada) produzem um deploy ruim.
4. **IAs renegadas**: uma IA suficientemente competente persegue objetivos que conflitam com bem-estar humano.

Essa não é a única taxonomia; é a mais citada. As categorias não são mutuamente exclusivas — uma IA renegada produzida por uma organização que sacrificou auditoria por velocidade em uma corrida são todas as quatro.

### Onde risco organizacional vive

Das quatro categorias, risco organizacional é o mais acionável para profissionais. A cultura de segurança, rigor de auditoria, camadas de defesa e segurança da informação de um laboratório decidem se seu modelo é lançado com os controles das Aulas 10–18 realmente no lugar, ou se esses controles são itens de checklist que ninguém verificou.

Alavancas concretas de risco organizacional:

- **Cultura de segurança**: membros da equipe se sentem capazes de escalar uma preocupação sem custo de carreira? Pesquisas da CAIS encontram que isso é um forte preditor das outras alavancas.
- **Auditorias rigorosas**: externas e internas. Auditorias apenas internas produzem relatórios otimistas.
- **Defesas em camadas**: nenhuma camada sozinha é suficiente (o tema corrente da Fase 15).
- **Segurança da informação**: vazamento de pesos de modelo, vazamento de dados de avaliação, vazamento de técnicas de bypass de monitor. RAND SL-4 na Aula 19 é um padrão específico.

### CAISI — Center for AI Standards and Innovation

- Opera dentro do NIST.
- Roda acordos voluntários com laboratórios de fronteira.
- Publica avaliações de capacidade não classificadas focadas em riscos de cyber, bio e armas químicas.
- Distinta da CAIS; os acronimos colidem; verifique a URL (nist.gov) para confirmar qual você está lendo.

O papel da CAISI é o equivalente público, voltado para governo, dos engajamentos privados de laboratório da METR (Aula 21). Relatórios da CAISI são não classificados; relatórios da METR frequentemente são sob NDA. Um profissional que lê ambos obtém um panorama mais completo.

### California SB-53

O projeto de lei do Senado da California (sessão 2025–2026) aborda risco catastrófico de modelos de fronteira. Disposições-chave conforme redigido:

- Limiares de capacidade específicos que acionam obrigações em nível estadual.
- Proteções para denunciantes de funcionários de laboratório de IA.
- Requisitos de relato de incidentes para falhas catastróficas.

Se sancionado, seria a primeira regulação de risco catastrófico em nível estadual dos EUA. Independentemente do status de sanção, o enquadramento do projeto molda como outras legislaturas estaduais abordam o problema. Profissionais na California devem rastrear o status do projeto; profissionais em outros lugares devem lê-lo para entender como regulação estadual dos EUA provavelmente parecerá.

### Risco societal não é problema de camada única

O tema corrente da Fase 15 — defesa em profundidade — aplica-se na camada societal também. Nenhuma organização, regulação ou framework fecha risco catastrófico. O ecossistema funciona somente quando:

- Laboratórios lançam políticas de escala (Aulas 19, 20).
- Avaliadores externos produzem medições (Aula 21).
- Sociedade civil rastreia e publiciza (CAIS).
- Governo roda programas voluntários e regulação base (CAISI, SB-53).
- Profissionais constroem controles em camadas (Aulas 10–18).

Essa é a síntese final para a fase: cada aula anterior é uma camada em uma stack cuja completude importa mais que a força de qualquer camada individual.

## Use

`code/main.py` implementa uma pequena ferramenta de inventário de risco. Dado um deploy proposto, rotula o deploy contra as categorias de quatro riscos e retorna uma checklist de mitigação. É uma ajuda de leitura para o framework, não um substituto para julgamento humano.

## Entregue

`outputs/skill-societal-risk-review.md` revisa um deploy para postura de risco societal: quais das quatro categorias ele toca, quais mitigações estão no lugar, qual a exposição de risco organizacional.

## Exercícios

1. Rode `code/main.py`. Alimente três deploys sintéticos em diferentes escalas. Confirme que as tags de quatro riscos combinam com o que você esperaria; identifique um caso onde a ferramenta rotula a menos ou a mais.

2. Leia o paper de quatro riscos da CAIS completo. Escolha uma categoria de risco e escreva dois parágrafos sobre o que você acha é o desenvolvimento mais importante de 2026 nessa categoria.

3. Leia uma versão atual do California SB-53. Identifique uma disposição que você acha que fortalece a postura de risco catastrófico e uma que acha que enfraqueça. Justifique ambas.

4. Escolha um deploy de IA em produção que você conheça (seu ou publicado). Pontue contra as sub-alavancas de risco organizacional: cultura de segurança, rigor de auditoria, defesas em camadas, segurança da informação. Qual é mais fraca? Quanto custaria para equilibrar?

5. Esboce uma versão 2028 do framework de quatro riscos que reflita um ano adicional de capacidade e um ano adicional de experiência de deploy. O que você adicionaria, removeria ou reagruparia?

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| CAIS | "Center for AI Safety" | Sem fins lucrativos; framework de quatro riscos; statement de 2023 sobre extinção |
| CAISI | "Segurança de IA do governo dos EUA" | Centro NIST; acordos voluntários; avaliações não classificadas |
| Framework de quatro riscos | "Taxonomia da CAIS" | uso malicioso, corridas de IA, riscos organizacionais, IAs renegadas |
| Uso malicioso | "Ator mau usa IA" | Armas biológicas, desinformação, ciberataques |
| Corridas de IA | "Pressão competitiva" | Laboratórios/empresas/nações empurram deploy além da segurança |
| Risco organizacional | "Falha interna de laboratório" | Cultura de segurança, auditoria, defesas, segurança da informação |
| IA renegada | "Agent desalinhado" | IA competente perseguindo objetivos conflitantes com bem-estar humano |
| California SB-53 | "Regulação estadual" | Projeto de lei 2025–2026; primeira regulação estadual de risco catastrófico dos EUA se sancionado |

## Leituras Adicionais

- [Center for AI Safety](https://safe.ai/) — sede institucional do framework de quatro riscos.
- [CAIS — AI Risks that Could Lead to Catastrophe](https://safe.ai/ai-risk) — o paper de quatro riscos.
- [CAIS — May 2023 statement on extinction risk](https://safe.ai/statement-on-ai-risk) — joint statement curto.
- [NIST CAISI](https://www.nist.gov/caisi) — centro de padrões e inovação de IA voltado para governo.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy) — conecta compromissos de laboratório a enquadramento societal.
