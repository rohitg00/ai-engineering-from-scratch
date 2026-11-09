# Seguridad  Secrets, rotación de llaves API, registros de auditoría, guardrails

> Eliminar la expansión secreta a través de bóvedas centralizadas (Bóveda de HashiCorp, Administrador de secretos de AWS, bóveda de llaves de Azure). Nunca almacenes credenciales en archivos de configuración, archivos env en VCS, hojas de cálculo. Utilice roles de IAM en lugar de claves estáticas; OIDC para CI/CD. El patrón de puerta de entrada de IA es la solución 2026: aplicaciones → puerta de entrada → proveedor de modelos, con puerta de entrada extrayendo credenciales de la bóveda en el tiempo de ejecución. Gira en la bóveda y todas las aplicaciones se recogen en minutos  no redistribuciones, no Slack "quién tiene la nueva llave" mensajes. Política de rotación ≤ 90 días; escaneo con TruffleHog / GitGuardian / Gitleaks en cada compromiso. Cero confianza: MFA, SSO, RBAC/ABAC, fichas de corta duración, postura del dispositivo. El despeje de PII utiliza el reconocimiento de entidades para enmascarar PHI/PII antes de su reenvío; la tokenización consistente (enfoque Mesh) mapea valores sensibles para los titulares de puestos estables para que el LLM preserve la semántica de código/relación. Exceso de red: servicios de LLM en subredes VPC/VNet dedicadas en la lista blanca `api.openai.com`¿ Qué ?`api.anthropic.com`El controlador de incidente 2026: el ataque de la cadena de suministro de Vercel a través de credenciales de CI / CD comprometidas exfiltraron el entorno a través de miles de implementaciones de clientes.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy PII-scrubber + audit-log writer)
**Prerequisites:** Phase 17 · 19 (AI Gateways), Phase 17 · 13 (Observability)
**Time:** ~60 minutes

## Objetivos de aprendizaje

- Enumera los cuatro patrones anti-gestión secreta (archivos de configuración en VCS, env codificado en forma dura, hojas de cálculo, claves estáticas) y nombra sus reemplazos.
- Explica el patrón de AI-gateway-pulls-from-vault como estándar de producción de 2026.
- Implementar un despector de PII con tokenización consistente (el mismo valor → el mismo poseedor de lugar) para que la semántica sobreviva.
- Nombre del incidente de la cadena de suministro Vercel 2026 y lo que enseñó sobre la higiene de las credenciales CI/CD.

## El problema

Un pasante se compromete `.env`Las claves ya están en el historial de git  GitGuardian scan lo capta, su proceso de rotación es "Reacordar el equipo, actualizar 40 archivos de configuración, redistribuir todos los servicios". 8 horas después, la mitad de sus servicios están en vivo y la mitad están esperando para implementar ventanas.

Separadamente, las instrucciones de usuario incluyen "Mi SSN es 123-45-6789." La instrucción va a OpenAI. Tienes un BAA pero tu política interna es enmascarar PII antes de reenviar.

Separadamente, el módulo de LLM de tu grupo EKS puede llegar a cualquier host de Internet alguien exfila datos a través de búsqueda DNS a un dominio controlado por el atacante.

La seguridad para los servicios de LLM tiene que abordar los tres vectores y probarlo después. credenciales respaldadas por bóvedas. limpieza de PII. filtración de salida de red. registros de auditoría como rastro de pruebas.

## El concepto

### Tresera centralizada + tirón de rol de IAM

**Vault**HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager. Una fuente de verdad.

**IAM role**: app/gateway autentica a través de su identidad IAM, no una clave estática. Vault devuelve el secreto para la vida útil del token.

**The AI-gateway pattern**: puesta de puerta `OPENAI_API_KEY`girar en la bóveda, la próxima solicitud obtiene la nueva llave.

### Política de rotación ≤ 90 días

Todas las claves de API, token de raíz de la bóveda, credenciales CI/CD. Rotación automática cuando sea posible.

### Escaneo secreto

- **TruffleHog** regex + entropía en los commits.
- **GitGuardian** comercial, alta precisión.
- **Gitleaks** OSS, se ejecuta en CI.

En cualquier momento, bloquear las relaciones públicas si se descubre un nuevo secreto.

### Posición de cero confianza

- Exigen las MFA en todas las cuentas.
- SSO a través de SAML/OIDC.
- RBAC (basado en el papel) o ABAC (basado en el atributo) para el acceso a granos finos.
- Tokens de corta duración (horas, no días).
- Posición del dispositivo  solo dispositivos corporativos con encriptación de disco.

### El uso de la limpieza PII/PHI

Antes de que el aviso salga de su infra:

