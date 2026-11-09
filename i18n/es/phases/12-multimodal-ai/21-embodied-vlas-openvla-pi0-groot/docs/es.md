# VLAs incorporados: RT-2, OpenVLA, π0, GR00T

> La primera vez que un modelo leyó una receta de un sitio web y la ejecutó en un robot de cocina fue RT-2 (Google DeepMind, julio 2023). RT-2 discretizó las acciones como tokens de texto, co-finó un VLM en datos web más datos de acción de robots, y demostró que el conocimiento del lenguaje de visión a escala web se transfiere al control robótico. OpenVLA (junio 2024) envió la referencia abierta 7B. La serie π0 de la Inteligencia Física (2024-2025) añadió expertos en acción de coincidencia de flujo. El GR00T N1 de NVIDIA (marzo 2025) entregó control de doble sistema (Sistema 1 / Sistema 2) para robots humanoides a escala. El VLA primitivo  visión-linguego-acción, un solo modelo que ve, lee y actúa  es el puente entre los modelos de comprensión de esta fase y los sistemas autónomos en la Fase 15.

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton), TypeScript
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## Objetivos de aprendizaje

- Describa la tokenización de acciones: codificación discreta en bin (RT-2), tokens de acción eficientes FAST, acciones de coincidencia de flujo continua (π0).
- Explicar por qué la coordinación de datos en la web + robots preserva la transferencia de conocimientos generales a tareas nuevas.
- Comparar OpenVLA (abriendo 7B Llama+VLM), π0 (combinación de flujo) y GR00T N1 (sistema dual) en la misma tarea del robot.
- Nombre del conjunto de datos Open X-Embodiment y su papel como cuerpo de formación RT-X.

## El problema

Un robot que hace tareas a partir de instrucciones de lenguaje natural ha sido un objetivo de investigación desde la década de 1970. La respuesta de 2020: un modelo de acción de lenguaje de visión (VLA). La misma arquitectura de VLM utilizada para VQA, pero la salida son acciones (tornos conjuntos, poses de efecto final, comandos discretos) en lugar de texto.

Desafíos específicos de las VLA:

1. Los espacios de acción son continuos (ángulos conjuntos, fuerzas) y de alta dimensión (7 brazos DOF + agarre 3-DOF = 10 dimes a 30 Hz).
2. Los datos de entrenamiento específicos de los robots son escasos. Open X-Embodiment tiene ~ 1M trayectorias; imagen de texto web es 5B +.
3. La frecuencia de control es importante. El circuito de control de 30 Hz significa un presupuesto de 33 ms por acción.
4. Una acción incorrecta daña el hardware, los seres humanos o la propiedad.

## El concepto

### Tokenización de acciones (RT-2)

El truco de RT-2: representar cada objetivo conjunto como un token de texto cuantizado. Discrete el rango normalizado [-1, 1] en 256 contenedores, mapa cada contenedor a un ID de vocabulario. Una acción de 10 DOF se convierte en 10 tokens en cada paso de control.

Co-fine-tune un VLM PaLM-X en una mezcla:

- Parejas de imágenes web y texto (capcionado, VQA).
- Demonstraciones de robots, acción como tokens.

El modelo ve "recoger el cubo rojo" (lenguaje) → imagen (visión) → secuencia de acción de 10 tokens (objetivos conjuntos discretados). El entrenamiento previo a la web preserva la transferencia de conocimiento general: RT-2 puede seguir "moverse hacia el objeto en movimiento rápido" aunque "moverse rápido" no está en los datos de entrenamiento.

Inferencia a 3-5 Hz en el papel RT-2, limitada por el decodificación autorregresista VLM.

### OpenVLA  la referencia abierta 7B

OpenVLA (Kim et al., junio 2024) es el equivalente RT-2 de peso abierto. 7B Llama backbone, DINOv2 + SigLIP doble codificador de visión, tokenización de acción en 256 contenedores.

Entrenado en Open X-Embodiment (970k trayectorias en 22 robots).

Inferencia: 4-5 Hz en un A100 con cuantización. Lo suficientemente rápido para la manipulación lenta, no para el control de alta frecuencia.

### FAST tokenizer  más rápido de decodificación de la acción

Pertsch et al. (2024) mostró que la tokenización discreta bin es ineficiente  la mayoría de las acciones se agrupan en una pequeña región de espacio bin. FAST (Tokenizer de secuencia de acción en dominio de frecuencia) comprime las secuencias de acción a través de DCT y cuantifica los coeficientes.

Una trayectoria de acción de 30 pasos se convierte en ~ 10 tokens FAST en lugar de 300 tokens discretos.

### π0 y acciones de coincidencia de flujo

El π0 de la Inteligencia Física (Black et al., octubre 2024) reemplaza a los tokens de acción discretos con un experto en acción de coincidencia de flujo:

- Un pequeño transformador de acción lee los estados ocultos del VLM y emite una secuencia de acción continua de 50 pasos a través de un flujo rectificado.
- El tren de la cabeza de acción con pérdida de coincidencia de flujo; el VLM preentrenamiento permanece sin cambios.
- Inferencia: secuencia de acción completa emitida en ~5 pasos de denotación, control efectivo de 50 Hz.

La fórmula de acción continua conserva la suavidad que la discretization destruye.

