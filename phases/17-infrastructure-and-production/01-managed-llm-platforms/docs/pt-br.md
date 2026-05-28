# Plataformas Gerenciadas de LLM — Bedrock, Vertex AI, Azure OpenAI

> Três hiperscalers, três estratégias distintas. O AWS Bedrock é um marketplace de modelos — Claude, Llama, Titan, Stability, Cohere por trás de uma API. O Azure OpenAI é uma parceria exclusiva com a OpenAI, somada a Provisioned Throughput Units (PTUs) para capacidade dedicada. O Vertex AI é Gemini-first com a melhor proposta de contexto longo e multimodal. Em 2026, a Artificial Analysis mede o Azure OpenAI com ~50 ms de mediana e o Bedrock com ~75 ms em equivalentes ao Llama 3.1 405B — as PTUs explicam o gap porque capacidade dedicada vence compartilhada sob demanda. A regra de decisão não é "qual é o mais rápido" mas "qual catálogo de modelos e qual superfície de FinOps combinam com meu produto." Esta aula te ensina a escolher com os tradeoffs documentados, não com feeling.

**Tipo:** Aprendizado
**Linguagens:** Python (stdlib, comparador de custo e latência toy)
**Pré-requisitos:** Fase 11 (Engenharia de LLM), Fase 13 (Ferramentas e Protocolos)
**Tempo:** ~60 minutos

## Objetivos de Aprendizado

- Nomear as três estratégias de plataforma (marketplace vs exclusiva vs Gemini-first) e associar cada uma a um caso de uso.
- Explicar o que as Provisioned Throughput Units (PTUs) compram no Azure OpenAI e por que o Bedrock sob demanda costuma ter ~25 ms a mais de latência na escala 405B.
- Diagramar a superfície de atribuição FinOps para cada plataforma (Bedrock Application Inference Profiles vs Vertex projeto-por-equipe vs Azure scopes + reservas de PTU).
- Documentar uma política de "mínimo dois provedores" e explicar por que o lock-in com um único vendor é o erro caro de 2026.

## O Problema

Você escolheu o Claude 3.7 Sonnet para seu produto. Agora precisa servir ele. Pode chamar a API da Anthropic direto, pode chamar pelo AWS Bedrock, ou pode passar por um gateway. A API direta é a mais simples; o Bedrock adiciona BAAs, VPC endpoints, IAM e rastreamento de custo via CloudWatch. O gateway adiciona failover, faturamento unificado e rate limits entre provedores.

A questão mais profunda é o catálogo. Se você precisa de Claude, Llama e Gemini no mesmo produto, não pode comprar todos no mesmo lugar — a não ser que esse lugar seja Bedrock + Vertex + Azure OpenAI simultaneamente. Os hiperscalers não são intercambiáveis — cada um fez uma aposta diferente sobre quem controla a camada de modelos.

Esta aula mapeia as três apostas, o gap de latência, o gap de FinOps e o risco de lock-in.

## O Conceito

### Três estratégias

**AWS Bedrock** — o marketplace. Claude (Anthropic), Llama (Meta), Titan (primeira-party da AWS), Stability (imagem), Cohere (embeddings), Mistral, mais sub-catalogos de imagem e embedding. Uma API, uma superfície de IAM, uma exportação do CloudWatch. A aposta do Bedrock é que clientes querem opção mais do que um único modelo.

**Azure OpenAI** — a parceria exclusiva. Você ganha GPT-4 / 4o / 5 / série o, DALL·E, Whisper e fine-tuning de modelos OpenAI em datacenters Azure. Nenhum modelo que não seja da OpenAI no catálogo "Azure OpenAI Service" — esses vão para o Azure AI Foundry (produto separado). A aposta da Azure é que a OpenAI continua sendo a fronteira e os clientes querem controles empresariais nessa relação específica.

**Vertex AI** — Gemini primeiro, tudo o resto em segundo. Gemini 1.5 / 2.0 / 2.5 Flash e Pro, mais Model Garden (terceiros). A aposta do Vertex é multimodal de contexto longo — o contexto de 1M de tokens do Gemini é o diferencial.

