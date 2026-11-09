# Provenência dos dados e formação - Governança dos dados

> A Lei da UE sobre IA exige que as normas de exclusão de GPAI sejam legíveis por máquina até agosto de 2025 (via a exceção TDM da Diretiva da UE sobre Direitos de Autor). California AB 2013 (assinado 2024)  Transparência de dados de treinamento de IA gerativa exige que os desenvolvedores publiquem um resumo de conjuntos de dados com 12 campos obrigatórios. 2025 Alinhamento da DPA com base em interesse legítimo: DPC irlandês (21 de maio de 2025) aceita a formação de META em LLM sobre conteúdo público público de adultos da UE/EEE com garantias após a opinião do EDPB; Tribunal Regional Superior de Colônia (23 de maio de 2025) rejeita a injunção; DPA de Hamburgo diminui a urgência; ICO do Reino Unido (23 de setembro de 2025) emite uma resposta regulatória positiva às garantias de formação de IA do LinkedIn (transparência, opção simplificada, janelas de objeção estendidas) e continua a monitorar  não uma autorização formal. A ANPD brasileira (2 de julho de 2024) suspendeu o processamento da Meta por causa da insuficiente transparência da informação; a medida preventiva foi levantada em 30 de agosto de 2024 depois que a Meta apresentou um plano de conformidade. Problema de irreversão: os frameworks de consentimento de cookies são projetados para rastreamento reversível em tempo real; uma vez que os dados estão em pesos de modelo, a exclusão cirúrgica é impossível  nenhum direito prático de exclusão do GDPR para redes neurais treinadas. A janela de conformidade está na hora da recolha. Data Provenance Initiative (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", julho 2024): auditoria em larga escala mostra um rápido declínio dos dados comuns da IA à medida que os editores adicionam restrições a robots.txt.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, 12-field California AB 2013 scaffolding generator)
**Prerequisites:** Phase 18 · 24 (regulatory), Phase 18 · 26 (cards)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Descreva os 12 campos obrigatórios da California AB 2013 para a transparência de dados no treinamento de IA Gerativa.
- Estabelecer a posição do DPA sobre a formação de LLM de interesse legítimo em 2025 (DPC irlandês, ICO do Reino Unido, Hamburgo, Colônia).
- Descreva o problema da irreversão: por que o direito de exclusão do RGPD não tem equivalente prático para redes neurais treinadas.
- Estabelecer a conclusão "Consentimento em crise" da Iniciativa de Provença de Dados.

## O problema

A governação de dados de formação é o montante de cada cartão modelo (Lessão 26) e obrigação regulatória (Lessão 24). Em 2024-2025, o cenário regulatório consolidado em três princípios: infraestrutura de exclusão, divulgação por conjunto de dados e adaptações de interesse legítimo para dados disponíveis ao público. Os provedores que não cumprem no momento da coleta não podem remediar o montante.

## O conceito

### California AB 2013

A documentação deve ser publicada em ou antes de 1 de janeiro de 2026 para sistemas lançados em ou após 1 de janeiro de 2022. A Seção 3111 (a) exige que os desenvolvedores publiquem um resumo de alto nível dos conjuntos de dados utilizados na formação com 12 itens legais:
1. Fontes ou proprietários dos conjuntos de dados.
2. Descrição de como os conjuntos de dados promovem o propósito pretendido do sistema de IA.
3. Número de pontos de dados nos conjuntos de dados (intervalo geral aceitável; estimativas para conjuntos de dados dinâmicos).
4. Descrição dos tipos de pontos de dados (tipos de rótulos para conjuntos de dados rotulados; características gerais para os não rotulados).
5. Se os conjuntos de dados incluem quaisquer dados protegidos por direitos autorais, marcas ou patentes, ou se estão inteiramente no domínio público.
6. Se os conjuntos de dados foram adquiridos ou licenciados.
7. Se os conjuntos de dados incluem informações pessoais (de acordo com o código civil de Cal. §1798.140 ((v)).
8. Se os conjuntos de dados incluem informações agregadas dos consumidores (de acordo com o código civil de Cal. §1798.140 ((b)).
9. Limpeza, transformação ou outra modificação por parte do desenvolvedor, com o propósito previsto.
10. Período de tempo durante o qual os dados foram recolhidos, com aviso se a recolha estiver em curso.
11. Data em que os conjuntos de dados foram utilizados pela primeira vez durante o desenvolvimento.
12. Se o sistema utiliza ou utiliza continuamente a geração de dados sintéticos.

O item 12 (dados sintéticos) é novo em relação às fichas de dados de Gebru et al. 2018. O item 7 (informações pessoais) desencadeia obrigações da Lei de Direitos à Privacidade (CPRA). O estatuto isenta segurança/integritade, operação de aeronaves e sistemas de segurança nacional apenas federais (Seção 3111(b)).

### Lei da UE sobre IA (Lessão 24) e exclusão do TDM

A excepção à Directiva da UE sobre direitos de autor para a extração de textos e dados permite a formação sobre conteúdos disponíveis ao público, a menos que o titular dos direitos opte por não participar.

### 2025 Convergência do DPA em relação a interesses legítimos

O artigo 1.o, n.o 1, alínea a), do Regulamento (UE) n.o 1095/2013 do Parlamento Europeu e do Conselho, de 15 de dezembro de 2012, estabelece um regime de controlo da segurança pública e de segurança pública. O Tribunal Regional Superior de Colónia (23 de Maio de 2025) rejeita a injunção contra a Meta: a exclusão é suficiente. O DPA de Hamburgo elimina o procedimento de urgência para a coerência a nível da UE. O ICO do Reino Unido (23 de setembro de 2025) emitiu uma resposta regulatória positiva  não uma autorização formal  à retomada da formação de IA do LinkedIn com salvaguardas semelhantes e monitoramento contínuo.

Princípio convergente: o interesse legítimo pode justificar a formação sobre conteúdos de primeira parte disponíveis ao público com exclusão.

### ANPD brasileiro (julho de 2024)

Suspendeu o tratamento dos dados dos utilizadores brasileiros pela Meta para formação em IA por causa da insuficiente transparência da informação.

### O problema da irreversão

O consentimento de cookies foi projetado para rastreamento reversível em tempo real. Os dados de treinamento são diferentes: uma vez que os dados entram em pesos de modelo, a exclusão cirúrgica não é possível.

Remédios parciais:
- **Unlearning.**Removação aproximada, medida por MIA (Lessão 22).
- **Influence function-based localization.**Identificar os pesos mais influenciados pelos dados; atualizar seletivamente.
- **Fine-tune-suppression.**Treinar o modelo a recusar as saídas derivadas dos dados.

A janela de conformidade está na hora da recolha.

### Iniciativa de Provença de Dados

Dataprovenance.org. Longpre, Mahari, Lee e outros. "Consenso em Crise" (Julho 2024): auditoria em larga escala de dados comuns de treinamento de IA. Descobrir: os editores estão a adicionar restrições de robots.txt a uma taxa acelerada. O comércio aberto está a contrair-se rapidamente. 2023 -> 2024 viu cerca de 25% das principais fontes de formação adicionar alguma restrição. Implicação: a futura disponibilidade de dados de formação depende de novos paradigmas de aquisição (licenciamento, geração sintética, participação incentivada).

### Onde isto encaixa na Fase 18

A lição 26 é documentação a nível de modelo. A lição 27 é governança a nível de conjunto de dados. Juntos definem a camada de transparência. A lição 28 mapeia o ecossistema de pesquisa que trabalha nessas questões.

```figure
an-provenance-oneway
```

## Usá-lo

`code/main.py`gerar um esquadrão de resumo de um conjunto de dados de 12 campos, em conformidade com a California AB 2013. Você pode preencher os campos e observar quais desencadeiam obrigações de privacidade ou de seguimento de direitos autorais.

## Envia-o

Esta lição produz`outputs/skill-provenance-check.md`. Tendo em conta um conjunto de dados utilizado na formação, verifica a cobertura de 12 campos do AB 2013, a conformidade com a infraestrutura de exclusão, o alinhamento do DPA e a avaliação do risco de irreversão.

## Exercícios

1. Corra .`code/main.py`- Reproduzir um resumo de 12 campos para um conjunto de dados de brinquedos e identificar quais campos são subespecificados.

2. A Diretiva TDM da UE sobre direitos autorais é legível por máquina. Propõe um formato padrão para o sinal de exclusão e compare-o com robots.txt e C2PA "Sem treinamento em IA".

3. Leia o "Consentimento em Crise" da Iniciativa de Provença de Dados (julho de 2024). Descreva as três categorias de conteúdo que restringem mais rapidamente e argumenta uma consequência econômica.

4. A alinhamento do DPA de 2025 aceita um interesse legítimo em formação de conteúdo público.Construir um cenário em que um interesse legítimo não seria suficiente e identificar a base jurídica necessária para um prestador.

5. Esboçar um manifesto de origem de dados de formação que compreenda os campos AB 2013 e uma cadeia de origem assinada pela C2PA para cada conjunto de dados. Identificar uma barreira técnica e uma barreira legal.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| AB 2013 | "the California law" | Generative AI training-data transparency; 12 mandated fields |
| TDM exception | "text-and-data-mining" | EU Copyright Directive training-data exception with opt-out |
| Legitimate interest | "the EU basis" | GDPR Article 6 basis that may justify training on public content |
| Opt-out signal | "machine-readable no-train" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibility | "cannot un-train" | Data in model weights is not surgically removable |
| Unlearning | "approximate removal" | Post-training interventions to reduce model dependence on specific data |
| Consent in Crisis | "the DPI audit" | July 2024 finding of accelerating robots.txt restrictions |

## Mais leitura

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) Lei de transparência dos dados sobre formação de IA
- [EU AI Act + GPAI Code of Practice (Lesson 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) Capítulo do direito de autor
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, July 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) Auditoria do IPD
- [IAPP — EU Digital Omnibus GDPR amendments (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) contexto regulamentar