π0.5 y π0-FAST son mejoras incrementales. π0-FAST combina la tokenización de FAST con la coincidencia de flujo.

### GR00T N1  Sistema dual para humanoides

El GR00T N1 de NVIDIA (marzo 2025) se construye para robots humanoides (> 30 DOF, cuerpo completo):

- Sistema 2: una gran escena de lectura + instrucción de VLM, que produce subobjetivos de alto nivel a ~ 1 Hz.
- Sistema 1: un pequeño transformador de cabeza de acción que produce comandos conjuntos de bajo nivel de 50-100 Hz condicionados a los subobjetivos.

Los mapas divididos para el pensamiento rápido y lento de Kahneman: los planes del sistema 2, el sistema 1 actúa.

GR00T N1.7 (finales 2025) mejora la escalación de datos. GR00T sintoniza con datos sim-to-real de Omniverse.

### Cuadro de la X abierto

Los datos de la capacitación. RT-X (octubre 2023) reunió 22 conjuntos de datos que cubren 1M trayectorias en 22 robots. Open X-Embodiment es el corpus que todos utilizan:

- ALOHA / Puente V2 / Droid / RT-2 Cocina / Mesa de idiomas.
- Cada muestra: (estado del robot, visualización de la cámara, instrucción, secuencia de acción).
- Higiene de entrenamiento: unificar el espacio de acción, normalizar los rangos articulares, cambiar el tamaño de las cámaras.

OpenVLA y π0 se entrenan en Open X-Embodiment. La brecha de dominio para cualquier robot específico se cierra mediante el ajuste fino de LoRA en 100-1000 demostraciones específicas de tareas.

### Co-ajuste fino vs solo robot

La co-ajuste de la calidad mezcla datos de VQA web con trayectorias de robots. La relación importa: demasiado VQA y el modelo olvida las acciones; demasiado datos de robots y el modelo pierde el conocimiento general.

Ratio de RT-2: ~1:1. OpenVLA: ~0.5:1 web-to-robot. π0: similar. La relación precisa es un hiperparámetro para sintonizar por tamaño de conjunto de datos.

El entrenamiento solo para robots produce modelos específicos de tareas que fallan en las instrucciones fuera de distribución. La co-finación es la diferencia entre "recoger el cubo rojo (en demostración) " y "recoger el tercer objeto más grande desde la izquierda (fraseo novedoso). "

### Limitos de seguridad y acción

Cada VLA de producción se embarca con:

- Los límites de articulación dura (no pueden superar el par de especificación).
- Limitos de velocidad (clicado blando).
- Limitaciones del espacio de trabajo (el factor final no puede salir de la mesa).
- Aplicación de un sistema de gestión de la información.

Estos se sientan fuera del VLA como controles de capa de control. La salida del VLA es una sugerencia, no un comando.

```figure
mm-action-tokens
```

## Usalo

`code/main.py`¿Qué es esto ?

- Implementa la tokenización y destokenización de acciones de 256 bin.
- Esboza un tokenizador FAST basado en la cuantización DCT +.
- Compara el número de tokens por paso de acción (discrete-bin, FAST, flujo continuo).
- Imprime un resumen de la línea de RT-2 → OpenVLA → π0 → GR00T.

## Envío

Esta lección produce`outputs/skill-vla-action-format-picker.md`. Dado que se realiza una tarea de robot (manipulación, navegación, cuerpo humanoide completo), se escoge entre bin discreto + RT-2, FAST + OpenVLA, flujo de coincidencia + π0, o sistema dual + GR00T.

## Los ejercicios

1. Un brazo de 10 DOF a 30 Hz de control. ¿Cuántos tokens emite una caja de 256 contenedores por segundo?

2. La tokenización rápida comprime las trayectorias de 30 pasos a ~ 10 tokens. ¿Qué pierde el usuario si la trayectoria tiene movimiento de alta frecuencia (por ejemplo, batería)?

3. La cabeza de coincidencia de flujo de π0 se denota en ~ 5 pasos. Comparar el rendimiento con el decodificación autorregresista de OpenVLA a 4-5 Hz.

4. El Sistema 1 / Sistema 2 de GR00T divide mapas a Kahneman. ¿Propone una división diferente (Sistema 3?) que podría ayudar a caminar a dos pies?

5. Lea la sección 4 de Open X-Embodiment sobre la curadoria de conjuntos de datos. Nombre de las tres reglas de curadoria que evitan la fuga de dominio.

## Términos clave

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | Model that takes image + instruction and outputs action commands |
| Action tokenization | "Discrete bins" | Quantize continuous joint targets into 256 bins per dim, each a vocab ID |
| FAST tokenizer | "Frequency action tokens" | DCT + quantize to compress 30-step trajectories to ~10 tokens |
| Co-fine-tune | "Mix web + robot" | Train on web VQA data alongside robot demos to preserve general knowledge |
| Flow-matching action head | "π0 continuous output" | Small transformer that outputs a 50-step action sequence via rectified flow |
| System 1 / System 2 | "Dual-system control" | Large VLM plans slowly, small action head acts quickly; GR00T pattern |
| Open X-Embodiment | "RT-X dataset" | 1M-trajectory cross-robot dataset; the training corpus |

## Leer más

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