### Gap de latência em escala

A Artificial Analysis roda benchmarks contínuos. Em implantações equivalentes ao Llama 3.1 405B (compartilhadas sob demanda), a mediana de TTFT do Azure OpenAI é de ~50 ms; a do Bedrock é de ~75 ms. O gap não é uma falha da AWS — é uma diferença no modelo de capacidade. A Azure vende PTUs (Provisioned Throughput Units), que reservam capacidade de GPU para seu tenant. O equivalente do Bedrock (Provisioned Throughput) existe mas começa em torno de $21/hora por unidade, e a maioria dos clientes fica no compartilhado sob demanda.

Capacidade compartilhada sob demanda compete com o tráfego de todos os outros clientes. Capacidade dedicada não compete. Se o SLA do seu produto é TTFT < 100 ms no P99, ou você compra PTUs no Azure, ou compra Bedrock Provisioned Throughput, ou aceita a variância padrão.

### Economia de Provisioned Throughput

Azure PTUs: um bloco reservado de compute de inferência. Economia de até ~70% vs sob demanda para workloads previsíveis. Custo fixo por hora independente do tráfego — você paga pela reserva mesmo ocioso. O break-even costuma ficar em torno de 40-60% de utilização sustentada.

Bedrock Provisioned Throughput: $21-$50 por hora dependendo do modelo e da região. Matemática similar — break-even em torno de metade da utilização de pico. Compromisso mensal necessário.

Capacidade provisionada do Vertex é vendida por SKU de Gemini; os preços variam por modelo e região e são menos divulgados publicamente.

### Superfície FinOps — o verdadeiro diferencial

**Bedrock Application Inference Profiles** são a atribuição mais limpa no marketplace. Marque um profile com `team`, `product`, `feature`; roteie todas as invocações de modelo por ele; o CloudWatch separa o custo por profile sem pós-processamento. Adicionado em 2025, ainda o mais granular nativo de hiperscaler.

**Vertex** usa atribuição projeto-por-equipe mais labels em tudo. Você modela cada equipe como um projeto GCP, coloca labels em cada recurso e usa o BigQuery Billing Export + DataStudio para rollups. Mais trabalho, mas o BigQuery dá SQL arbitrário sobre os dados de custo.

**Azure** depende de scopes de assinatura/grupo de recursos mais tags, com reservas de PTU como objeto de custo de primeira classe. Tags são herdadas de grupos de recursos, não de requests, então atribuição por request requer métricas customizadas do Application Insights ou um gateway que injete headers.

O padrão: Bedrock é o mais limpo nativamente, Vertex é o mais flexível via BigQuery, Azure é o mais opaco a menos que você instrumente.

### Lock-in é o risco de 2026

Compromisso com um único hiperscaler funcionava quando um modelo dominava. Em 2026 a fronteira se move mensalmente — Claude 3.7 num trimestre, Gemini 2.5 no próximo, GPT-5 no trimestre seguinte. Trancar em uma plataforma te exclui de dois terços da fronteira.

O padrão que equipes que funcionam adotam: mínimo dois provedores para qualquer chamada LLM crítica ao produto. Bedrock + Azure OpenAI é o par comum — Claude de um, GPT do outro, failover entre eles, mesmo gateway. O aumento de custo é desprezível porque o gateway roteia de forma ótima; o ganho de disponibilidade durante quedas (como o incidente do Azure OpenAI de janeiro de 2025, a queda do AWS us-east-1) é decisivo.

### Residência de dados, BAAs e indústrias regulamentadas

Bedrock: BAAs na maioria das regiões; VPC endpoints; guardrails. Padrão comum em fintech.

Azure OpenAI: HIPAA, SOC 2, ISO 27001; residência de dados na UE; o padrão para empresas regulamentadas.

Vertex: HIPAA, GDPR, residência de dados por região; stack de compliance do Google Cloud.

