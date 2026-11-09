# Capstone 15  Arnés de seguridad constitucional + Rango de equipo rojo

> Los clasificadores constitucionales de Anthropic, Meta's Llama Guard 4, Google's ShieldGemma-2, NVIDIA's Nemotron 3 Content Safety, y X-Guard para la cobertura multilingüe definían la pila de clasificadores de seguridad de 2026. Garak, PyRIT, NVIDIA Aegis y promptfoo se convirtieron en las herramientas estándar de evaluación adversaria. NeMo Guardrails v0.12 los une a una línea de producción. Esta piedra angular conecta todo esto: un arnés de seguridad en capas alrededor de una aplicación objetivo, un agente autónomo del equipo rojo que dirige más de 6 familias de ataque, y una carrera constitucional de autocrítica que produce un delta de inofensividad medible.

**Type:** Capstone
**Languages:** Python (safety pipeline, red team), TypeScript, YAML (policy configs)
**Prerequisites:** Phase 10 (LLMs from scratch), Phase 11 (LLM engineering), Phase 13 (tools), Phase 14 (agents), Phase 18 (ethics, safety, alignment)
**Phases exercised:**P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## El problema

La frontera de la seguridad de LLM en 2026 no es si los clasificadores funcionan (lo hacen, aproximadamente) sino cómo componerlos correctamente alrededor de una aplicación de producción sin rechazar demasiado o dejar agujeros obvios. La Guardia de Llama 4 maneja las violaciones de las políticas inglesas. X-Guard (132 idiomas) maneja jailbreak multilingüe. ShieldGemma-2 capta la inyección rápida basada en imágenes. NVIDIA Nemotron 3 Seguridad del contenido cubre categorías de empresas. Los clasificadores constitucionales de Anthropic son un enfoque separado utilizado durante el entrenamiento en lugar de servir.

El sistema de control de datos de seguridad (PAIR) y el sistema de control de datos (TAP) automatiza el descubrimiento de jailbreak. GCG ejecuta ataques de sufijo basados en gradientes. Los ataques de múltiples giros y conmutadores de código explotan la memoria del agente.

Harda una aplicación objetivo (ya sea un modelo 8B ajustado a instrucciones o uno de los chatbots RAG de otras capstone), ejecuta 6+ familias de ataque contra ella, y produce una medición de inocuidad antes / después.

## Concepto

La tubería de seguridad es de cinco capas.**Input sanitize**: desprender los caracteres de ancho cero, decodificar base64/rot13, normalizar Unicode. **Policy layer**: NeMo Guardrails v0.12 rails (fuera del dominio, toxicidad, extracción de PII). **Classifier gate**: Llama Guard 4 en entrada, X-Guard en no inglés, ShieldGemma-2 en entrada de imagen. **Model**: el LLM objetivo. **Output filter**: Llama Guard 4 en salida, Presidio PII scrub, ejecución de citación cuando corresponda. **HITL tier**: las salidas marcadas con alto riesgo van a una cola Slack.

El rango de equipo rojo se ejecuta en un cronómetro. PAIR y TAP descubren jailbreaks de forma autónoma. GCG ejecuta ataques de sufijo basados en gradientes. ASCII / base64 / rot13 codificación de ataques. Ataques de múltiples vueltas (adopción de persona, explotación de memoria). Ataques de código-conmutador (mix inglés con swahili o tailandés). Cada ejecución produce un archivo de hallazgos estructurado con puntuación CVSS y línea de tiempo de divulgación.

La carrera de autocrítica constitucional es una intervención de tiempo de entrenamiento. Tome 1k de instrucciones de intento de daño, haga que el modelo redacte una respuesta, la critique contra una constitución escrita (reglas de no dañar) y retrén en el ciclo de crítica.

## Arquitectura

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## El establo

- Clasificadores de seguridad: Llama Guard 4, ShieldGemma-2, NVIDIA Nemotron 3 Seguridad del contenido, X-Guard
- Marco de barandillas de seguridad: NeMo Guardrails v0.12 + OPA
- Los controladores de equipo rojo: garak (NVIDIA), PyRIT (Microsoft Azure), NVIDIA Aegis, promptfoo
- Los agentes de escape de cárcel: PAIR (Chao et al., 2023), Árbol de ataques (TAP), sufijo GCG
- Formación constitucional: ciclo de autocrítica de estilo antropológico + SFT en críticas
- El nombre de la persona que se encuentra en el centro de la ciudad
- Objetivo: un modelo 8B ajustado a instrucciones o uno de los otros chatbots RAG de las capstone

