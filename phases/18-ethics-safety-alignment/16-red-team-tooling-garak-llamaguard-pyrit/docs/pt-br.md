# Ferramentagem de Red-Team — Garak, Llama Guard, PyRIT

> Três ferramentas de produção definem o stack de red-team em 2026. Llama Guard (Meta) — um classificador Llama-3.1-8B fine-tuned em 14 categorias de perigo do MLCommons; o Llama Guard 4 de 2025 é um classificador nativamente multimodal de 12B podado do Llama 4 Scout. Garak (NVIDIA) — scanner de vulnerabilidades LLM open-source com sondas estáticas, dinâmicas e adaptativas para alucinação, vazamento de dados, prompt injection, toxicidade e jailbreaks. PyRIT (Microsoft) — campanhas de red-team multi-turn com Crescendo, TAP e chains de conversor customizadas para exploração profunda. Llama Guard 3 está documentado no paper "Llama 3 Herd of Models" da Meta (arXiv:2407.21783); Llama Guard 3-1B-INT4 em arXiv:2411.17713; a arquitetura de sondas do Garak em github.com/NVIDIA/garak. Essas ferramentas são a interface de produção de 2026 entre pesquisa de red-team (Lições 12-15) e deployment (Lição 17+).

**Tipo:** Construir
**Linguagens:** Python (stdlib, simulador de arquitetura de ferramentas e mock de classificador estilo Llama Guard)
**Pré-requisitos:** Fase 18 · 12-15 (jailbreaks e IPI)
**Tempo:** ~75 minutos

## Objetivos de Aprendizagem

- Descrever a posição de Llama Guard 3/4 no stack de segurança: classificador de entrada, classificador de saída, ou ambos.
- Nomear as 14 categorias de perigo do MLCommons e indicar uma não-óbvia (Abuso de Code Interpreter).
- Descrever a arquitetura de sondas do Garak: sondas, detectores, harnesses.
- Descrever a estrutura de campanha multi-turn do PyRIT e como ele se combina com sondas do Garak.

## O Problemo

Lições 12-15 apresentam a superfície de ataque. Deployments de produção precisam de avaliação repetível e escalável. Três ferramentas dominam em 2026: Llama Guard (o classificador defensivo), Garak (o scanner), PyRIT (o orquestrador de campanhas). Cada uma atinge uma camada diferente do ciclo de vida do red-team.

## O Conceito

### Llama Guard (Meta)

Llama Guard 3 é um modelo Llama-3.1-8B fine-tuned para classificação entrada/saída sobre as 14 categorias AILuminate do MLCommons:
- Crimes violentos, crimes não-violentos, conteúdo sexual, CSAM, difamação
- Conselhos especializados, privacidade, propriedade intelectual, armas indiscriminadas, ódio
- Suicídio/autolesão, conteúdo sexual, eleições, abuso de code-interpreter

Suporta 8 idiomas. Uso: colocar antes do LLM (moderação de entrada), depois do LLM (moderação de saída), ou ambos. Os dois usos geram distribuições de treino diferentes — Llama Guard 3 vem como um único modelo lidando com os dois.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, ~30 tokens/s em CPU mobile) é a variante quantizada para edge.

Llama Guard 4 (abril de 2025) tem 12B, é nativamente multimodal, podado do Llama 4 Scout. Substitui tanto o predecessor de texto de 8B quanto o de visão de 11B com um único classificador que ingere texto + imagens.

### Garak (NVIDIA)

Scanner de vulnerabilidades open-source. Arquitetura:
- **Sondas.** Geradores de ataque para alucinação, vazamento de dados, prompt injection, toxicidade, jailbreaks. Estáticas (prompts fixos), dinâmicas (prompts gerados), adaptativas (respondem à saída do alvo).
- **Detectores.** Pontuam saídas contra modos de falha esperados — tóxicas, vazadas, jailbreaks.
- **Harnesses.** Gerenciam pares sonda-detector, rodam campanhas, geram relatórios.

TrustyAI integra Garak com os escudos do Llama-Stack (classificador de entrada Prompt-Guard-86M, classificador de saída Llama-Guard-3-8B) para avaliação de alvo-escudado de ponta a ponta. Pontuação por tier (TBSA) substitui passa/falha binário — um modelo pode passar no tier de severidade 3 e falhar no tier 5 na mesma sonda.

### PyRIT (Microsoft)

