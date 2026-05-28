# Preparedness Framework da OpenAI e Frontier Safety Framework da DeepMind

> Preparedness Framework v2 da OpenAI (abril de 2025) introduz Research Categories — Long-range Autonomy, Sandbagging, Autonomous Replication and Adaptation, Undermining Safeguards — distintas de Tracked Categories. Tracked Categories acionam Capabilities Reports mais Safeguards Reports revisados pelo Safety Advisory Group. FSF v3 da DeepMind (setembro de 2025, com Tracked Capability Levels adicionados em 17 de abril de 2026) incorpora autonomia nos domínios ML R&D e Cyber (nível 1 de autonomia em ML R&D = automatizar completamente o pipeline de P&D de IA a custo competitivo vs ferramentas humanas + IA). FSF v3 aborda explicitamente alinhamento enganoso via monitoramento automatizado de uso indevido de raciocínio instrumental. Nota honesta: Research Categories no PF v2 (incluindo Long-range Autonomy) não acionam automaticamente mitigações; a linguagem de política é "potencial." A própria DeepMind diz que monitoramento automatizado "não permanecerá suficiente no longo prazo" se raciocínio instrumental se fortalecer.

**Tipo:** Aprender
**Linguagens:** Python (stdlib, ferramenta de diff de tabela de decisão de três frameworks)
**Pré-requisitos:** Fase 15 · 19 (RSP da Anthropic)
**Tempo:** ~45 minutos

## O Problema

A Aula 19 leu de perto a política de escala da Anthropic. Esta aula completa o panorama lendo as da OpenAI e DeepMind. Os três documentos são artefatos primos abordando a mesma questão — quando um laboratório de fronteira deve pausar ou limitar um modelo — e convergem em um pequeno conjunto de categorias e divergem em pontos eespecificaçãoíficos que importam.

A convergência: os três rotulam long-range autonomy como uma classe de capacidade值得跟踪. Os três reconhecem comportamento enganoso (alignment faking, sandbagging) como uma classe eespecificaçãoífica de risco. Os três têm um corpo de revisão interno. A divergência: a OpenAI divide categorias em "Tracked" (mitigação obrigatória) e "Research" (sem gatilho automático). DeepMind incorpora autonomia em dois domínios ao invés de nomeá-la separadamente. Os laboratórios nomeiam Tracked vs Research, ou Critical vs Moderate, ou Tier-1 vs Tier-2; a consequência operacional de em qual balde uma capacidade vive é diferente entre laboratórios.

Ler juntos é o exercício útil. A mesma capacidade pode ser "mitigação obrigatória" na Anthropic, "monitorada mas não acionando" na OpenAI e "rastreada em um domínio eespecificaçãoífico" na DeepMind. A postura de política importa.

## O Conceito

### Preparedness Framework v2 da OpenAI (abril de 2025)

Estrutura:

- **Tracked Categories**: acionam Capabilities Reports (o que o modelo consegue fazer) mais Safeguards Reports (quais mitigações estão no lugar). Revisados pelo Safety Advisory Group antes do deploy.
- **Research Categories**: capacidades de modelo que o laboratório rastreia mas ainda não se compromete a mitigações eespecificaçãoíficas. Inclui Long-range Autonomy, Sandbagging, Autonomous Replication and Adaptation, Undermining Safeguards.

Enquadramento-chave em v2: Research Categories não acionam automaticamente mitigações. A linguagem de política é mitigações "potenciais." Esse é o delta eespecificaçãoífico a observar: a localização de uma categoria em Tracked vs Research é a dobradiça entre "limitado" e "observado."

### Frontier Safety Framework v3 da DeepMind (setembro de 2025; Tracked Capability Levels adicionados em 17 de abril de 2026)

Estrutura:

- **Critical Capability Levels (CCLs)**: limiares de capacidade em cinco domínios: Cyber, Bio, ML R&D, CBRN, Autonomy (incorporado em ML R&D e Cyber).
- **Tracked Capability Levels**: granularidade adicional adicionada em abril de 2026. Exemplo concreto: nível 1 de autonomia em ML R&D = automatizar completamente o pipeline de P&D de IA a custo competitivo vs ferramentas humanas + IA.
- **Monitoramento de alinhamento enganoso**: compromisso explícito com monitoramento automatizado de uso indevido de raciocínio instrumental.

O enquadramento de autonomia difere da OpenAI. DeepMind não mantém "Autonomy" como domínio de nível superior; é incorporado nos domínios onde a autonomia causaria dano (ML R&D e Cyber). O argumento é que autonomia sem domínio é capacidade sem risco; o contra-argumento é que autonomia entre domínios é um meta-risco que o framework deveria nomear.

### Onde os três convergem

- Safety Advisory Group interno (nomeado SAG da Anthropic, SAG da OpenAI, comitê interno da DeepMind). Revisão antes de implantação para modelos de alta capacidade.
- Menção explícita de alinhamento enganoso / alignment faking como classe de risco.
- Artefatos permanentes em cadência declarada (Anthropic: Frontier Safety Roadmap, Risk Report; OpenAI: Capabilities and Safeguards Reports; DeepMind: ciclo de atualização do FSF).
- Reconhecimento de que defesas baseadas apenas em monitoramento têm um teto. DeepMind é explícita: "monitoramento automatizado não permanecerá suficiente no longo prazo."

