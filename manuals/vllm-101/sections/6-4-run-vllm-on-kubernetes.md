# Run vLLM on Kubernetes

> A layer above vLLM adds routing and scaling, and you pick it by the features you need.

You must run many vLLM servers on a cluster. When you finish this section, you can pick the layer that runs vLLM on Kubernetes.

## Start with what one Deployment gives you

The vLLM documentation shows a plain Kubernetes setup. It has a volume for the weights, a secret for the Hugging Face token, a Deployment that runs `vllm serve`, and a Service. A small Helm chart in the vLLM repository packages the same pieces. It adds a job that downloads the model and an optional Kubernetes autoscaler.

Here is a minimal version in our own form, for one GPU and one model. We did not run it on a cluster. It needs a cluster where the NVIDIA device plugin offers `nvidia.com/gpu`. For a model with restricted access, add a Secret named `hf-token` with a `token` key. Create a Secret named `vllm-api-key` with a `key` key, so that the `/v1` routes need the key.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vllm-qwen3-8b
spec:
  replicas: 1
  selector:
    matchLabels:
      app: vllm-qwen3-8b
  template:
    metadata:
      labels:
        app: vllm-qwen3-8b
    spec:
      terminationGracePeriodSeconds: 120
      containers:
        - name: vllm
          image: vllm/vllm-openai:v0.31.0
          args: ["Qwen/Qwen3-8B", "--max-model-len", "8192", "--reasoning-parser", "qwen3"]
          ports:
            - containerPort: 8000
          env:
            - name: HF_TOKEN
              valueFrom:
                secretKeyRef:
                  name: hf-token
                  key: token
                  optional: true
            - name: VLLM_API_KEY
              valueFrom:
                secretKeyRef:
                  name: vllm-api-key
                  key: key
          resources:
            limits:
              nvidia.com/gpu: 1
          startupProbe:
            httpGet:
              path: /health
              port: 8000
            periodSeconds: 10
            failureThreshold: 90
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            periodSeconds: 30
            failureThreshold: 3
          volumeMounts:
            - name: hf-cache
              mountPath: /root/.cache/huggingface
            - name: shm
              mountPath: /dev/shm
      volumes:
        - name: hf-cache
          emptyDir: {}
        - name: shm
          emptyDir:
            medium: Memory
            sizeLimit: 2Gi
---
apiVersion: v1
kind: Service
metadata:
  name: vllm-qwen3-8b
spec:
  selector:
    app: vllm-qwen3-8b
  ports:
    - port: 8000
      targetPort: 8000
```

The image starts `vllm serve`, so `args` holds only the model and the flags. The startup probe allows 90 checks 10 seconds apart, which is 15 minutes. Our DGX Spark took about 8 minutes for its first start, so set the limit from your own measured cold start. The probes stop Kubernetes from sending traffic or restarting the pod while the weights load.

Replace the `emptyDir` cache with a PersistentVolumeClaim, so a new pod does not download the weights again. The memory volume at `/dev/shm` gives the processes shared memory, as `--ipc=host` does with Docker. The API key does not protect `/health` or `/metrics`, so also limit which pods can reach the Service with a NetworkPolicy.

This is enough for a few replicas of one model. A plain Service spreads requests at random, so a user's next turn can go to a replica that never cached the earlier turns. An autoscaler on CPU use also scales on the wrong signal, because GPU load is not CPU load.

## Pick a layer for the features you need

| Layer | What it adds | Pick it when |
|---|---|---|
| vLLM production stack | a Helm chart, a router that keeps sessions on one replica, KV cache offloading through LMCache, and Grafana dashboards | you want the reference setup from the vLLM project |
| llm-d | a router that reads vLLM metrics and KV cache events to pick a replica, prefill and decode split, wide expert parallelism | you run large models or split prefill and decode on a cluster |
| KServe | a model-serving platform with a vLLM runtime, and an LLM resource built on llm-d | your company already runs KServe for other models |
| AIBrix | a control plane with routing, LoRA management, and autoscaling on engine metrics | you need many models and adapters with one control plane |
| Ray Serve LLM | vLLM inside Ray Serve, with multi-model serving | your stack already runs on Ray |

llm-d published its version 1.0 on 2026-10-20. It joined the CNCF as a sandbox project in March 2026. Its router follows the Gateway API Inference Extension, a Kubernetes project for routing to model servers.

## Know which vLLM features the layers use

The layers read the same vLLM interfaces. Check that your vLLM version supports the ones your layer needs:

- **Metrics.** The routers read `vllm:num_requests_waiting`, `vllm:num_requests_running`, and `vllm:kv_cache_usage_perc` to pick a replica.
- **KV cache events.** With `--kv-events-config`, vLLM publishes each block it stores and removes. A router uses these events to send a request to the replica that holds its prefix.
- **KV connectors.** The prefill and decode split and the shared cache use `--kv-transfer-config`.
- **Health.** `/health` serves the startup, liveness, and readiness probes.

Not measured on our hardware. We have no cluster run, and we did not apply the manifest above.

```takeaways
- Start with one Deployment, a GPU limit, and a startup probe longer than your cold start.
- A plain Deployment works for a few replicas, but it routes at random and scales on the wrong signal.
- Pick the layer by the feature you need: session routing, the prefill and decode split, or many adapters.
- Check that your vLLM version supports the metrics, events, and connectors your layer reads.
```

Sources: vLLM documentation at v0.31.0 (docs/deployment/k8s.md, docs/deployment/frameworks/helm.md, docs/deployment/integrations/), the llm-d v1.0.0 release notes and architecture documents (2026-10-20), the CNCF announcement of llm-d (2026-03-24), the production-stack, AIBrix, and KServe documentation (accessed 2026-10-21), our GB10 start log capture/gpu/out-gb10/server-load-vllm.log (arguments at 10:53:02, server ready at 11:00:59), vLLM source at v0.31.0 vllm/entrypoints/serve/middleware/authenticate.py (the key guards only paths under /v1, /v2, /inference and /cohere).
