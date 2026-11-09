# Ferramentas da Equipe Vermelha  Garak, Guarda Lama, PyRIT

> Três ferramentas de produção enquadram a pilha de equipa vermelha de 2026. Llama Guard (Meta)  um classificador Llama-3.1-8B ajustado em 14 categorias de perigo de MLCommons; o 2025 Llama Guard 4 é um classificador multimodais nativo 12B podado a partir de Llama 4 Scout. Garak (NVIDIA)  Scanner de vulnerabilidade LLM de código aberto com sondas estáticas, dinâmicas e adaptativas para alucinações, vazamento de dados, injeção rápida, toxicidade e jailbreaks. PyRIT (Microsoft)  campanhas red-team multi-turn com Crescendo, TAP e cadeias de conversores personalizadas para exploração profunda. Llama Guard 3 é documentado no Meta "Llama 3 Herd of Models" (arXiv:2407.21783); Llama Guard 3-1B-INT4 em arXiv:2411.17713; Arquitetura da sonda de Garak em github.com/NVIDIA/garak. Estas ferramentas são a interface de produção 2026 entre a investigação da equipa vermelha (Lessões 12-15) e a implantação (Lessões 17+).

**Type:** Build
**Languages:** Python, TypeScript (stdlib, tool-architecture simulator and Llama Guard-style classifier mock)
**Prerequisites:** Phase 18 · 12-15 (jailbreaks and IPI)
**Time:** ~75 minutes

## Objetivos de aprendizagem

- Descreva a posição do Llama Guard 3/4 na pilha de segurança: classificador de entrada, classificador de saída ou ambos.
- Cite as 14 categorias de perigo MLCommons e indique uma que não seja óbvia (abuso de interpretadores de código).
- Descreva a arquitetura da sonda de Garak: sondas, detectores, arneses.
- Descreva a estrutura da campanha de turnos múltiplos do PyRIT e como ela se compõe com as sondas Garak.

## O problema

As lições 12-15 apresentam a superfície de ataque. As implementações de produção precisam de avaliação repetível e escalável. Três ferramentas dominam 2026: Llama Guard (o classificador de defesa), Garak (o escaneador), PyRIT (o orquestador de campanha). Cada uma visa uma camada diferente do ciclo de vida da equipe vermelha.

## O conceito

### Guarda de lama (Meta)

Llama Guard 3 é um modelo Llama-3.1-8B ajustado para classificação de entrada/saída em relação às categorias MLCommons AILuminate 14:
- Crimes violentos, crimes não violentos, relacionados com o sexo, CSAM, difamação
- Conselhos especializados, privacidade, IP, armas indiscriminadas, ódio
- Suicídio/auto-harmagem, conteúdo sexual, eleições, abuso de interpretadores de código

Suporta 8 idiomas. Uso: coloca antes do LLM (moderação de entrada), após o LLM (moderação de saída), ou ambos. Os dois usos geram distribuições de treinamento diferentes.

Llama Guard 3-1B-INT4 (arXiv:2411.17713, 440MB, ~ 30 tokens / s em CPU móvel) é a variante de borda quantizada.

Llama Guard 4 (abril 2025) é 12B, nativo multimodal, podado a partir de Llama 4 Scout.

### Garak (NVIDIA)

Scanner de vulnerabilidade de código aberto.
- **Probes.**Geradores de ataque para alucinação, vazamento de dados, injeção rápida, toxicidade, jailbreaks. estático (invite fixo), dinâmico (invite gerado), adaptativo (responde à saída alvo).
- **Detectors.**Resultados de pontuação em relação aos modos de falha esperados  tóxicos, vazados, jailbroken.
- **Harnesses.**Gerenciar pares de sondas-detectores, executar campanhas, gerar relatórios.

TrustyAI integra Garak com os escudos Llama-Stack (Clasificador de entrada Prompt-Guard-86M, Classificador de saída Llama-Guard-3-8B) para avaliação de alvos protegidos de ponta a ponta. A pontuação baseada em níveis (TBSA) substitui o pass/falha binário.

### PyRIT (Microsoft)