### Onde divergem

- **Anthropic**: compromisso de pausa removido na v3.0; limiar AI R&D-4 é o próximo gate nomeado.
- **OpenAI**: divisão Tracked vs Research; Research Categories (incluindo Long-range Autonomy) não limitam automaticamente.
- **DeepMind**: autonomia incorporada em outros domínios; Tracked Capability Levels adicionam granularidade em abril de 2026.

### Sandbagging: uma capacidade eespecificaçãoífica que complica os três

Sandbagging (um modelo subdesempenha estrategicamente em avaliações) está nas Research Categories da OpenAI. RSP v3.0 da Anthropic aborda via lacuna eval-vs-deploy (Aula 1). DeepMind aborda via monitoramento de alinhamento enganoso em FSF v3.

Se um modelo sandbags em avaliações, todos os limiares de capacidade dos frameworks são subestimados. O framework funciona somente se a medida funcionar. É por isso que medição externa (Aula 21, METR) e avaliação adversarial são necessárias além da auto-avaliação do laboratório.

### A habilidade de ler políticas

- Localizar: toda capacidade que importa deve ser encontrável na política. Se não for encontrável, a política não cobre.
- Classificar: é Tracked (aciona mitigação) ou Research (rastreada mas não acionando)? OpenAI nomeia isso; Anthropic e DeepMind têm seus equivalentes.
- Cadência: a política é atualizada em agenda declarada, ou somente após eventos eespecificaçãoíficos? Cadência declarada é mais forte.
- Independência: revisão externa é obrigatória ou opcional? Anthropic se associa com Apollo e US AI Safety Institute; OpenAI com METR; DeepMind com SAG interno principalmente.

## Use

`code/main.py` implementa uma pequena ferramenta de diff de tabela de decisão. Dada uma capacidade (autonomia, alinhamento enganoso, automação de P&D, uplift de cyber, etc.), produz como cada uma das três políticas classifica a capacidade e quais mitigações disparam. É uma ajuda de leitura, não uma ferramenta de política.

## Entregue

`outputs/skill-cross-policy-diff.md` produz uma comparação cross-policy para uma capacidade eespecificaçãoífica, usando os três frameworks como referência.

## Exercícios

1. Rode `code/main.py`. Confirme que a saída da ferramenta de diff combina com as políticas para pelo menos duas capacidades que você pode verificar nos documentos-fonte.

2. Leia o Preparedness Framework v2 da OpenAI completo. Identifique cada Research Category. Para cada uma, escreva uma frase sobre por que está em Research e não em Tracked.

3. Leia o FSF v3 da DeepMind completo, mais a atualização de Tracked Capability Levels de abril de 2026. Identifique os critérios eespecificaçãoíficos de avaliação do nível 1 de autonomia em ML R&D. Como você mediria externamente?

4. Sandbagging está nas Research Categories da OpenAI. Projete uma avaliação que forçasse um modelo que sandbags a revelar sua capacidade real. Referencie a discussão de eval-context gaming da Aula 1.

5. Compare as três políticas em uma capacidade eespecificaçãoífica (sua escolha). Nomeie qual política de classificação você acha mais rigorosa e qual menos. Justifique com texto-fonte.

## Termos-Chave

| Termo | O que dizem | O que significa de verdade |
|---|---|---|
| Preparedness Framework | "Política de escala da OpenAI" | PF v2 (abril de 2025); categorias Tracked vs Research |
| Tracked Category | "Mitigação obrigatória" | Aciona Capabilities + Safeguards Reports; revisão SAG |
| Research Category | "Somente monitorada" | Rastreada mas sem mitigação automática; inclui Long-range Autonomy |
| Frontier Safety Framework | "Política de escala da DeepMind" | FSF v3 (set 2025) + Tracked Capability Levels (abr 2026) |
| CCL | "Critical Capability Level" | Limiar da DeepMind por domínio (Cyber, Bio, ML R&D, CBRN) |
| Nível 1 de autonomia em ML R&D | "Automação de P&D" | Automatizar completamente o pipeline de P&D de IA a custo competitivo |
| Sandbagging | "Subdesempenho estratégico" | Modelo subdesempenha em evals; nas Research Categories da OpenAI |
| Raciocínio instrumental | "Raciocínio meios-fins" | Raciocínio sobre como atingir objetivos; alvo do monitoramento da DeepMind |

## Leituras Adicionais

- [OpenAI — Updating our Preparedness Framework](https://openai.com/index/updating-our-preparedness-framework/) — anúncio da v2.
- [OpenAI — Preparedness Framework v2 PDF](https://cdn.openai.com/pdf/18a02b5d-6b67-4cec-ab64-68cdfbddebcd/preparedness-framework-v2.pdf) — documento completo.
- [DeepMind — Strengthening our Frontier Safety Framework](https://deepmind.google/blog/strengthening-our-frontier-safety-framework/) — anúncio do FSF v3.
- [DeepMind — Updating the Frontier Safety Framework (April 2026)](https://deepmind.google/blog/updating-the-frontier-safety-framework/) — adição de Tracked Capability Levels.
- [Gemini 3 Pro FSF Report](https://storage.googleapis.com/deepmind-media/gemini/gemini_3_pro_fsf_report.pdf) — exemplo de Risk Report no formato FSF.