1. Reconocimiento de entidades (spaCy NER, Presidio, comercial).
2. Las entidades que se encuentran en la máscara: `"My SSN is 123-45-6789"`¿ Qué es esto ?`"My SSN is [SSN_TOKEN_A3F]"`¿ Qué ?
3. Tokenización consistente (enfoque Mesh): mapas de valores similares a los mismos titulares de lugar para que el LLM preserve las relaciones.
4. Mapeo opcional inverso para la respuesta del LLM.

Los filtros de regex estáticos capturan patrones básicos, el NER capta más.

### Barrancas de entrada y salida

Entrada: bloquear las violaciones de seguridad conocidas, temas prohibidos; límite de tarifas por usuario.

Resultado: regex scrub para secretos filtrados (patrones de claves API, patrones de correo electrónico en contextos de rechazo), clasificador de violaciones de políticas.

### Lista blanca de salida de red

Servicios de LLM en una subred dedicada:
- Lista blanca: `api.openai.com`¿ Qué ?`api.anthropic.com`, puntos finales de vector DB, puntos finales de bóveda.
- Todo lo demás: dejar caer.
- DNS a través de resolver de solo permisores (evitar exfil de tunelado de DNS).

### Registro de auditoría

Registro inmutable de cada llamada de LLM con:
- - Es un sello de tiempo.
- Usuario / inquilino.
- Hash rápido (no en bruto para privacidad).
- Modelo + versión.
- Las fichas cuentan.
- El costo.
- Respuesta de la hacha.
- Cualquier viaje de vigilancia.

Recepción por requerimiento regulatorio (SOC 2 1 año, HIPAA 6 años).

### El incidente de Vercel de 2026

El ataque de cadena de suministro: las credenciales de CI/CD comprometidas se filtraron en el entorno a través de miles de implementaciones de clientes.

### Números que debes recordar

- Política de rotación: ≤ 90 días.
- Escanear en cada comit: TruffleHog / GitGuardian / Gitleaks.
- Vercel 2026: Créditos de CI/CD comprometidos → miles de clientes se filtraron.
- Retención del registro de auditoría: SOC 2 = 1 año, HIPAA = 6 años.

```figure
i4-vault-rotation
```

## Usalo

`code/main.py`Implementa un limpiador de DII de juguete con tokenización consistente y un registro de auditoría solo en apéndice.

## Envío

Esta lección produce`outputs/skill-llm-security-plan.md`Dado el alcance regulatorio y el estado actual, los planes de migración de la bóveda, limpieza, salida, registro de auditoría.

## Los ejercicios

1. - ¿ Qué ?`code/main.py`Envía dos mensajes de referencia al mismo nombre de identidad.
2. Diseñar la política de salida de red para una implementación de vLLM-on-EKS llamando OpenAI + Anthropic + Weaviate.
3. Descubre una llave en el historial de git (2 años) ¿Cuál es la respuesta correcta  girar la llave, borrar el historial, o ambos?
4. Su registro de auditoría crece 10 GB/día.
5. Argumentar si la tokenización inversa (sustituir los valores reales de nuevo en respuesta de LLM) vale la complejidad frente a mantener a los titulares de lugar visibles.

## Términos clave

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Vault | "secrets store" | Centralized credential management service |
| IAM role | "identity-based auth" | Role assumed by app; returns short-lived creds |
| OIDC for CI/CD | "cloud-issued tokens" | No static keys in CI — identity via OIDC |
| TruffleHog / GitGuardian / Gitleaks | "secret scanners" | Commit-time secret detection |
| RBAC / ABAC | "access control" | Role-based vs attribute-based |
| PII scrubbing | "data masking" | Remove or tokenize sensitive entities |
| Consistent tokenization | "stable placeholders" | Same value → same token each time |
| Mesh approach | "Mesh tokenization" | Semantic-preserving tokenization pattern |
| Egress whitelist | "outbound allowlist" | Only permitted domains reachable |
| Audit log | "immutable history" | Append-only record for compliance |

## Leer más

- [Doppler — Advanced LLM Security](https://www.doppler.com/blog/advanced-llm-security)
- [Portkey — Manage LLM API keys with secret references](https://portkey.ai/blog/secret-references-ai-api-key-management/)
- [Datadog — LLM Guardrails Best Practices](https://www.datadoghq.com/blog/llm-guardrails-best-practices/)
- [JumpServer — Secrets Management Best Practices 2026](https://www.jumpserver.com/blog/secret-management-best-practices-2026)
- [Microsoft Presidio](https://github.com/microsoft/presidio) Detección y anonimización de PII.
- [HashiCorp Vault docs](https://developer.hashicorp.com/vault/docs)
