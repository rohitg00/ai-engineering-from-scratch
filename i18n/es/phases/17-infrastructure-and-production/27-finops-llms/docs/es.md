# FinOps para LLM  Economía unitaria y atribución de múltiples inquilinos

> Las operaciones de fin de curso tradicionales se rompen en el gasto de LLM. Los costos son transacciones de tokens, no tiempo de disponibilidad de recursos. Las etiquetas no mapean  una llamada de API es una transacción, no un activo. Las decisiones de ingeniería (diseño de la oportunidad, ventana de contexto, longitud de salida) son decisiones financieras.`user_id`) para el precio de los asientos y la ampliación, por tarea (`task_id`¿ Qué es eso ?`route`) para el coste y la prioridad de la superficie del producto, por inquilino (`tenant_id`) para la economía de unidad y la renovación. Cuatro capas de tokens  prompt, herramienta, memoria, respuesta  un cubo se oculta gastar. Escala de ejecución para los productos multi-arrendatarios: límites de tasas por arrendatario (2-3 veces el pico esperado, 429 + retraso después de la prueba); límite de gasto diario (1,5-3 veces el límite contraído; activa el aumento de tasas + alerta); interruptores de apagado en el gasto z-score > 4 (pausa automática + página en llamada). Modelos de atribución: etiquetado y agregado, telemetría combinadora (trace-ID → facturación; mayor precisión), muestreo y extrapolación, asignación basada en modelos, fuente de eventos, transmisión en tiempo real. Metrica unitaria: costo por consulta resuelta, costo por artefacto generado  no $/M tokens. El etiquetado retroactivo siempre falta; instrumento de creación a petición.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy cost-attribution simulator with kill switch)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Explica por qué las FinOps tradicionales (tags + tiers) rompen el gasto de LLM y nombra las tres nuevas dimensiones de atribución.
- Enumera las cuatro capas de tokens (prompt, herramienta, memoria, respuesta) y por qué la facturación de un solo cubo esconde el costo.
- Diseñar una escalera de aplicación (capacidad de gasto → interruptor de ejecución) para un producto multi-arrendatario.
- Elija una métrica unitaria (costo por consulta / artefacto resuelto) en lugar de tokens $ / M.

## El problema

Su cuenta dice $40,000.
- ¿Qué inquilino lo gastó?
- ¿Qué característica del producto lo impulsó?
- Si un usuario individual fue abusador.
- Ya sea que la hinchazón rápida, las llamadas de herramientas o la amplificación de la memoria fueran los culpables.

El etiquetado y agregado en el lado del proveedor funciona para los recursos en la nube (EC2, S3) donde las etiquetas se propagan a los elementos de línea. Las llamadas de LLM API no etiquetan automáticamente.

## El concepto

### Tres dimensiones de atribución

**Per-user**(El artículo`user_id`): quién cuesta qué. Implica el precio de los asientos, las conversaciones de expansión, identifica a los usuarios de energía.

**Per-task**(El artículo`task_id`¿ Qué es eso ?`route`): qué superficie de producto cuesta qué.

**Per-tenant**(El artículo`tenant_id`): qué cliente es rentable.

Instrumentos los tres en el lugar de llamada en el primer día.

### Cuatro capas de símbolo

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

Si juntas las cuatro, la optimización se ve ciega.

### Escala de ejecución

1. **Rate limit**Por inquilino. 2-3 veces el máximo esperado.`Retry-After`El inquilino ve fricción, no hay factura sorpresa.

2. **Daily spend cap**El límite de la tasa de restricción + alerta al éxito del cliente.

3. **Kill switch**en el gasto z-score > 4 en relación con la línea de base del inquilino.

### Modelos de atribución

- **Tag-and-aggregate**En el caso de los Estados miembros, el número de datos de la base de datos es de un tamaño muy reducido.
- **Telemetry joiner**La mayor precisión, los equipos maduros hacen.
- **Sampling + extrapolation**El precio de la muestra es de 5 a 10%, multiplicado.
- **Model-based allocation**Para los datos heredados sin etiquetas.
- **Event-sourced**El costo de la información en el tiempo real.
- **Real-time streaming**: actualizaciones del tablero de instrumentos subsegundo.

### El costo por X es la métrica unitaria

Los tokens $/M son el habla del proveedor.

- Costo por boleto de apoyo resuelto.
- Costo por artículo generado.
- Costo por tarea exitosa del agente.
- Costo por sesión de usuario-minuto.

En el caso de los productos, el coste de la optimización no es garantizado.

### Forma de rastreo de la atribución de costes

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

Emite en cada llamada. Almacenar en el lago de datos. Agregado por dimensión. fase 17 · 13 observabilidad pila es donde vive este.

### El conjunto de ahorros compuestos

Stack: caché + lote + ruta + puerta de entrada.
- Cache L2 (fase 17 · 14): ~ 10 veces más barato.
- Batch (fase 17 · 15): descuento del 50%.
- Ruta al modelo barato (fase 17 · 16): reducción de costes del 60%.
- Eficiencia de la puerta de entrada (fase 17 · 19): redundancia + retrasos.

En el mejor de los casos, entre el 5 y el 10% de la base de ingenuidad.

### Números que debes recordar

- Dimensiones de atribución: por usuario, por tarea, por inquilino.
- Cuatro capas de símbolo: prompt, herramienta, memoria, respuesta.
- El interruptor de eliminación: gastar z-score > 4.
- Metrica unitaria: costo por consulta resuelta, no tokens $/M.
- Optimizaciones apiladas: ~ 5-10% de la línea de base posible.

```figure
i4-spend-ladder
```

## Usalo

`code/main.py`simula un servicio de LLM multi-arrendatario con la escalera de ejecución de tres niveles. Inyecta a un arrendatario abusivo y demuestra el disparo del interruptor de muerte.

## Envío

Esta lección produce`outputs/skill-finops-plan.md`.Dado el producto y la escala, diseña el esquema de atribución y la escalera de ejecución.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿A qué punto dispara el interruptor de muerte?
2. Diseñar un panel de costos por inquilino, por tarea. ¿Cuáles son las 5 vistas que construye primero?
3. Su inquilino más grande es unidad-economía-negativo. Propón tres intervenciones ordenadas por impacto del cliente.
4. Calcule el costo por boleto resuelto para un producto de soporte: 3M tokens/ticket, ~800 boletos/día, todas las entradas a la tasa caché de GPT-5 de $0.125/M (precio de lista de lanzamiento; compruebe la tarjeta de tarifa en vivo).
5. Discutir si el etiquetado retroactivo puede funcionar alguna vez. ¿Cuándo es aceptable?

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Per-user attribution | "user-level cost" | `user_id` stamped on every call |
| Per-task attribution | "feature cost" | `task_id` + `route` identify product surface |
| Per-tenant attribution | "customer cost" | `tenant_id`; drives unit economics |
| Four token layers | "cost layers" | prompt + tool + memory + response |
| Rate limit | "429 guard" | Per-tenant ceiling enforced at gateway |
| Daily spend cap | "daily ceiling" | Tenant-scoped budget with alert |
| Kill switch | "auto-pause" | Spend z-score > 4 triggers auto-suspension |
| Cost per resolved | "product unit metric" | Cost tied to product outcome, not tokens |
| Telemetry joiner | "trace-to-billing" | Highest-accuracy attribution pattern |
| Stacked optimization | "cache+batch+route+gateway" | Compounding savings to ~5-10% baseline |

## Leer más

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
