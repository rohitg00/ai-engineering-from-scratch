# Proveniência de Dados e Governança de Dados de Treino

> EU AI Act exige padrões de opt-out legíveis por máquina para GPAI até agosto 2025 (via exceção TDM da Diretiva de Direitos Autorais da UE). California AB 2013 (sancionado 2024) — Transparência de dados de treino de IA Generativa requer que desenvolvedores publiquem um resumo de datasets com 12 campos obrigatórios. Convergência de APDs 2025 sobre interesse legítimo: Irish DPC (21 maio 2025) aceita treino de LLM da Meta em conteúdo público primeiro-pário da UE/EEE de adultos com salvaguardas após parecer do EDPB; Tribunal Regional Superior de Colônia (23 maio 2025) rejeita injunção; Hamburg DPA abandona urgência; UK ICO (23 setembro 2025) emite resposta regulatória positiva às salvaguardas de treino de IA do LinkedIn (transparência, opt-out simplificado, janelas de objeção estendidas) e continua monitoramento — não é limpeza formal. ANPD brasileira (2 julho 2024) suspendeu o processamento da Meta por insuficiência de transparência informativa; a medida preventiva foi suspensa em 30 agosto 2024 depois que a Meta submeteu plano de conformidade. Problema de irreversibilidade: frameworks de consentimento de cookies são projetados para rastreamento em tempo real, reversível; uma vez que dados entram nos pesos do modelo, cirurgia de remoção é impossível — não existe direito de remoção do GDPR prático para redes neurais treinadas. Janela de conformidade é no momento da coleta. Data Provenance Initiative (dataprovenance.org, Longpre, Mahari, Lee et al., "Consent in Crisis", julho 2024): auditoria em larga escala mostra declínio rápido do commons de dados de IA à medida que editores adicionam restrições robots.txt.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, gerador de scaffolding de 12 campos para California AB 2013)
**Pré-requisitos:** Fase 18 · 24 (regulatório), Fase 18 · 26 (cards)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Descrever os 12 campos obrigatórios da California AB 2013 para transparência de dados de treino de IA Generativa.
- Enunciar a posição das APDs 2025 sobre treino de LLM por interesse legítimo (Irish DPC, UK ICO, Hamburg, Colônia).
- Descrever o problema de irreversibilidade: por que o direito de remoção do GDPR não tem equivalente prático para redes neurais treinadas.
- Enunciar o achado "Consent in Crisis" da Data Provenance Initiative.

## O Problema

Governança de dados de treino é o upstream de todo model card (Lição 26) e obrigação regulatória (Lição 24). Em 2024-2025, o cenário regulatório se consolidou em três princípios: infraestrutura de opt-out, divulgação por dataset, e accommodações de interesse legítimo para dados publicamente disponíveis. Provedores que não conformam no momento da coleta não podem remediar downstream.

## O Conceito

### California AB 2013

Sancionado 2024. Documentação deve ser publicada até 1 janeiro 2026 para sistemas lançados em ou após 1 janeiro 2022. Seção 3111(a) requer que desenvolvedores publiquem um resumo de alto nível dos datasets usados no treino com 12 itens estatutários:
1. Fontes ou proprietários dos datasets.
2. Descrição de como os datasets promovem o propósito pretendido do sistema de IA.
3. Número de pontos de dados nos datasets (faixas gerais aceitáveis; estimativas para datasets dinâmicos).
4. Descrição dos tipos de pontos de dados (tipos de rótulos para datasets rotulados; características gerais para não rotulados).
5. Se os datasets incluem dados protegidos por direitos autorais, marca registrada ou patente, ou são inteiramente domínio público.
6. Se os datasets foram comprados ou licenciados.
7. Se os datasets incluem informações pessoais (conforme Cal. Civ. Code §1798.140(v)).
8. Se os datasets incluem informações agregadas de consumidores (conforme Cal. Civ. Code §1798.140(b)).
9. Limpeza, processamento ou outra modificação pelo desenvolvedor, com propósito pretendido.
10. Período em que os dados foram coletados, com aviso se coleta está em andamento.
11. Datas em que os datasets foram usados pela primeira vez durante desenvolvimento.
12. Se o sistema usa ou usa continuamente geração de dados sintéticos.

Item 12 (dados sintéticos) é novo em relação aos datasheets de Gebru et al. 2018. Item 7 (informações pessoais) dispara obrigações da Privacy Rights Act (CPRA). A lei isenta sistemas de segurança/integridade, de operação de aeronaves, e sistemas de segurança nacional exclusivamente federais (Seção 3111(b)).

### EU AI Act (Lição 24) e opt-out TDM

Exceção de text-and-data-mining da Diretiva de Direitos Autorais da UE permite treino em conteúdo publicamente disponível a menos que o titular de direitos opte por sair. GPAI Code of Practice Capítulo de Direitos Autorais do EU AI Act requer que provedores GPAI respeitem sinais de opt-out legíveis por máquina (robots.txt, alegação C2PA "No AI Training", etc.).

### Convergência de APDs 2025 sobre interesse legítimo

Irish DPC (21 maio 2025): plano da Meta de treinar em conteúdo público primeiro-pário de usuários adultos da UE/EEE aceito com salvaguardas após parecer do EDPB. Tribunal Regional Superior de Colônia (23 maio 2025) rejeita injunção contra Meta: opt-out é suficiente. Hamburg DPA abandona procedimento de urgência para consistência em toda a UE. UK ICO (23 setembro 2025) emitiu resposta regulatória positiva — não é limpeza formal — ao reinício do treino de IA do LinkedIn com salvaguardas similares e monitoramento em andamento.

