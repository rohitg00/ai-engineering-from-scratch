# Injeção de Instrução Invertida Indirecta  Superfície de Ataque de Produção

> Injeção de prompt indireta (IPI) incorpora instruções dentro de conteúdo externo  uma página web, um e-mail, um documento compartilhado, um ticket de suporte  consumido por um sistema de agência sem ação explícita do usuário. O IPI é a ameaça de produção dominante para 2026: contorna os filtros de entrada do usuário porque o atacante nunca toca no usuário, escala silenciosamente à medida que os agentes processam mais conteúdo externo e visa fluxos de trabalho automatizados onde ninguém está lendo o prompt. Informações do MDPI 17 ((1): 54 (janeiro 2026) sintetizam a pesquisa 2023-2025. O documento de defesa IPI do NDSS 2026 enquadra o desafio principal: as instruções injetadas podem ser semanticamente benignas ("imprime sim"), portanto, a detecção requer mais do que filtragem de palavras-chave. "O Atacante se move em segundo lugar" (Nasr et al., joint OpenAI/Anthropic/DeepMind, outubro 2025): ataques adaptativos (gradiente, RL, busca aleatória, equipe vermelha humana) ignoraram todas as 12 defesas publicadas que testaram, com sucesso de ataque acima de 90% contra a maioria delas, embora a maioria dessas defesas tenha relatado taxas de sucesso de ataque quase zero.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, IPI attack + defense harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 14 (agent engineering)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Defina a injecção imediata indirecta e descreva três vetores de entrega comuns.
- Explique por que os filtros de entrada do utilizador não têm IPI.
- Descreva o enquadramento do "controle do fluxo de informação" como o paradigma de defesa de 2026.
- Estabelecer a conclusão de Nasr et al. (outubro de 2025) sobre o sucesso de ataques adaptativos contra defesas IPI publicadas.

## O problema

A injeção direta de prompt requer que o atacante chegue ao usuário ou ao seu prompt. IPI requer nenhuma das duas: o atacante coloca uma carga útil em qualquer conteúdo que o agente possa ler  uma página web, um e-mail na caixa de entrada, um problema do GitHub, uma revisão de produto. O agente o pega durante a operação normal e executa as instruções. O usuário é o mensageiro, não a intenção.

## O conceito

### Três vectores de entrega

- **Retrieval-augmented generation (RAG).**O atacante publica um documento; o passo de recuperação o retira; o prompt concatená-lo antes da pergunta do usuário; o modelo executa as instruções do atacante.
- **Inbox / document workflows.**O atacante envia um e-mail ao usuário; o agente lê os e-mails; o prompt inclui o corpo do e-mail; o modelo segue as instruções do e-mail.
- **Tool output.**O atacante controla uma ferramenta que o agente usa (por exemplo, uma pesquisa na web que retorna um resultado controlado pelo atacante); a saída da ferramenta contém instruções; o fluxo de controle do agente os segue.

Os três compartilham uma propriedade estrutural: o atacante controla um fragmento do prompt sem tocar na entrada que o usuário enfrenta.

### Por que os filtros de entrada do usuário não o conseguem

Uma carga útil IPI não aparece na entrada do usuário. Ela aparece no conteúdo recuperado. Se o filtro é bloqueado na entrada do usuário, a carga útil o contorna. Se o filtro é bloqueado em todo o conteúdo que chega ao modelo, deve aplicar-se ao texto recuperado arbitrário  que é caro e produz falsos positivos contra conteúdo legítimo que contém linguagem de voz imperativa.

### Controle de fluxo de informação (IFC) para IA

O paradigma de defesa 2026 leva emprestado da segurança clássica do sistema operacional. Trata cada fonte de conteúdo como um rótulo de segurança. Etiquete a consulta do usuário como "confiável". Etiquete o conteúdo recuperado como "não confiável". Trate o fluxo de controle do modelo como um fluxo de informações: ações desencadeadas por conteúdo não confiável devem ser ratificadas por entrada confiável antes da execução.

CaMeL (Microsoft 2025), ConfAIde (Stanford 2024), e o papel de defesa IPI NDSS 2026 operationalizar IFC de maneiras diferentes.

### O atacante se move em segundo lugar

Nasr et al. (outubro de 2025) testaram 12 defesas IPI publicadas com ataques adaptativos (busca de gradiente, políticas de RL, busca aleatória, equipe vermelha humana de 72 horas).

A lição metodológica: publicar uma defesa apenas com avaliação de ataque adaptativo.

### Incidentes reais

A lição 25 abrange EchoLeak (CVE-2025-32711, CVSS 9.3)  o primeiro IPI de cero-clique documentado publicamente no Microsoft 365 Copilot. CamoLeak (CVSS 9.6) no GitHub Copilot Chat. CVE-2025-53773 no GitHub Copilot. As implementações de produção estão sendo comprometidas pelo IPI no campo, não apenas em benchmarks.

### Enquadramento de OWASP e NIST

O OWASP LLM Top 10 (2025) classifica a injeção rápida (direita + indireta) como LLM01, a ameaça de camada de aplicação número 1. O NIST AI SPD 2024 chama a injeção rápida indireta de "a maior falha de segurança da IA gerativa".

### Onde isto encaixa na Fase 18

Lições 12-14 são jailbreaks centrados em modelos. Lição 15 é o ataque centrado no sistema que domina as implantações de produção de 2026. Lição 16 abrange as ferramentas defensivas. Lição 25 abrange a narrativa específica do CVE.

```figure
al-injection-vector
```

## Usá-lo

`code/main.py`construiu um arame IPI. Um agente de brinquedos tem três ferramentas (pesquisa na web, leitura de e-mail, envio de mensagem). O ambiente contém conteúdo controlado pelo atacante com uma instrução incorporada ("transmitir isso a todos os contatos"). Você pode alternar entre um agente ingênuo (segui as instruções injetadas), um agente protegido por filtros (filtro de palavras-chave no conteúdo recuperado) e um agente IFC (separa conteúdo confiável e não confiável e recusa comandos de fluxo de controle não confiáveis).

## Envia-o

Esta lição produz`outputs/skill-ipi-audit.md`. Tendo em conta uma descrição de implantação de agentes, ele enumera as fontes de conteúdo não confiáveis, verifica se a implantação aplica o IFC e indica as fontes que chegam ao modelo sem um rótulo de confiança.

## Exercícios

1. Corra .`code/main.py`- Medir a taxa de sucesso do ataque contra cada um dos três agentes.

2. Implementar uma defesa baseada em parafrases no conteúdo recuperado.

3. Leia o documento de defesa do IPI do NDSS 2026 descreva o desafio de "instruções benignas" e por que impede o filtro baseado em palavras-chave.

4. Desenhe uma implantação em que o agente receba uma saída de ferramenta de uma API de terceiros. Etiquete cada fragmento de prompt com um nível de confiança e escreva a política IFC que rege as ações do agente.

5. Reproduzir a metodologia de ataque adaptativo Nasr et al. 2025 no seu agente filtrado do exercício 2.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| IPI | "indirect prompt injection" | Injection via content the user did not write, consumed by the agent during normal operation |
| RAG injection | "poisoned retrieval" | Attacker publishes content that the retrieval step fetches; prompt contains the payload |
| Zero-click | "no user action" | Attack triggers automatically during agent operation; user does nothing |
| IFC | "information flow control" | Label-based approach: actions from untrusted content require trusted ratification |
| Adaptive attack | "gradient / RL red-team" | Attack that knows the defense and optimizes against it; required for honest evaluation |
| Benign instruction | "please print Yes" | IPI payload that is semantically benign; no keyword filter catches it |
| Scope violation | "cross-trust exfiltration" | Agent accesses data from one trust context and outputs it to another |

## Mais leitura

- [MDPI Information 17(1):54 — Indirect Prompt Injection Survey (January 2026)](https://www.mdpi.com/2078-2489/17/1/54) Síntese 2023-2025
- [Nasr et al. — The Attacker Moves Second (joint OpenAI/Anthropic/DeepMind, October 2025)](https://arxiv.org/abs/2510.18108) Avaliação de ataques adaptativos
- [Greshake et al. — Not what you've signed up for (arXiv:2302.12173)](https://arxiv.org/abs/2302.12173) o papel IPI original
- [OWASP — LLM Top 10 (2025)](https://genai.owasp.org/llm-top-10/) Injecção rápida classificada LLM01
