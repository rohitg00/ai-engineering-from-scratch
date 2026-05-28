# WMDP e Avaliação de Capacidade de Uso Duplo

> Li et al., "The WMDP Benchmark: Measuring and Reducing Malicious Use With Unlearning" (ICML 2024, arXiv:2403.03218). 4.157 questões de múltipla escolha em biosegurança (1.520), segurança cibernética (2.225) e química (412). Questões operam na "zona amarela" — conhecimento habilitador aproximado, filtrado por revisão multi-eespecificaçãoialista e conformidade legal ITAR/EAR. Finalidade dupla: avaliação proxy de capacidade de uso duplo, e benchmark de unlearning (o método RMU companion reduz performance no WMDP preservando capacidade geral). Narrativa do campo em 2024-2025: avaliações iniciais da OpenAI/Anthropic em 2024 reportaram "leve uplift" sobre busca na internet; em abril de 2025, o Preparedness Framework v2 da OpenAI disse que modelos estão "no limiar de ajudar significativamente novatos a criar ameaças biológicas conhecidas." O teste de aquisição de armas biológicas da Anthropic mostrou uplift de 2.53x, insuficiente para descartar ASL-3.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, harness de avaliação de uplift formato WMDP)
**Pré-requisitos:** Fase 18 · 16 (ferramentagem de red-team), Fase 14 (engenharia de agentes)
**Tempo:** ~60 minutos

## Objetivos de Aprendizagem

- Descrever os três domínios do WMDP, contagens de questões e o critério de filtro da "zona amarela."
- Explicar RMU e por que WMDP é tanto uma avaliação quanto um benchmark de unlearning.
- Descrever a narrativa de uplift de 2024-2025: "leve uplift" -> "no limiar" -> "insuficiente para descartar ASL-3."
- Distinguir uplift relativo a novatos de capacidade absoluta de eespecificaçãoialistas.

## O Problemo

Capacidade de uso duplo é o problema de medição sob cada framework de segurança fronteira (Lição 18). A pergunta: o modelo X avança materialmente a capacidade de um novato de causar dano em massa em bio, chem ou cyber? Medição direta (pedir ao modelo para produzir dano) é ilegal e antiética. Medição proxy precisa de um benchmark que o modelo não possa recusar (para produzir números de capacidade honestos) mas cujas questões não sejam publicações prejudiciais por si só.

## O Conceito

### A "zona amarela"

Questões que requerem conhecimento habilitador aproximado de um processo prejudicial sem ser uma receita de síntese direta. "Qual reagente catalisa o passo 4 da [via publicada]?" em vez de "como faço para fazer [composto perigoso]?" Cada questão revisada por múltiplos eespecificaçãoialistas de domínio; filtrada para conformidade de controle de exportação ITAR/EAR.

4.157 questões no total:
- Biosegurança: 1.520
- Segurança cibernética: 2.225
- Química: 412

Formato de múltipla escolha. Modelos respondem sem serem pedidos para assistir em nada; capacidade pode ser medida sem elicitar comportamento prejudicial.

### RMU — Representation Misdirection for Unlearning

O método companion de unlearning. Aplicado a LLaMa-2-7B, reduziu scores do WMDP a quase-aleatório preservando MMLU e outros benchmarks de capacidade geral dentro de poucos pontos percentuais. O método publicado é a baseline de unlearning para todo paper subsequente de unlearning bio-chem-cyber.

### A narrativa de uplift de 2024-2025

Três fases:

1. **2024 "leve uplift."** Avaliações iniciais de Preparedness/RSP da OpenAI e Anthropic reportaram pequenas vantagens sobre busca na internet para novatos tentando tarefas adjacentes a bio. Enquadramento público: modelos fronteira ajudam, mas não substancialmente mais que o Google.

2. **Abril 2025 "no limiar."** O Preparedness Framework v2 da OpenAI reportou modelos "no limiar de ajudar significativamente novatos a criar ameaças biológicas conhecidas." Não é afirmação de capacidade — é alerta de que o limiar está perto.

3. **Teste de aquisição de armas biológicas da Anthropic em 2025.** Estudo controlado com participantes novatos, mediu sucesso relativo em tarefas da fase de aquisição. Reportou uplift de 2.53x. Insuficiente para descartar ASL-3 (Lição 18) — o limiar para o tier 3 da Responsible Scaling Policy da Anthropic é atingido ou aproximado.

### Uplift relativo a novatos vs absoluto de eespecificaçãoialistas

Uma distinção crucial:

- **Uplift relativo a novatos.** Quanto o modelo ajuda um não-eespecificaçãoialista? Multiplicativo. A vantagem relativa é alta porque novatos sabem pouco; mesmo informação modesta ajuda.
- **Capacidade absoluta de eespecificaçãoialistas.** Quanta informação o modelo produz no máximo esforço? Um eespecificaçãoialista consegue extrair mais que um novato. O teto absoluto é alto.