Os três atendem ao checkbox básico. As diferenças ficam em políticas de retenção de dados, como logs são tratados, e se o monitoramento de abuso leitura seu tráfego (opt-in padrão na maioria; opt-out disponível para enterprise).

### Números que você deve memorizar

- Azure OpenAI mediana de TTFT no Llama 3.1 405B equivalente: ~50 ms (com PTUs).
- Bedrock mediana TTFT sob demanda: ~75 ms.
- Bedrock Provisioned Throughput: $21-$50/hr por unidade.
- Break-even de PTU do Azure: ~40-60% de utilização sustentada.
- Economia de PTU vs sob demanda em alta utilização: até 70%.

## Use

`code/main.py` compara as três plataformas em um workload sintético — modela economia sob demanda vs PTU, variância de TTFT e fidelidade de atribuição de custo. Execute para ver onde PTUs pagam e onde a amplitude do catálogo do marketplace supera um gap de TTFT.

## Entregue

Esta aula produz `outputs/skill-managed-platform-picker.md`. Dado um perfil de workload (modelos necessários, SLA de TTFT, volume diário, requisitos de compliance), recomenda uma plataforma principal, uma de fallback e um plano de instrumentação de FinOps.

## Exercícios

1. Execute `code/main.py`. Em que utilização sustentada a PTU do Azure vence sob demanda para um modelo de classe 70B? Calcule o break-even e compare com a faixa divulgada de 40-60%.
2. Seu produto precisa de Claude 3.7 Sonnet e GPT-4o. Projete um deployment de dois provedores — qual vai para qual hiperscaler, qual gateway fica na frente, qual é a política de failover?
3. Um cliente regulamentado em saúde precisa de BAAs, residência de dados em US-East e TTFT P99 abaixo de 100ms. Escolha uma plataforma e justifique com três funcionalidades específicas.
4. Você descobre que sua conta do Bedrock subiu 4x este mês sem mudança de tráfego. Sem Application Inference Profiles, como você encontraria o culpado? Com profiles, quanto tempo levaria?
5. Leia as páginas de preços do Azure OpenAI e do Bedrock. Para um workload de Claude de 100M tokens/mês, qual é mais barato — API direta da Anthropic, Bedrock sob demanda ou Bedrock Provisioned Throughput?

## Termos Chave

| Termo | O que as pessoas dizem | O que realmente significa |
|-------|----------------------|--------------------------|
| Bedrock | "serviço de LLM da AWS" | Marketplace de modelos incluindo Claude, Llama, Titan, Mistral, Cohere |
| Azure OpenAI | "ChatGPT da Azure" | Modelos exclusivos da OpenAI em datacenters Azure com controles empresariais |
| Vertex AI | "LLM do Google" | Plataforma Gemini-first com Model Garden para modelos de terceiros |
| PTU | "capacidade dedicada" | Provisioned Throughput Unit — GPUs de inferência reservadas, preço por hora |
| Application Inference Profile | "tagging do Bedrock" | Profile de custo/uso por produto com tags, nativo do CloudWatch |
| Model Garden | "catálogo do Vertex" | Seção de terceiros do Vertex AI, separada do Gemini |
| Mínimo dois provedores | "redundância de LLM" | Política de rodar cada camada crítica de LLM em ≥2 hiperscalers |
| BAA | "papelada do HIPAA" | Business Associate Agreement; obrigatório para PHI; fornecido pelos três |
| Monitoramento de abuso | "o observador de logs" | Scan de segurança no lado do provedor em prompts/saídas; opt-out em enterprise |

## Leitura Complementar

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) — tabela de preços oficial e preços de Provisioned Throughput.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/cognitive-services/openai-service/) — economia de PTU e tabelas de preços.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) — tiers do Gemini e sobretaxas do Model Garden.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) — benchmarks contínuos de latência e throughput entre provedores.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) — framework de decisão empresarial.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) — mecânica de atribuição lado a lado.