Princípio convergente: interesse legítimo pode justificar treino em conteúdo público primeiro-pário com opt-out. Consentimento não é necessário.

### ANPD brasileira (junho 2024)

Suspendeu o processamento de dados de usuários brasileiros da Meta para treino de IA por insuficiência de transparência informativa. Resultado diferente das APDs da UE — ANPD priorizou transparência sobre admissibilidade de interesse legítimo.

### O problema de irreversibilidade

Consentimento de cookies foi projetado para rastreamento em tempo real, reversível. Dados de treino são diferentes: uma vez que dados entram nos pesos do modelo, remoção cirúrgica não é possível. Retreinar do zero é a única remediação completa, e é proibitivamente cara.

Remediações parciais:
- **Desaprendizado.** Remoção aproximada; medida por MIA (Lição 22).
- **Localização baseada em função de influência.** Identificar pesos mais influenciados pelos dados; atualizar seletivamente.
- **Supressão por fine-tune.** Treinar o modelo para recusar saídas derivadas dos dados.

Nenhuma resolve completamente o problema. A janela de conformidade é no momento da coleta.

### Data Provenance Initiative

dataprovenance.org. Longpre, Mahari, Lee et al. "Consent in Crisis" (julho 2024): auditoria em larga escala de commons de dados de treino de IA. Achado: editores estão adicionando restrições robots.txt a uma taxa acelerada. O commons abertamente treinável está contraindo rapidamente. 2023 -> 2024 viu cerca de 25% das principais fontes de treino adicionarem alguma restrição. Implicação: disponibilidade futura de dados de treino depende de novos paradigmas de aquisição (licenciamento, geração sintética, participação incentivada).

### Onde isso se encaixa na Fase 18

Lição 26 é documentação em nível de modelo. Lição 27 é governança em nível de dataset. Juntos definem a camada de transparência. Lição 28 mapeia o ecossistema de pesquisa que trabalha nessas questões.

## Use

`code/main.py` gera um esqueleto de resumo de dataset de 12 campos compatível com California AB 2013 para um dataset fictício. Você pode preencher os campos e observar quais disparam obrigações subsequentes de privacidade ou direitos autorais.

## Entregue

Esta lição produz `outputs/skill-provenance-check.md`. Dado um dataset usado no treino, verifica cobertura dos 12 campos do AB 2013, conformidade de infraestrutura de opt-out, convergência de APD, e avaliação de risco de irreversibilidade.

## Exercícios

1. Execute `code/main.py`. Produza um resumo de 12 campos para um dataset fictício e identifique quais campos estão sub-eespecificaçãoificados.

2. A exceção TDM da Diretiva de Direitos Autorais da UE é legível por máquina. Proponha um formato padrão para o sinal de opt-out e compare-o com robots.txt e C2PA "No AI Training."

3. Leia "Consent in Crisis" da Data Provenance Initiative (julho 2024). Descreva as três categorias de conteúdo com restrição mais rápida e argumente uma consequência econômica.

4. A convergência de APDs 2025 aceita interesse legítimo para treino em conteúdo público. Construa um cenário em que interesse legítimo não seria suficiente e identifique a base legal que um provedor precisaria em vez disso.

5. Esboçe um manifesto de proveniência de dados de treino que se componha com os campos do AB 2013 e uma cadeia de proveniência assinada por C2PA para cada dataset. Identifique uma barreira técnica e uma jurídica.

## Termos-Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|------------------------|---------------------------|
| AB 2013 | "a lei da Califórnia" | Transparência de dados de treino de IA Generativa; 12 campos obrigatórios |
| Exceção TDM | "text-and-data-mining" | Exceção de dados de treino da Diretiva de Direitos Autorais da UE com opt-out |
| Interesse legítimo | "a base da UE" | Base do GDPR Artigo 6 que pode justificar treino em conteúdo público |
| Sinal de opt-out | "não-treinar legível por máquina" | robots.txt, C2PA "No AI Training," TDM.Reservation |
| Irreversibilidade | "não dá para des-treinar" | Dados nos pesos do modelo não são removíveis cirurgicamente |
| Desaprendizado | "remoção aproximada" | Intervenções pós-treino para reduzir dependência do modelo em dados eespecificaçãoíficos |
| Consent in Crisis | "a auditoria DPI" | Achado de julho 2024 de restrições robots.txt aceleradas |

## Leitura Complementar

- [California AB 2013](https://leginfo.legislature.ca.gov/faces/billNavClient.xhtml?bill_id=202320240AB2013) — Lei de transparência de dados de treino de IA Generativa
- [EU AI Act + GPAI Code of Practice (Lição 24)](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) — Capítulo de Direitos Autorais
- [Longpre, Mahari, Lee et al. — Consent in Crisis (dataprovenance.org, julho 2024)](https://www.dataprovenance.org/consent-in-crisis-paper) — Auditoria DPI
- [IAPP — Emendas do Digital Omnibus da UE ao GDPR (2025)](https://iapp.org/news/a/eu-digital-omnibus-amendments-to-gdpr-to-facilitate-ai-training-miss-the-mark) — contexto regulatório
