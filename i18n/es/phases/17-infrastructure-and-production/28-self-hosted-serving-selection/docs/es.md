# Selección de servidores auto-hospedados  Motor de ajuste a hardware y escala

> La selección del motor es una función del hardware, la escala y el ecosistema  no una lectura de la tabla de clasificación. Cuatro motores dominan la inferencia auto-hosted en 2026: llama.cpp, Ollama, vLLM, SGLang, con TGI retrasando en el modo de mantenimiento. **llama.cpp**es más rápido en CPU  más amplio soporte de modelo, control total sobre cuantización y threading. **Ollama**es la instalación de un solo comando de dev-laptop, ~15-30% más lenta que llama.cpp (serialización Go + CGo + HTTP), 3x de la brecha de rendimiento bajo carga similar a la de prod. **TGI entered maintenance mode December 11, 2025** sólo corregir errores, ~10% más lento rendimiento bruto que vLLM pero históricamente superior observabilidad e integración de ecosistemas HF. Ese estado de mantenimiento lo convierte en una apuesta a largo plazo arriesgada  SGLang o vLLM son valores predeterminados más seguros para nuevos proyectos. **vLLM**es el estándar de producción general  v0.15.1 (febrero 2026) añade PyTorch 2.10, RTX Blackwell SM120, H200 optimización. **SGLang**es el especialista en múltiples giros / prefijos agenciales pesados  400,000+ GPUs en producción (xAI, LinkedIn, Cursor, Oracle, GCP, Azure, AWS). Constrangimientos de hardware: CPU-first → llama.cpp. AMD / no NVIDIA → vLLM es el camino más fuerte (TRT-LLM está bloqueado por NVIDIA). 2026 patrón de tubería: dev = Ollama, en fase = llama.cpp, prod = vLLM o SGLang. Los motores toman diferentes formatos de peso  GGUF para la familia llama.cpp, HF safetensores para los motores GPU  por lo que una conversión de formato puede sentarse entre etapas.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, engine-decision tree walker)
**Prerequisites:** All Phase 17 lessons covering engines (04, 06, 07, 09, 18)
**Time:** ~45 minutes

## Objetivos de aprendizaje

- Seleccione un motor dado hardware (CPU / AMD / NVIDIA Hopper / Blackwell), escala (1 usuario / 100 / 10,000), y carga de trabajo (talla general / agente / contexto largo).
- Nombre del estado de modo de mantenimiento TGI 2026 (11 de diciembre de 2025) y por qué desvia nuevos proyectos hacia vLLM o SGLang.
- Describa la línea de desarrollo/estacionamiento/producción, incluida la conversión de formato GGUF a safetensores entre etapas.
- Explica por qué "CPU-first" apunta a llama.cpp y "AMD" excluye TRT-LLM.

## El problema

Su equipo inicia un nuevo proyecto de LLM auto-organizado. Un ingeniero dice Ollama, otro dice vLLM, un tercero dice "¿no funciona TGI simplemente fuera de la caja?" Los tres son adecuados para diferentes contextos. Ninguno es adecuado para todos.

En 2026 el árbol de elección importa: hardware primero, escala segunda, carga de trabajo tercera. Y un evento específico de 2025  TGI ingresando al modo de mantenimiento el 11 de diciembre  cambia el predeterminado para nuevos proyectos.

## El concepto

### Los cinco motores

| Engine | Best for | Notes |
|--------|----------|-------|
| **llama.cpp** | CPU / edge / minimal deps / widest model support | Fastest on CPU, full control |
| **Ollama** | Dev laptops, single user, one-command install | 15-30% slower than llama.cpp; 3x prod throughput gap |
| **TGI** | HF ecosystem, regulated industries | **Maintenance mode Dec 11, 2025** |
| **vLLM** | General-purpose production, 100+ users | Broad production default; v0.15.1 Feb 2026 |
| **SGLang** | Agentic multi-turn, prefix-heavy workloads | 400,000+ GPUs in production |

### La primera decisión sobre el hardware

**CPU-first**Ollama también funciona pero es más lento. Ningún otro motor es competitivo en CPU.

**AMD GPU**→ vLLM es el camino más fuerte (soporte de ROCm de AMD). SGLang también funciona. TRT-LLM está bloqueado por NVIDIA, por lo que está fuera.

**NVIDIA Hopper (H100 / H200)**→ VLLM o SGLang o TRT-LLM. Los tres de primer nivel.

**NVIDIA Blackwell (B200 / GB200)**→ TRT-LLM es el líder de rendimiento (Fase 17 · 07). vLLM y SGLang siguen de cerca.

**Apple Silicon (M-series)**Ollama envuelve esto.

### Decisión de segunda escala

**1 user / local dev**Una orden, la primera señal en segundos.

**10-100 users / small team**→ VLLM de un solo GPU.

**100-10k users / production**→ vLLM producción-estaca (fase 17 · 18) o SGLang.

**10k+ users / enterprise**→ vLLM producción-pillar + desagregado (fase 17 · 17) + LMCache (fase 17 · 18).

