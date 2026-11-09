# Plataformas de LLM gerenciadas  Bedrock, Vertex AI, Azure OpenAI

> Três hiperescaladores, três estratégias distintas. AWS Bedrock é um mercado modelo  Claude, Llama, Titan, Estabilidade, Cohere por trás de uma API. O Azure OpenAI é uma parceria exclusiva com o OpenAI, além de unidades de transferência de dados (PTUs) para capacidade dedicada. A IA Vertex é a primeira Gemini com a melhor história de longo contexto e multimodal. Em 2026, a Análise Artificial mede o Azure OpenAI em ~ 50 ms de mediana e o Bedrock em ~ 75 ms em equivalentes Llama 3.1 405B  PTUs explicam a lacuna porque a capacidade dedicada supera a capacidade compartilhada sob demanda. A regra da decisão não é "o que é mais rápido", mas "o que catálogo de modelos e a superfície FinOps coincide com o meu produto". Esta lição ensina a escolher com as compensações escritas, não com vibrações.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Objetivos de aprendizagem

- Cite as três estratégias de plataforma (mercado vs exclusivo vs Gemini-first) e combina cada uma com um caso de uso do produto.
- Explique o que as Unidades de Transmissão Provisória (PTUs) compram no Azure OpenAI e por que o Bedrock sob demanda normalmente lê cerca de 25 ms mais lentamente na escala 405B.
- Diagrama a superfície de atribuição FinOps para cada plataforma (profis de inferência de aplicativos Bedrock vs Vertex projeto por equipe vs escopo de Azure + reservas de PTU).
- Escreva uma política de "mínimo de dois fornecedores" e explique por que o bloqueio de um único fornecedor é o erro caro em 2026.

## O problema

Você escolheu Claude 3.7 Sonnet para o seu produto. Agora você precisa servi-lo. Você pode ligar para a API Anthropic diretamente, ou você pode chamá-la através da AWS Bedrock, ou você pode passar por um gateway. A API direta é a mais simples; Bedrock adiciona BAAs, pontos finais VPC, IAM e atribuição CloudWatch. O gateway adiciona falhaover, faturamento unificado e limites de taxas entre provedores.

A questão mais profunda é o catálogo. Se você precisa de Claude e Llama e Gemini no mesmo produto, você não pode comprá-los todos de um só lugar a menos que esse lugar seja Bedrock mais Vertex mais Azure OpenAI simultaneamente. Os hiperescaladores não são intercâmbios.

Esta lição mapeia as três apostas, a lacuna de latência, a lacuna de FinOps e o risco de bloqueio.

## O conceito

### Três estratégias

**AWS Bedrock**O mercado. Claude (Anthropic), Llama (Meta), Titan (AWS primeira-parte), Estabilidade (imagem), Cohere (embeddings), Mistral, mais imagem e inserção de sub-catálogos. Uma API, uma superfície IAM, uma CloudWatch exportação.

**Azure OpenAI** a parceria exclusiva. Você recebe GPT-4 / 4o / 5 / o-série, DALL·E, Whisper e ajuste fino de modelos OpenAI nos datacenters Azure. Nenhum modelo não OpenAI no catálogo "Azure OpenAI Service"  aqueles vão para a Azure AI Foundry (produto separado). A aposta da Azure é que OpenAI continua a ser a fronteira e os clientes querem controles empresariais sobre esse relacionamento específico.

**Vertex AI** Gemini primeiro, tudo o resto em segundo lugar. Gemini 1.5 / 2.0 / 2.5 Flash e Pro, além do Model Garden (terceiro).

### Diferença de latência na escala

A Análise Artificial apresenta valores de referência contínuos. Em implementações equivalentes Llama 3.1 405B, a latença média do primeiro token do Azure é de cerca de 50 ms com PTUs; Bedrock em distribuição on demand é de cerca de 75 ms. A diferença não é uma falha da AWS  é uma diferença de modelo de capacidade. O Azure vende PTUs (Provisioned Throughput Units), que reservam capacidade de GPU para o seu inquilino. O equivalente do Bedrock (Provisioned Throughput) existe, mas começa em torno de US$ 21/hora por unidade, e a maioria dos clientes permanece em compartilhamento sob demanda.

Capacidade compartilhada sob demanda compete com o tráfego de todos os outros clientes. Capacidade dedicada não. Se o seu produto SLA é TTFT < 100 ms em P99, você compra PTUs no Azure, compra Bedrock Provisioned Throughput ou aceita a variância padrão.

### Economia da produção de dados

Azure PTUs: um bloco reservado de computação de inferência. Até ~ 70% de poupança vs. sob demanda para cargas de trabalho previsíveis. Custos fixos por hora independentemente do tráfego  você paga pela reserva mesmo quando está ociosa. O equilíbrio de ruptura geralmente é de cerca de 40-60% de utilização sustentada.

Transmissão de Bedrock: $21-$50 por hora dependendo do modelo e região. Matemática similar  equilíbrio de ruptura é cerca de metade da utilização máxima. compromisso mensal requerido.

A capacidade de fornecimento da Vertex é vendida por SKU Gemini; os preços variam de acordo com o modelo e a região e são menos publicamente anunciados.

### Superfície FinOps  o diferenciador real