```figure
cf-safety-stack
```

## Construye el mismo

1. **Target setup.**Establezca un modelo 8B ajustado a instrucciones en vLLM (o reutilice un chatbot RAG de otro capstone). Esta es la aplicación en prueba.

2. **Safety pipeline wrap.**En el caso de las líneas de cable de cinco capas alrededor del objetivo, compruebe si cada capa es observable individualmente (espan por capa en Langfuse).

3. **Classifier coverage.**Carga Llama Guard 4, X-Guard (multilingüe), ShieldGemma-2 (imagen). ejecuta cada uno en un conjunto pequeño etiquetado para establecer líneas de base.

4. **Red-team scheduler.**Agrupa a Garak, PyRIT, un agente PAIR, un agente TAP, un corredor GCG, un atacante multi-turn y un atacante de código-switch.

5. **Attack suite.**Seis familias de ataques: (1) PAIR jailbreak automático, (2) TAP árbol de ataques, (3) sufijo de gradiente GCG, (4) codificación ASCII / base64 / rot13, (5) persona de varios giros, (6) código multilingüe.

6. **Constitutional self-critique.**Curat 1k de las solicitudes de intento de daño. Para cada uno, el objetivo elabora una respuesta. Un LLM crítico obtiene puntuaciones en contra de una constitución escrita ("no dañar, " " " citar evidencia, " " rechazar solicitudes ilegales ").

7. **Over-refusal measurement.**Rastrear la tasa de falsos positivos en una suite de preguntas benignas (por ejemplo, XSTest).

8. **CVSS scoring.**Para cada jailbreak exitoso, califique CVSS 4.0 (vector de ataque, complejidad, impacto).

9. **Range automation.**Todo lo anterior se ejecuta en un cron; los hallazgos escriben a una cola; la regresión de rechazo excesivo alerta fuego a Slack.

## Usalo

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## Envío

`outputs/skill-safety-harness.md`Es el producto entregado. Un conducto de seguridad en capas de producción más un rango de equipo rojo reproducible con delta de inocuidad antes/después.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Attack-surface coverage | 6+ attack families exercised, 2+ languages |
| 20 | True-positive / false-positive trade-off | Attack block rate vs XSTest benign pass rate |
| 20 | Self-critique delta | Before/after harmlessness on held-out eval |
| 20 | Documentation and disclosure | CVSS-scored findings with timeline |
| 15 | Automation and repeatability | Everything runs on cron with alerts |
| **100** | | |

## Los ejercicios

1. Ejecute el plugin de garak para inyección rápida en un chatbot RAG y compare la tasa de éxito del ataque con y sin la capa de filtro de salida.

2. Añadir una séptima familia de ataques: inyección indirecta rápida a través de documentos recuperados.

3. Implementar un modo de "rechazo con ayuda": cuando el barril de seguridad se bloquea, el objetivo ofrece una respuesta relacionada más segura en lugar de una negativa plana.

4. La brecha de cobertura multilingüe: encontrar un idioma en el que X-Guard no tiene un buen rendimiento. Proponer un conjunto de datos de ajuste fino dirigido a él.

5. Ejecutar la autocrítica constitucional en un modelo 30B y medir si el delta escala.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Layered safety | "Defense in depth" | Multiple guardrails at input, gate, output, HITL |
| Llama Guard 4 | "Meta's safety classifier" | The 2026 reference input/output content classifier |
| PAIR | "Jailbreak agent" | Paper (Chao et al.) on LLM-driven jailbreak discovery |
| TAP | "Tree-of-Attacks" | Tree-search variant of PAIR |
| GCG | "Greedy coordinate gradient" | Gradient-based adversarial suffix attack |
| Constitutional self-critique | "Anthropic-style training" | Target drafts -> critic scores -> rewrite -> retrain |
| XSTest | "Benign probe set" | Benchmark for over-refusal regression |
| CVSS 4.0 | "Severity score" | Standard vulnerability scoring for safety findings |

## Leer más

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) Referencia del tiempo de formación
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) el clasificador de entrada/salida de 2026
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) seguridad de imagen + multimodal
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) Referencia de la empresa
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) Seguridad multilingüe en 132 idiomas
- [garak](https://github.com/NVIDIA/garak) NVIDIA red-team kit de herramientas
- [PyRIT](https://github.com/Azure/PyRIT) Microsoft red-team framework
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) marco ferroviario
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) papel de agente de escape de cárcel
