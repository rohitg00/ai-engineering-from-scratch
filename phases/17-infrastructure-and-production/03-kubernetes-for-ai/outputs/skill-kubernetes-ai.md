---
name: skill-kubernetes-ai
description: Deploy and scale AI models on Kubernetes with GPU scheduling, autoscaling, and cost optimization
version: 1.0.0
phase: 17
lesson: 3
tags: [kubernetes, gpu, autoscaling, keda, spot-instances, infrastructure, production]
---

# Kubernetes for AI Pattern

Every AI deployment on Kubernetes follows this structure:

```
Deployment (GPU pods) + Service + KEDA (queue autoscaler) + PVC (weights) + PDB (availability)
```

GPU scheduling, cold start mitigation, and cost management are the three problems that separate AI from web workloads on K8s.

## When to use Kubernetes for AI

- Serving multiple models across multiple GPUs
- Need for autoscaling based on traffic patterns
- Multi-region or multi-cloud deployment
- Rolling updates with zero downtime
- Team needs self-service model deployment

## When Kubernetes is overkill

- Single model on a single GPU
- Batch/offline inference with no scaling needs
- Team lacks Kubernetes operational expertise
- Serverless GPU options (Modal, Replicate, RunPod) meet the requirements

## Manifest checklist

1. Deployment with nvidia.com/gpu resource requests and limits
2. Node selector for GPU type (nvidia.com/gpu.product)
3. readinessProbe with initialDelaySeconds >= 120 (cold start)
4. PVC for model weights (ReadOnlyMany access mode)
5. /dev/shm emptyDir mount (PyTorch shared memory for DataLoader)
6. KEDA ScaledObject with Prometheus queue depth trigger
7. PodDisruptionBudget with minAvailable >= 1
8. RollingUpdate with maxUnavailable: 0 (never lose all serving capacity)

## Cold start mitigation

| Strategy | Cold start | Idle cost |
|----------|-----------|-----------|
| No mitigation | 3-5 minutes | None |
| Image pre-pull (DaemonSet) | 2-4 minutes | Minimal |
| Local weight cache (hostPath) | 1-3 minutes | Storage only |
| Warm pool (min replicas) | < 1 second | Full GPU cost |

## Autoscaling rules

- Scale on queue depth, not CPU utilization
- Set cooldown to 300s (5 min) to avoid thrashing
- Limit scale-up to 2 pods per minute (cold start capacity planning)
- Limit scale-down to 1 pod per 2 minutes (prevent premature eviction)
- Never scale to zero for latency-sensitive workloads (use min replicas)

## Cost optimization

1. Right-size GPU type first (L4 at $0.31/hr vs A100 at $2.21/hr)
2. Quantize models to fit smaller GPUs (int4 cuts memory 4x)
3. Use spot instances for overflow capacity (60-90% savings)
4. Keep on-demand for minimum baseline (spot preempts with 30s notice)
5. Scale to zero for dev/staging environments
6. Monitor GPU utilization per pod (below 50% means over-provisioned)

## Common mistakes

- Not requesting nvidia.com/gpu (pod runs on CPU, no error)
- readinessProbe timeout too short (pod gets killed during model loading)
- Using HPA with CPU metric (GPU workloads have no CPU correlation)
- No PDB (node drain kills all replicas simultaneously)
- Baking weights into image (see Docker for AI lesson)
- maxUnavailable > 0 during rolling update (simultaneous cold starts)
