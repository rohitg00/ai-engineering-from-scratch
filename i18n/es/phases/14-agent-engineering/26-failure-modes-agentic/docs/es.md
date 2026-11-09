# Modos de fracaso: por qué los agentes rompen

> MASFT (Berkeley, 2025) cataloga 14 modos de falla multi-agente en 3 categorías. La taxonomía de Microsoft documenta cómo los fallos existentes de IA se amplifican en configuraciones agenciales. Los datos del campo de la industria convergen en cinco modos recurrentes: acciones alucinadas, deslizamiento de alcance, errores en cascada, pérdida de contexto, uso indebido de herramientas.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Nombre de las tres categorías de fallos de MASFT y al menos cuatro modos específicos en cada una.
- Explica por qué el fracaso agente amplifica los modos de fracaso de IA existentes (bias, alucinaciones).
- Describa los cinco modos recurrentes en la industria y sus mitigantes.
- Implemente un detector stdlib que etiqueta el agente de rastreo con etiquetas de modo de falla.

## El problema

Los equipos envían agentes que trabajan en el 90% de las huellas. Los 10% de fallas no son ruido aleatorio  caen en un pequeño número de categorías recurrentes. Una vez que se puede nombrarlos, se puede monitorear para ellos y arreglarlos.

## El concepto

### MASFT (Berkeley, arXiv:2503.13657)

Taxonomía de fallas de sistemas de múltiples agentes. 14 modos de fallas agrupados en 3 categorías.

El argumento central: los fallos son fallos fundamentales en el diseño de los sistemas multiagentes, no las limitaciones de la MLL que deben ser fijadas con mejores modelos básicos.

### Taconomía de Microsoft del modo de falla en los sistemas de IA agenciales

- Los fallos existentes de la IA (bias, alucinaciones, filtración de datos) se amplifican en entornos agentes.
- Nuevos fracasos surgen de la autonomía: acción no deseada a escala, mal uso de herramientas, deriva de misión.
- El documento blanco es el registro de riesgos de los productos agentes.

### Caracterizando las fallas en la IA agencial (arXiv:2603.06847)

- Los fracasos surgen de la orquestación, la evolución del estado interno y la interacción del medio ambiente.
- No sólo "mal código" o "mala salida de modelo".

### Encuesta de alucinaciones de agentes de LLM (arXiv:2509.18970)

Dos manifestaciones primarias:

1. **Instruction-following Deviation**El agente no sigue la señal del sistema.
2. **Long-range Contextual Misuse** el agente olvida o aplica incorrectamente el contexto de los turnos anteriores.

Errores de subintención: omisión (paso perdido), redundancia (paso repetido), desorden (pasos fuera de orden).

### Los cinco modos recurrentes en la industria

Los análisis de campo de Arize, Galileo, NimbleBrain 2024-2026 convergen en:

1. **Hallucinated actions.**El agente invoca una herramienta que no existe o fabrica argumentos.
2. **Scope creep.**El agente expande la tarea más allá de lo que el usuario pide (crea relaciones públicas adicionales, envía correos electrónicos adicionales).
3. **Cascading errors.**Una llamada errónea desencadena efectos en el flujo posterior. Una alucinación fantasma SKU desencadena cuatro llamadas API  un incidente de múltiples sistemas.
4. **Context loss.**Las tareas de largo horizonte olvidan las restricciones de turno temprano.
5. **Tool misuse.**Llama a la herramienta correcta con argumentos equivocados, o la herramienta equivocada por completo.

Los agentes no pueden distinguir "no he podido" de "la tarea es imposible" y a menudo alucinan un mensaje de éxito en 400 errores para cerrar el bucle.

### Mitigación: puertas en cada paso

Puertas de verificación automáticas en cada paso de una cadena de razonamiento, comprobando la base de los hechos con respecto al estado ambiental.

- Clasificación de seguridad por paso (lección 21).
- Validación de los argumentos de llamada de herramienta (lección 06).
- Verificación de los contenidos recuperados con los hechos conocidos (lección 05, CRITA).
- Detectar alucinación de éxito mediante la revisión del estado (¿fue realmente creado el archivo?).

### Cuando el monitoreo de fallas sale mal

- **Tagging only crashes.**La mayoría de las fallas de los agentes producen una salida válida.
- **No baseline.**La detección de deriva necesita un último bien conocido; sin él no se puede decir "esto está empeorando".
- **Over-alerting.**Cada falla produce una página, un grupo y un límite de velocidad.

```figure
failure-cascade
```

## Construye el mismo

`code/main.py`Implementa un etiquetador de modo de falla stdlib:

- Un conjunto de datos de rastreo sintético que cubre los cinco modos.
- Funciones del detector por modo (patrones de firma en las llamadas de la herramienta, salidas, acciones repetidas).
- Un etiquetador que etiqueta cada rastro y informa la distribución de modo.

- ¿Qué quieres decir ?

```
python3 code/main.py
npx tsx code/main.ts
```

Producción: etiquetas por rastro + distribución agregada, una reproducción barata de lo que las superficies de agrupación de rastro de Phoenix.

## Usalo

- **Phoenix**para el agrupamiento de derivación de producción (lección 24).
- **Langfuse**para reproducción de sesión + anotación.
- **Custom**para firmas específicas de dominio que su plataforma de observabilidad no puede detectar.

## Envío

`outputs/skill-failure-detector.md`genera detectores de modo de falla adaptados a su dominio, conectados a una tienda de rastreo.

## Los ejercicios

1. Añadir un detector para "allucinación de éxito": el agente devuelve el éxito pero el estado objetivo no cambia.
2. Etiquetar 100 huellas reales de un producto que has construido. ¿Qué modo domina? ¿Cuál es el costo de arreglarlo?
3. Implementar una métrica de "radío de cascada": dada una falla en el paso N, ¿cuántos pasos aguas abajo afectó?
4. Lea los 14 modos de falla de MASFT, elige tres que se apliquen a su producto, escriba detectores.
5. Enviar un detector en un trabajo de CI: fallar la construcción si >=5% de las huellas etiquetan un modo.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 14-mode categorization |
| Cascading error | "Ripple failure" | One early mistake propagates through N steps |
| Context loss | "Forgot the constraint" | Long-horizon turn drops early-turn facts |
| Tool misuse | "Wrong tool / wrong args" | Valid call, wrong invocation |
| Success hallucination | "Faked completion" | Agent claims success on a 400; state unchanged |
| Scope creep | "Overreach" | Agent does more than asked |
| Instruction-following deviation | "Disobedience" | Ignores system prompt or user constraint |
| Sub-intention errors | "Plan bugs" | Omission, redundancy, disorder in plan execution |

## Leer más

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657) 14 modos de falla, 3 categorías
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf) Registro de riesgos
- [Arize Phoenix](https://docs.arize.com/phoenix) Clustering de deriva en la práctica
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents) cuando los patrones más simples evitan los modos por completo