**Bedrock Application Inference Profiles**As atribuições de um perfil são as mais limpas do mercado.`team`- Não .`product`- Não .`feature`· rotear todas as invocações de modelo através dele; CloudWatch quebra o custo por perfil sem pós-processamento. Adicionado 2025, ainda o mais granular nativo de hipercaler.

**Vertex**A atribuição é projeto por equipe mais rótulos em todos os lugares. Você modela cada equipe como um projeto GCP, coloca rótulos em cada recurso, e usa BigQuery Billing Export + DataStudio para rolups. Mais trabalho, mas BigQuery dá-lhe SQL arbitrário sobre os dados de custo.

**Azure**baseia-se em escopo de assinatura/grupo de recursos mais tags, com reservas de PTU como um objeto de custo de primeira classe. Tags são herdados de grupos de recursos, não de solicitações, por isso a atribuição por solicitação requer métricas personalizadas de Application Insights ou um gateway que marca cabeçalhos.

O padrão: Bedrock é o nativo mais limpo, Vertex é o mais flexível através do BigQuery, Azure é o mais opaco a menos que você use o instrumento.

### O bloqueio é o risco de 2026

O compromisso de um único hiperescalado estava bem quando um modelo dominava. Em 2026 a fronteira se move mensalmente  Claude 3.7 no primeiro trimestre, Gemini 2.5 no próximo, GPT-5 no trimestre seguinte.

Os equipes de trabalho de padrão adotam: dois provedores mínimos para qualquer chamada de LLM crítica ao produto. Bedrock mais Azure OpenAI é o par comum  Claude de um, GPT do outro, falha-over entre eles, o mesmo gateway. O aumento de custos é insignificante porque as rotas do gateway são ótimas; o aumento da disponibilidade durante interrupções (como o incidente do Azure OpenAI de janeiro de 2025, a interrupção AWS us-east-1) é decisivo.

### Residência de dados, BAAs e indústrias regulamentadas

Bedrock: BAAs na maioria das regiões; pontos finais VPC; barris.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; residência de dados da UE; padrão regulamentado pela empresa.
Vertex: HIPAA, GDPR, residência de dados por região; Google Cloud compliance stack.

As diferenças são nas políticas de retenção de dados, como os registos são manuseados e se o monitoramento de abuso lê o seu tráfego (opt-in por defeito na maioria; opt-out disponível para empresas).

### Números que você deve lembrar

- TTFT médio do Azure OpenAI em equivalentes Llama 3.1 405B: ~ 50 ms (com PTUs).
- TTFT mediano de cama sob demanda: ~75 ms.
- Transmissão de Bedrock: $21-$50/hora por unidade.
- Azure PTU-break-even: ~ 40-60% de utilização sustentada.
- Poupança de PTU vs. demanda em alta utilização: até 70%.

```figure
i4-platform-lanes
```

## Usá-lo

`code/main.py`Comparar as três plataformas em uma carga de trabalho sintética  modela economia on-demand vs PTU, variância TTFT e fidelidade de atribuição de custos.

## Envia-o

Esta lição produz`outputs/skill-managed-platform-picker.md`. Tendo em conta o perfil da carga de trabalho (modelos necessários, TTFT SLA, volume diário, requisitos de conformidade), recomenda uma plataforma primária, um retorno e um plano de instrumentação FinOps.

## Exercícios

1. Corra .`code/main.py`Em que utilização sustentada o Azure PTU supera a demanda para um modelo de classe 70B?
2. O seu produto precisa de Claude 3.7 Sonnet e GPT-4o. Desenhar uma implantação de dois fornecedores que vai para qual hiperescalador, qual gateway fica na frente, qual é a política de falhaover?
3. Um cliente de saúde regulado requer BAAs, residência de dados do leste dos EUA e sub-100ms P99 TTFT. Escolha uma plataforma e justifique com três características específicas.
4. Descobres que a tua conta da Bedrock aumentou 4 vezes neste mês sem mudanças de tráfego.
5. Leia as páginas de preços da API Anthropic e Bedrock. Para uma carga de trabalho Claude de 100 milhões de tokens / mês, que é mais barato  API Anthropic direta, Bedrock on-demand ou Bedrock Provisioned Throughput?

## Termos-chave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Bedrock | "AWS LLM service" | Model marketplace across Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "Azure's ChatGPT" | Exclusive OpenAI models in Azure datacenters with enterprise controls |
| Vertex AI | "Google's LLM" | Gemini-first platform with Model Garden for third-party models |
| PTU | "dedicated capacity" | Provisioned Throughput Unit — reserved inference GPUs, priced per hour |
| Application Inference Profile | "Bedrock tagging" | Per-product cost/usage profile with tags, CloudWatch-native |
| Model Garden | "Vertex catalog" | Vertex AI's third-party model section, separate from Gemini |
| Two-provider minimum | "LLM redundancy" | Policy of running every critical LLM path across ≥2 hyperscalers |
| BAA | "HIPAA paperwork" | Business Associate Agreement; required for PHI; provided by all three |
| Abuse monitoring | "the log watcher" | Provider-side safety scan on prompts/outputs; opt-out in enterprise |

## Mais leitura

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) cartão de taxa autorizada e preços de transferência fornecidos.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) Economia da PTU e cartões de taxas.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) Níveis Gemini e cobranças adicionais para o Model Garden.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) Referências contínuas de latência e de rendimento entre os prestadores.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) quadro de decisão empresarial.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) Mecânica de atribuição lado a lado.