Python Risk Identification Toolkit, campanhas red-team multiples.
- **Converters.**Transformar um semente de resposta parafrase, codificar, traduzir, jogar papéis.
- **Orchestrators.**Executa a campanha: Crescendo (escalação), TAP (branqueamento), RedTeaming (loop personalizado).
- **Scoring.**Licenciatura em Direito como juiz ou classificador como juiz.

O PyRIT é o primo mais pesado de Garak. Garak executa milhares de sondas de uma única volta; o PyRIT executa campanhas profundas de várias voltas projetadas para quebrar modos de falha específicos.

### A pilha

Coloque a guarda Llama em ambos os lados do modelo. Execute Garak todas as noites para regressão. Execute PyRIT para campanhas pré-lançamento. Esta é a configuração padrão de 2026 para a maioria das implantações de produção.

### Empregos de avaliação

- **Judge identity.**As três ferramentas podem usar um juiz de LLM; os drives de calibração dos juízes relataram ASRs (Lessão 12). Especifique o juiz ao lado da ferramenta.
- **Probe staleness.**Garak envelhece as sondas quando os modelos são apertados contra elas.
- **Llama Guard FPR on benign content.**As primeiras versões da Guarda Llama exibiram conteúdo político e LGBTQ +; as calibrações da Guarda Llama 3/4 foram melhoradas, mas não calibradas por implantação.

### Onde isto encaixa na Fase 18

Lições 12-15 são as famílias de ataque. Lição 16 é a ferramenta de produção. Lição 17 (WMDP) é a avaliação de capacidade de duplo uso. Lição 18 é os quadros de segurança de fronteira que envolvem essas ferramentas em uma estrutura política.

```figure
al-guard-stack
```

## Usá-lo

`code/main.py`Construi um classificador de estilo brinquedo Llama Guard (palavra-chave + características semânticas em 14 categorias), um arnes Garak brinquedo (loop de detector de sonda), e uma cadeia de conversor de várias voltas de estilo PyRIT.

## Envia-o

Esta lição produz`outputs/skill-red-team-stack.md`- Uma descrição da implantação indica quais das três ferramentas são adequadas, o que deve ser configurado em cada uma delas e qual é a cadência de regressão a executar.

## Exercícios

1. Corra .`code/main.py`Comparar a taxa de detecção do classificador de estilo Llama-Guard em ataques de uma única volta versus vários.

2. Implementar uma nova sonda Garak: um pedido prejudicial codificado base64.

3. Extender a cadeia de conversores de estilo PyRIT com um conversor "traduzir para francês, depois parafrasear".

4. Leia a lista de categorias de perigo do Llama Guard 3. Identifique duas categorias em que os dados de treinamento produziriam, de forma realista, taxas altas de falsos positivos sobre conteúdo legítimo para desenvolvedores.

5. Comparar os princípios de design do Garak e do PyRIT.

## Termos-chave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Llama Guard | "the classifier" | Fine-tuned Llama-3.1-8B/4-12B safety classifier with 14 hazard categories |
| Garak | "the scanner" | NVIDIA open-source vulnerability scanner; probes, detectors, harnesses |
| PyRIT | "the campaign tool" | Microsoft multi-turn red-team orchestrator; converters, orchestrators, scoring |
| Prompt-Guard | "the small classifier" | Meta's 86M prompt-injection classifier, paired with Llama Guard |
| TBSA | "tier-based scoring" | Garak's tier-based pass/fail replacing binary outcomes |
| Converter chain | "paraphrase + encode + ..." | PyRIT composition primitive for building multi-step attacks |
| MLCommons hazard categories | "the 14 taxonomies" | Industry-standard taxonomy Llama Guard targets |

## Mais leitura

- [Meta — Llama Guard 3 (in Llama 3 Herd paper, arXiv:2407.21783)](https://arxiv.org/abs/2407.21783) o classificador 8B
- [Meta — Llama Guard 3-1B-INT4 (arXiv:2411.17713)](https://arxiv.org/abs/2411.17713) Classificador de dispositivos móveis quantizados
- [NVIDIA Garak — GitHub](https://github.com/NVIDIA/garak) o repo do scanner e a documentação
- [Microsoft PyRIT — GitHub](https://github.com/Azure/PyRIT) o conjunto de ferramentas da campanha