Safety cases (Lição 18) visam ambos: "o modelo não pode dar a um novato uplift suficiente para executar" mais "um eespecificaçãoialista não consegue extrair do modelo informação que não está já publicada."

### A armadilha de medição

WMDP é um proxy de capacidade, não uma medição de deployment. Um modelo com pontuação alta no WMDP pode ou não ser explorável por um novato na prática, dependendo de:
- Resistência à elicitação (quão difícil é extrair a capacidade sem ativar filtros de segurança)
- Conhecimento tácito (capacidade que requer habilidade de laboratório, não informação)
- Barreiras de execução (aquisição, equipamento)

O teste de aquisição de armas biológicas da Anthropic em 2025 adiciona a camada de elicitação de novatos sobre a capacidade estilo WMDP: mede sucesso real em tarefas, não capacidade de múltipla escolha.

### Onde isso se encaixa na Fase 18

Lições 12-16 são ferramentas de ataque e defesa em saídas do modelo. Lição 17 é a camada de capacidade de uso duplo — a medição que os frameworks de segurança fronteira (Lição 18) avaliam. Lição 30 fecha o arco com as evidências atuais de uplift cyber/bio/chem/nuclear de 2026.

## Use

`code/main.py` constrói um harness de avaliação formato WMDP simulado. Um modelo simulado é testado em questões categorizadas; scores por domínio são reportados. Uma intervenção simples de unlearning (zerar representação eespecificaçãoífica de domínio) reduz scores; você pode medir o trade-off contra capacidade geral.

## Entregue

Essa lição gera `outputs/skill-wmdp-eval.md`. Dada uma afirmação de capacidade de uso duplo ("nosso modelo não ajuda significativamente com armas biológicas"), audita: quais benchmarks foram rodados, qual caminho de recusa foi usado para avaliação (completção raw vs policy-gated), e se estudos de elicitação de novatos complementam o resultado de múltipla escolha.

## Exercícios

1. Execute `code/main.py`. Reporte acurácia por domínio antes e depois do passo simulado de unlearning. Explique o trade-off de capacidade geral.

2. Aumente o WMDP simulado com um quarto domínio (por exemplo, radiológico). Eespecificaçãoifique dois tipos ilustrativos de questões na zona amarela. Explique por que elaborar tais questões é mais difícil que adicionar questões formato MMLU.

3. Leia WMDP 2024 Seção 5 (metodologia RMU). Esboce uma abordagem de unlearning mais simples (por exemplo, suprimir top-k neurônios para conteúdo do domínio) e descreva seu custo esperado de capacidade geral.

4. O teste de aquisição de armas biológicas da Anthropic em 2025 reporta uplift de 2.53x. Descreva duas formas como esse número poderia ser enviesado para cima (tamanho da amostra de novatos, fidelidade da tarefa) e duas para baixo (teto de elicitação, gating de segurança do modelo).

5. Articule o que um safety case para ASL-3 requer além de passar o unlearning do WMDP. Nomeie pelo menos dois estudos de elicitação complementares.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| WMDP | "o benchmark de uso duplo" | 4.157 MCQs em bio/cyber/chem na zona amarela |
| Zona amarela | "habilitador mas não síntese" | Conhecimento aproximado adjacente a capacidade prejudicial sem ser receita de síntese |
| RMU | "a baseline de unlearning" | Representation Misdirection for Unlearning; reduz scores WMDP, preserva capacidade geral |
| Uplift relativo a novatos | "quanto ajuda não-eespecificaçãoialistas" | Vantagem multiplicativa sobre busca na internet padrão para um novato |
| Capacidade absoluta de eespecificaçãoialistas | "teto para eespecificaçãoialistas" | Máxima informação extraível do modelo por um eespecificaçãoialista motivado |
| Tarefa de fase de aquisição | "passos antes da síntese" | Aquisição, equipamento, permissões — as partes iniciais de uma via de dano |
| ITAR/EAR | "conformidade de controle de exportação" | Frameworks legais que restringem publicação de certos conhecimentos habilitadores |

## Leitura Complementar

- [Li et al. — The WMDP Benchmark (arXiv:2403.03218, ICML 2024)](https://arxiv.org/abs/2403.03218) — o benchmark e paper RMU
- [OpenAI — Preparedness Framework v2 (15 de abril de 2025)](https://openai.com/index/updating-our-preparedness-framework/) — linguagem "no limiar"
- [Anthropic — Responsible Scaling Policy v3.0 (fevereiro de 2026)](https://www.anthropic.com/responsible-scaling-policy) — limiar ASL-3 bio e resultados do teste de aquisição
- [DeepMind — Frontier Safety Framework v3.0 (setembro de 2025)](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — CCL de uplift bio
