# Plataformas de LLM administradas  Bedrock, Vertex AI, Azure OpenAI

> Tres hiperescaladoras, tres estrategias distintas. AWS Bedrock es un mercado modelo  Claude, Llama, Titan, Estabilidad, Cohere detrás de una API. Azure OpenAI es una asociación exclusiva de OpenAI más unidades de rendimiento provistas (PTU) para capacidad dedicada. Vertex AI es Gemini primero con la mejor historia de largo contexto y multimodal. En 2026 el análisis artificial mide Azure OpenAI a ~ 50 ms mediana y Bedrock a ~ 75 ms en Llama 3.1 405B equivalentes  PTUs explican la brecha porque la capacidad dedicada supera la compartida a pedido. La regla de decisión no es "cuál es el más rápido" sino "cuál es el catálogo de modelos y la superficie de FinOps que coincide con mi producto". Esta lección te enseña a elegir con las compensaciones escritas, no con vibraciones.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-and-latency comparator)
**Prerequisites:** Phase 11 (LLM Engineering), Phase 13 (Tools & Protocols)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre las tres estrategias de plataforma (mercado vs exclusivo vs Gemini-primero) y coincida cada una con un caso de uso del producto.
- Explica qué unidades de rendimiento proporcionadas (PTU) te compran en Azure OpenAI y por qué Bedrock a pedido suele leer ~ 25 ms más lento en la escala 405B.
- Diagrama la superficie de atribución FinOps para cada plataforma (Profiles de Inferencia de Aplicaciones Bedrock vs Profiles de Inferencia Vertex por equipo vs Áreas de alcance de Azure + Reservas de PTU).
- Escriba una política de "mínimo de dos proveedores" y explique por qué el bloqueo de un solo proveedor es el error caro en 2026.

## El problema

Usted eligió Claude 3.7 Sonnet para su producto. Ahora necesita para servirlo. Puede llamar a la API de Antropic directamente, o puede llamarlo a través de AWS Bedrock, o puede pasar a través de una puerta de entrada. La API directa es la más simple; Bedrock añade BAAs, puntos finales VPC, IAM y CloudWatch atribución. La puerta de entrada añade failover, facturación unificada y límites de tasas entre los proveedores.

La pregunta más profunda es el catálogo. Si necesitas a Claude y Llama y Gemini en el mismo producto, no puedes comprarlos todos desde un solo lugar a menos que ese lugar sea Bedrock más Vertex más Azure OpenAI simultáneamente.

Esta lección muestra las tres apuestas, la brecha de latencia, la brecha de FinOps y el riesgo de bloqueo.

## El concepto

### Tres estrategias

**AWS Bedrock**La empresa de software de Bedrock está trabajando en la creación de un nuevo sistema de control de datos de la red de datos de la red de Internet.

**Azure OpenAI** la asociación exclusiva. Obtiene GPT-4 / 4o / 5 / o serie, DALL·E, Whisper y ajuste fino de los modelos OpenAI en los centros de datos de Azure. No hay modelos no OpenAI en el catálogo "Azure OpenAI Service"  esos van a Azure AI Foundry (producto separado).

**Vertex AI** Gemini primero, todo lo demás segundo. Gemini 1.5 / 2.0 / 2.5 Flash y Pro, más Model Garden (tercer).

### Diferencias de latencia en la escala

El análisis artificial tiene un índice de referencia continuo. En implementaciones equivalentes de Llama 3.1 405B, la latencia mediana de primer token de Azure es de alrededor de 50 ms con PTU; Bedrock en la demanda compartida es de alrededor de 75 ms. La brecha no es un fallo de AWS  es una diferencia de modelo de capacidad. Azure vende PTUs (Unidades de Despliegue Provisionadas), que reservan la capacidad de GPU para su inquilino. El equivalente de Bedrock (Provisioned Throughput) existe, pero comienza alrededor de $21/hora por unidad, y la mayoría de los clientes se quedan en el uso compartido a pedido.

La capacidad compartida a pedido compite con el tráfico de todos los demás clientes. La capacidad dedicada no. Si el TTFT de su producto es < 100 ms en P99, compra PTUs en Azure, compra Bedrock Provisioned Throughput o acepta la variación predeterminada.

### Economía del rendimiento de suministro

Azure PTUs: un bloque reservado de cálculo de inferencia. Hasta ~70% de ahorro frente a la demanda para cargas de trabajo predecibles. Coste fijo por hora independientemente del tráfico  usted paga por la reserva incluso cuando está inactivo. El equilibrio de ruptura es generalmente alrededor de 40-60% de utilización sostenida.

Capacidad de transmisión de la cama: $21-$50 por hora dependiendo del modelo y la región. matemática similar  equilibrio de ruptura es alrededor de la mitad de la utilización máxima.

La capacidad de suministro de Vertex se vende por SKU Gemini; los precios varían según el modelo y la región y se publicitan menos públicamente.

### Superficie de FinOps  el diferenciador real

**Bedrock Application Inference Profiles**Es la atribución más limpia del mercado.`team`¿ Qué ?`product`¿ Qué ?`feature`• redirige todas las invocaciones de modelos a través de él; CloudWatch rompe el costo por perfil sin procesamiento posterior.