### Encuesta de trabajo-tercera decisión

**General chat / Q&A**→ vLLM gana en el default general.

**Agentic multi-turn (tools, planning, memory)**→ La atención radix de SGLang (fase 17 · 06) es la dominante.

**RAG with heavy prefix reuse**→ SGLang.

**Code generation**→ VLLM bien; SGLang ligeramente mejor en la caché.

**Long context (128K+)**→ VLLM + preempleo en pedazos; SGLang + KV en capas.

### La trampa de mantenimiento TGI

Hugging Face TGI entró en modo de mantenimiento el 11 de diciembre de 2025  solo se corrigen errores en el futuro. Históricamente: observabilidad de primer nivel, mejor integración de ecosistema HF (tarjetas de modelo, herramientas de seguridad), ligeramente detrás de vLLM en rendimiento bruto.

Para nuevos proyectos en 2026: por defecto, no se aplica TGI. Las implementaciones existentes de TGI pueden continuar pero eventualmente deberían migrar.

### El patrón de la tubería

Dev (Ollama) → staging (llama.cpp) → prod (vLLM). Los motores toman diferentes formatos de peso  GGUF para la familia llama.cpp, HF safetensors para los motores GPU  para que una conversión de formato pueda estar entre etapas. Los ingenieros iterian rápidamente en computadoras portátiles; el espejo de etapa cuantiza la producción; prod es el objetivo de servicio.

### Aviso de Ollama

Ollama es ideal para el desarrollo. No es ideal para la producción compartida: la serialización HTTP Go añade gastos generales, la gestión de concurrencia es más simple que vLLM, OpenTelemetry soporte lags. Utilice Ollama donde brilla  un usuario, un comando  y cambiar a vLLM para compartir.

### Auto-hosted vs. administrado es una decisión separada

Fase 17 · 01 (hiperscalers administrados), · 02 (plataformas de inferencia) cubierta gestionada. Esta lección asume que ya ha decidido auto-host. Razones para auto-host: residencia de datos, ajuste a medida, propiedad total de costos a escala, modelo de dominio no disponible en alojado.

### Números que debes recordar

- Modo de mantenimiento TGI: 11 de diciembre de 2025.
- vLLM v0.15.1: febrero 2026; PyTorch 2.10; soporte para Blackwell SM120.
- Impresión de producción de SGLang: 400.000+ GPUs.
- La brecha de rendimiento de Ollama vs llama.cpp: 15-30% más lenta; 3 veces menos de la carga de la prolongación.

```figure
data-parallel
```

## Usalo

`code/main.py`es un caminante del árbol de decisión: dado hardware + escala + carga de trabajo, elige un motor y explica por qué.

## Envío

Esta lección produce`outputs/skill-engine-picker.md`Ante las limitaciones, elige un motor y escribe el plan de migración.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`¿La salida coincide con su intuición?
2. Tu infra es de 12 H100 y 8 MI300X AMD. ¿Qué motor? ¿Por qué está TRT-LLM fuera de la mesa?
3. Un equipo quiere usar TGI en 2026 porque "es lo que sabemos".
4. Ollama dev a vLLM prod: ¿qué cambios en la cuantización, configuración y observabilidad?
5. Producto RAG con longitud de prefijo P99 8K y alta reutilización entre los inquilinos.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| llama.cpp | "the CPU one" | Widest model support, fastest on CPU |
| Ollama | "the laptop one" | One-command install, dev-grade throughput |
| TGI | "HF's serving" | Maintenance mode since Dec 2025 |
| vLLM | "the default" | Broad production baseline 2026 |
| SGLang | "the agentic one" | Prefix-heavy, RadixAttention |
| TRT-LLM | "NVIDIA-locked" | Blackwell throughput leader, NVIDIA only |
| GGUF | "llama.cpp format" | Bundled K-quant variants |
| Production-stack | "vLLM K8s" | Phase 17 · 18 reference deployment |
| Pipeline pattern | "dev→stage→prod" | Ollama → llama.cpp → vLLM; weight formats differ per engine |

## Leer más

- [AI Made Tools — vLLM vs Ollama vs llama.cpp vs TGI 2026](https://www.aimadetools.com/blog/vllm-vs-ollama-vs-llamacpp-vs-tgi/)
- [Morph — llama.cpp vs Ollama 2026](https://www.morphllm.com/comparisons/llama-cpp-vs-ollama)
- [n1n.ai — Comprehensive LLM Inference Engine Comparison](https://explore.n1n.ai/blog/llm-inference-engine-comparison-vllm-tgi-tensorrt-sglang-2026-03-13)
- [PremAI — 10 Best vLLM Alternatives 2026](https://blog.premai.io/10-best-vllm-alternatives-for-llm-inference-in-production-2026/)
- [TGI maintenance announcement](https://github.com/huggingface/text-generation-inference) notas de liberación.
- [vLLM v0.15.1 release notes](https://github.com/vllm-project/vllm/releases)