Python Risk Identification Toolkit. Campanhas de red-team multi-turn. Construído ao redor:
- **Conversores.** Transformam um prompt semente — paráfrase, codificação, tradução, roleplay.
- **Orquestradores.** Rodam a campanha: Crescendo (escalação), TAP (ramificação), RedTeaming (loop customizado).
- **Pontuação.** LLM-como-juiz ou classificador-como-juiz.

PyRIT é o primo mais pesado do Garak. Garak roda milhares de sondas single-turn; PyRIT roda campanhas multi-turn profundas projetadas para quebrar modos de falha específicos.

### O stack

Coloque Llama Guard nos dois lados do modelo. Roda Garak toda noite para regressão. Roda PyRIT para campanhas pré-release. Essa é a configuração padrão de 2026 para a maioria dos deployments de produção.

### Armadilhas de avaliação

- **Identidade do juiz.** As três ferramentas podem usar um LLM juiz; calibração do juiz influencia ASRs reportados (Lição 12). Especifique o juiz junto com a ferramenta.
- **Envelhecimento de sondas.** Sondas do Garak envelhecem conforme modelos são patcheados contra elas. Sondas adaptativas (formato PAIR) envelhecem mais devagar que sondas estáticas.
- **Falso positivo do Llama Guard em conteúdo benigno.** Versões iniciais do Llama Guard super-marcaram conteúdo político e LGBTQ+; calibrações do Llama Guard 3/4 estão melhoradas mas não são calibradas por deployment.

### Onde isso se encaixa na Fase 18

Lições 12-15 são as famílias de ataque. Lição 16 é a ferramentagem de produção. Lição 17 (WMDP) é a avaliação de capacidade de uso duplo. Lição 18 são os frameworks de segurança fronteira que envelopam essas ferramentas em uma estrutura de política.

## Use

`code/main.py` constrói um classificador simulado estilo Llama Guard (palavras-chave + características semânticas sobre 14 categorias), um harness Garak simulado (loop sonda-detector), e uma chain de conversores estilo PyRIT multi-turn. Você pode rodar as três ferramentas contra um alvo simulado e observar as diferentes assinaturas de cobertura.

## Entregue

Essa lição gera `outputs/skill-red-team-stack.md`. Dada uma descrição de deployment, nomeia quais das três ferramentas são apropriadas, o que configurar em cada uma, e qual cadência de regressão rodar.

## Exercícios

1. Execute `code/main.py`. Compare a taxa de detecção do classificador estilo Llama Guard em ataques single-turn vs multi-turn.

2. Implemente uma nova sonda Garak: um pedido prejudicial codificado em base64. Meça sua detecção pelo classificador estilo Llama Guard.

3. Estenda a chain de conversores estilo PyRIT com um conversor "traduzir para francês, depois parafrasear". Re-meça o sucesso do ataque.

4. Leia a lista de categorias de perigo do Llama Guard 3. Identifique duas categorias onde os dados de treino realisticamente produziriam altas taxas de falso positivo em conteúdo legítimo de desenvolvedor.

5. Compare os princípios de design do Garak e PyRIT. Argumente para um deployment onde cada um é a ferramenta certa.

## Termos-Chave

| Termo | O que dizem | O que realmente significa |
|-------|-------------|---------------------------|
| Llama Guard | "o classificador" | Classificador de segurança Llama-3.1-8B/4-12B fine-tuned com 14 categorias de perigo |
| Garak | "o scanner" | Scanner de vulnerabilidades NVIDIA open-source; sondas, detectores, harnesses |
| PyRIT | "a ferramenta de campanha" | Orquestrador Microsoft de red-team multi-turn; conversores, orquestradores, pontuação |
| Prompt-Guard | "o classificador pequeno" | Classificador de prompt injection Meta de 86M, pareado com Llama Guard |
| TBSA | "tier-based scoring" | Passa/falha por tier do Garak substituindo resultados binários |
| Converter chain | "paráfrase + codificação + ..." | Primitiva de composição PyRIT para construir ataques multi-etapa |
| Categorias de perigo MLCommons | "as 14 taxonomias" | Taxonomia padrão da indústria alvo do Llama Guard |

## Leitura Complementar

- [Meta — Llama Guard 3 (no paper Llama 3 Herd, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) — o classificador de 8B
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) — classificador mobile quantizado
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) — repo e documentação do scanner
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) — toolkit de campanhas