**Vertex**La atribución es proyecto por equipo más etiquetas en todas partes. Modela cada equipo como un proyecto GCP, coloca etiquetas en cada recurso, y utiliza BigQuery Billing Export + DataStudio para los rollups. Más trabajo, pero BigQuery le da SQL arbitrario en los datos de costos.

**Azure**Las etiquetas se heredan de grupos de recursos, no de solicitudes, por lo que la atribución por solicitud requiere métricas personalizadas de Application Insights o una puerta de enlace que sella los encabezados.

El patrón: Bedrock es nativo más limpio, Vertex es más flexible a través de BigQuery, Azure es más opaco a menos que usted instrumento.

### El bloqueo es el riesgo de 2026

El compromiso de un solo hiperescalado estaba bien cuando un modelo dominaba. En 2026 la frontera se mueve mensualmente  Claude 3.7 un trimestre, Gemini 2.5 el siguiente, GPT-5 el trimestre después.

Los equipos de trabajo del patrón adoptan: dos proveedores mínimos para cualquier llamada de LLM crítica al producto. Bedrock más Azure OpenAI es el par común  Claude de uno, GPT de otro, fallo entre ellos, la misma puerta de enlace. El aumento de costos es insignificante porque las rutas de la puerta de enlace son óptimas; el aumento de disponibilidad durante los apagones (como el incidente de Azure OpenAI de enero de 2025, el apagón de AWS us-east-1) es decisivo.

### Residencia de datos, BAAs y industrias reguladas

Bedrock: BAAs en la mayoría de las regiones; puntos finales de VPC; barandillas.
Azure OpenAI: HIPAA, SOC 2, ISO 27001; residencia de datos de la UE; el estándar regulado por la empresa.
Vertex: HIPAA, GDPR, residencia de datos por región; la pila de cumplimiento de Google Cloud.

Las diferencias son en las políticas de retención de datos, cómo se manejan los registros y si el monitoreo de abuso lee el tráfico (opt-in por defecto en la mayoría; opt-out disponible para las empresas).

### Números que debes recordar

- TTFT mediano de Azure OpenAI en equivalentes Llama 3.1 405B: ~ 50 ms (con PTU).
- Mediana de TTFT de cama bajo demanda: ~75 ms.
- Capacidad de transmisión de la cama: $21-$50/hora por unidad.
- Reto de equilibrio de las PTU de Azure: ~ 40-60% de utilización sostenida.
- Ahorro de PTU frente a la demanda en alta utilización: hasta el 70%.

```figure
i4-platform-lanes
```

## Usalo

`code/main.py`comparar las tres plataformas en una carga de trabajo sintética  modela la economía de demanda frente a PTU, la variación de TTFT y la fidelidad de la atribución de costos. ejecutarlo para ver dónde las PTUs dan sus frutos y dónde la amplitud del modelo del mercado supera a una brecha de TTFT.

## Envío

Esta lección produce`outputs/skill-managed-platform-picker.md`. Dado el perfil de la carga de trabajo (modelos necesarios, TTFT SLA, volumen diario, requisitos de cumplimiento), recomienda una plataforma primaria, una retroceso y un plan de instrumentación FinOps.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿En qué uso sostenido Azure PTU supera a la demanda para un modelo de clase 70B?
2. Su producto necesita Claude 3.7 Sonnet y GPT-4o. Diseñar un despliegue de dos proveedores que va a qué hiperescalador, qué puerta de entrada se encuentra delante, ¿cuál es la política de fallas?
3. Un cliente de atención médica regulada requiere BAAs, residencia de datos de EE.UU. Este, y sub-100ms P99 TTFT. Elija una plataforma y justifique con tres características específicas.
4. Descubre que su factura de Bedrock ha aumentado 4 veces este mes sin cambios en el tráfico. ¿Cómo encontraría al culpable sin los perfiles de aplicación?
5. Para una carga de trabajo de 100M-token/mes Claude, que es más barato  API Antropic directa, Bedrock a pedido, o Bedrock Provisioned Throughput?

## Términos clave

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

## Leer más

- [AWS Bedrock Pricing](https://aws.amazon.com/bedrock/pricing/) tarjeta de tasa autorizada y precios de rendimiento provistos.
- [Azure OpenAI Service Pricing](https://azure.microsoft.com/en-us/pricing/details/azure-openai/) Economía y tarjetas de interés de la PTU.
- [Vertex AI Generative AI Pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing) Tías Gemini y recargos de jardín modelo.
- [Artificial Analysis LLM Leaderboard](https://artificialanalysis.ai/) índices de referencia de latencia y rendimiento continuos entre los proveedores.
- [The AI Journal — AWS Bedrock vs Azure OpenAI CTO Guide 2026](https://theaijournal.co/2026/03/aws-bedrock-vs-azure-openai/) marco de decisión empresarial.
- [Finout — Bedrock vs Vertex vs Azure FinOps](https://www.finout.io/blog/bedrock-vs.-vertex-vs.-azure-cognitive-a-finops-comparison-for-ai-spend) Mecánica de atribución lado a lado.
