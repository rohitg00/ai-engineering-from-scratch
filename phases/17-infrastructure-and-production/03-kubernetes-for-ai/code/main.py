import json
import time
import random
import math
from dataclasses import dataclass, field


@dataclass
class GPU:
    gpu_id: int
    gpu_type: str
    memory_mb: int
    cost_per_hour: float
    allocated: bool = False
    pod_name: str = ""


@dataclass
class Node:
    name: str
    gpus: list = field(default_factory=list)
    cpu_cores: int = 32
    memory_gb: int = 128
    is_spot: bool = False
    region: str = "us-east-1"

    @property
    def free_gpus(self):
        return [g for g in self.gpus if not g.allocated]

    @property
    def gpu_type(self):
        return self.gpus[0].gpu_type if self.gpus else "none"


@dataclass
class Pod:
    name: str
    gpu_request: int
    gpu_type_required: str
    memory_request_gb: float
    status: str = "Pending"
    node_name: str = ""
    start_time: float = 0.0
    ready_time: float = 0.0


def generate_deployment_yaml(name, replicas, gpu_count, gpu_type, image, model_path):
    return f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {name}
  labels:
    app: {name}
spec:
  replicas: {replicas}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: {name}
  template:
    metadata:
      labels:
        app: {name}
    spec:
      nodeSelector:
        nvidia.com/gpu.product: {gpu_type}
      containers:
        - name: model-server
          image: {image}
          ports:
            - containerPort: 8000
              name: http
          env:
            - name: MODEL_PATH
              value: {model_path}
            - name: MAX_BATCH_SIZE
              value: "8"
          resources:
            requests:
              nvidia.com/gpu: {gpu_count}
              memory: "16Gi"
              cpu: "4"
            limits:
              nvidia.com/gpu: {gpu_count}
              memory: "32Gi"
              cpu: "8"
          readinessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 120
            periodSeconds: 10
            failureThreshold: 6
          livenessProbe:
            httpGet:
              path: /health
              port: 8000
            initialDelaySeconds: 180
            periodSeconds: 30
            failureThreshold: 3
          volumeMounts:
            - name: model-weights
              mountPath: /models
              readOnly: true
            - name: shm
              mountPath: /dev/shm
      volumes:
        - name: model-weights
          persistentVolumeClaim:
            claimName: {name}-weights
        - name: shm
          emptyDir:
            medium: Memory
            sizeLimit: "8Gi"
      terminationGracePeriodSeconds: 60"""


def generate_service_yaml(name):
    return f"""apiVersion: v1
kind: Service
metadata:
  name: {name}
spec:
  selector:
    app: {name}
  ports:
    - port: 80
      targetPort: 8000
      protocol: TCP
      name: http
  type: ClusterIP"""


def generate_keda_yaml(name, prometheus_url, queue_threshold):
    return f"""apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: {name}-scaler
spec:
  scaleTargetRef:
    name: {name}
  minReplicaCount: 1
  maxReplicaCount: 10
  cooldownPeriod: 300
  pollingInterval: 15
  triggers:
    - type: prometheus
      metadata:
        serverAddress: {prometheus_url}
        query: sum(model_server_queue_depth{{deployment="{name}"}})
        threshold: "{queue_threshold}"
        activationThreshold: "2"
  advanced:
    horizontalPodAutoscalerConfig:
      behavior:
        scaleUp:
          stabilizationWindowSeconds: 30
          policies:
            - type: Pods
              value: 2
              periodSeconds: 60
        scaleDown:
          stabilizationWindowSeconds: 300
          policies:
            - type: Pods
              value: 1
              periodSeconds: 120"""


def generate_pvc_yaml(name, size_gi):
    return f"""apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: {name}-weights
spec:
  accessModes:
    - ReadOnlyMany
  storageClassName: fast-ssd
  resources:
    requests:
      storage: {size_gi}Gi"""


def generate_ingress_yaml(name, host):
    return f"""apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: {name}-ingress
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "120"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "120"
    nginx.ingress.kubernetes.io/proxy-buffering: "off"
spec:
  rules:
    - host: {host}
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: {name}
                port:
                  number: 80"""


def generate_pdb_yaml(name):
    return f"""apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: {name}-pdb
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app: {name}"""


class Scheduler:
    def __init__(self, nodes):
        self.nodes = nodes

    def schedule(self, pod):
        candidates = []
        for node in self.nodes:
            free = node.free_gpus
            type_match = any(g.gpu_type == pod.gpu_type_required for g in free)
            count_match = len([g for g in free if g.gpu_type == pod.gpu_type_required]) >= pod.gpu_request

            if type_match and count_match:
                candidates.append(node)

        if not candidates:
            return None, "No nodes with sufficient free GPUs of type " + pod.gpu_type_required

        candidates.sort(key=lambda n: len(n.free_gpus))

        selected = candidates[0]
        allocated = 0
        for gpu in selected.gpus:
            if not gpu.allocated and gpu.gpu_type == pod.gpu_type_required and allocated < pod.gpu_request:
                gpu.allocated = True
                gpu.pod_name = pod.name
                allocated += 1

        pod.status = "Running"
        pod.node_name = selected.name
        pod.start_time = time.time()

        return selected, "Scheduled"


def simulate_cold_start(image_cached, weights_local, warm_pool):
    stages = {}

    if image_cached:
        stages["image_pull"] = random.uniform(1, 3)
    else:
        stages["image_pull"] = random.uniform(30, 120)

    if weights_local:
        stages["weight_load"] = random.uniform(5, 15)
    else:
        stages["weight_load"] = random.uniform(30, 180)

    stages["gpu_init"] = random.uniform(5, 15)
    stages["model_load"] = random.uniform(30, 120)
    stages["warmup_inference"] = random.uniform(3, 10)

    if warm_pool:
        stages = {"already_warm": 0.1}

    total = sum(stages.values())
    return stages, total


class AutoscaleSimulator:
    def __init__(self, min_replicas, max_replicas, queue_threshold, cold_start_seconds):
        self.min_replicas = min_replicas
        self.max_replicas = max_replicas
        self.current_replicas = min_replicas
        self.queue_threshold = queue_threshold
        self.cold_start_seconds = cold_start_seconds
        self.pending_replicas = 0
        self.pending_ready_at = []
        self.history = []

    def tick(self, current_time, queue_depth, requests_per_second):
        newly_ready = [t for t in self.pending_ready_at if current_time >= t]
        self.current_replicas += len(newly_ready)
        self.pending_replicas -= len(newly_ready)
        self.pending_ready_at = [t for t in self.pending_ready_at if current_time < t]

        desired = max(self.min_replicas, math.ceil(queue_depth / self.queue_threshold))
        desired = min(desired, self.max_replicas)

        total_target = desired
        currently_available = self.current_replicas + self.pending_replicas

        if total_target > currently_available:
            to_add = min(2, total_target - currently_available)
            for _ in range(to_add):
                ready_at = current_time + self.cold_start_seconds + random.uniform(-10, 10)
                self.pending_ready_at.append(ready_at)
                self.pending_replicas += 1
        elif total_target < self.current_replicas and self.pending_replicas == 0:
            to_remove = min(1, self.current_replicas - total_target)
            self.current_replicas = max(self.min_replicas, self.current_replicas - to_remove)

        capacity = self.current_replicas * self.queue_threshold * 2
        processed = min(queue_depth, capacity)
        remaining_queue = max(0, queue_depth - processed)

        self.history.append({
            "time": round(current_time, 1),
            "queue_depth": queue_depth,
            "rps": requests_per_second,
            "replicas_ready": self.current_replicas,
            "replicas_pending": self.pending_replicas,
            "processed": processed,
        })

        return remaining_queue


def calculate_cost(gpu_type, count, hours, is_spot=False):
    prices = {
        "A100-80GB": 2.21,
        "A100-40GB": 1.60,
        "H100": 3.50,
        "L4": 0.31,
        "T4": 0.20,
    }
    base_price = prices.get(gpu_type, 1.0)
    if is_spot:
        base_price *= 0.3
    return base_price * count * hours


def generate_traffic_pattern(duration_minutes):
    pattern = []
    for minute in range(duration_minutes):
        hour = minute / 60.0

        base = 10
        if 2 < hour < 5:
            base = 50 + 30 * math.sin((hour - 2) * math.pi / 3)
        elif 5 <= hour < 6:
            base = 20
        else:
            base = 10

        noise = random.uniform(-5, 5)
        rps = max(1, base + noise)
        pattern.append((minute, round(rps, 1)))

    return pattern


def main():
    print("=" * 60)
    print("KUBERNETES FOR AI WORKLOADS")
    print("=" * 60)

    print("\nSTEP 1: Generate Kubernetes Manifests")
    print("-" * 40)

    deployment = generate_deployment_yaml(
        name="llama-7b-serve",
        replicas=2,
        gpu_count=1,
        gpu_type="NVIDIA-A100-SXM4-80GB",
        image="my-registry/model-server:v1.0",
        model_path="/models/llama-7b",
    )
    service = generate_service_yaml("llama-7b-serve")
    keda = generate_keda_yaml("llama-7b-serve", "http://prometheus:9090", 10)
    pvc = generate_pvc_yaml("llama-7b-serve", 50)
    ingress = generate_ingress_yaml("llama-7b-serve", "llama.example.com")
    pdb = generate_pdb_yaml("llama-7b-serve")

    manifests = {
        "deployment.yaml": deployment,
        "service.yaml": service,
        "keda-scaledobject.yaml": keda,
        "pvc.yaml": pvc,
        "ingress.yaml": ingress,
        "pdb.yaml": pdb,
    }

    for filename, content in manifests.items():
        lines = content.strip().split("\n")
        print(f"\n  {filename} ({len(lines)} lines):")
        for line in lines[:8]:
            print(f"    {line}")
        if len(lines) > 8:
            print(f"    ... ({len(lines) - 8} more lines)")

    print("\n\nSTEP 2: GPU Scheduling Simulation")
    print("-" * 40)

    nodes = [
        Node("node-a100-1", [
            GPU(0, "A100-80GB", 81920, 2.21),
            GPU(1, "A100-80GB", 81920, 2.21),
        ]),
        Node("node-a100-2", [
            GPU(0, "A100-80GB", 81920, 2.21),
            GPU(1, "A100-80GB", 81920, 2.21, allocated=True, pod_name="existing-pod"),
        ]),
        Node("node-l4-1", [
            GPU(0, "L4", 24576, 0.31),
            GPU(1, "L4", 24576, 0.31),
            GPU(2, "L4", 24576, 0.31),
            GPU(3, "L4", 24576, 0.31),
        ]),
        Node("node-spot-1", [
            GPU(0, "A100-80GB", 81920, 0.66),
            GPU(1, "A100-80GB", 81920, 0.66),
        ], is_spot=True),
    ]

    scheduler = Scheduler(nodes)

    print(f"\n  Cluster: {len(nodes)} nodes, {sum(len(n.gpus) for n in nodes)} total GPUs")
    for node in nodes:
        spot = " (SPOT)" if node.is_spot else ""
        free = len(node.free_gpus)
        total = len(node.gpus)
        print(f"    {node.name}: {total}x {node.gpu_type}, {free} free{spot}")

    pods_to_schedule = [
        Pod("llama-7b-pod-1", 1, "A100-80GB", 16.0),
        Pod("llama-7b-pod-2", 1, "A100-80GB", 16.0),
        Pod("mistral-7b-pod", 1, "L4", 8.0),
        Pod("llama-70b-pod", 2, "A100-80GB", 64.0),
        Pod("embed-pod", 1, "L4", 4.0),
        Pod("overflow-pod", 1, "A100-80GB", 16.0),
    ]

    print(f"\n  Scheduling {len(pods_to_schedule)} pods:")
    for pod in pods_to_schedule:
        node, reason = scheduler.schedule(pod)
        if node:
            spot = " (SPOT)" if node.is_spot else ""
            print(f"    {pod.name}: {pod.gpu_request}x {pod.gpu_type_required} "
                  f"-> {node.name}{spot}")
        else:
            print(f"    {pod.name}: {pod.gpu_request}x {pod.gpu_type_required} "
                  f"-> FAILED: {reason}")

    print(f"\n  Cluster state after scheduling:")
    for node in nodes:
        free = len(node.free_gpus)
        total = len(node.gpus)
        allocated_pods = set(g.pod_name for g in node.gpus if g.allocated)
        allocated_pods.discard("")
        print(f"    {node.name}: {free}/{total} GPUs free, "
              f"pods: {', '.join(allocated_pods) if allocated_pods else 'none'}")

    print("\n\nSTEP 3: Cold Start Simulation")
    print("-" * 40)

    configs = [
        ("No caching, remote weights", False, False, False),
        ("Image cached, remote weights", True, False, False),
        ("Image cached, local weights", True, True, False),
        ("Warm pool (pre-loaded)", True, True, True),
    ]

    for desc, img_cached, weights_local, warm in configs:
        stages, total = simulate_cold_start(img_cached, weights_local, warm)
        print(f"\n  Config: {desc}")
        print(f"    Total cold start: {total:.1f}s")
        for stage, duration in stages.items():
            bar = "#" * int(duration / 5)
            print(f"      {stage:20s}: {duration:6.1f}s {bar}")

    print("\n\nSTEP 4: Autoscaling Simulation")
    print("-" * 40)

    traffic = generate_traffic_pattern(duration_minutes=360)

    autoscaler = AutoscaleSimulator(
        min_replicas=2,
        max_replicas=8,
        queue_threshold=10,
        cold_start_seconds=180,
    )

    queue_depth = 0.0
    print(f"\n  Simulating 6 hours of traffic:")
    print(f"  {'Time':>8s} {'RPS':>6s} {'Queue':>7s} {'Ready':>6s} {'Pending':>8s}")
    print(f"  {'-'*8} {'-'*6} {'-'*7} {'-'*6} {'-'*8}")

    for minute, rps in traffic:
        new_requests = rps
        queue_depth += new_requests

        remaining = autoscaler.tick(minute * 60, queue_depth, rps)
        queue_depth = remaining

        if minute % 30 == 0:
            entry = autoscaler.history[-1]
            print(f"  {minute:5d}min {rps:6.1f} {queue_depth:7.0f} "
                  f"{entry['replicas_ready']:6d} {entry['replicas_pending']:8d}")

    print(f"\n  Summary:")
    max_replicas = max(e["replicas_ready"] for e in autoscaler.history)
    min_replicas = min(e["replicas_ready"] for e in autoscaler.history)
    max_queue = max(e["queue_depth"] for e in autoscaler.history)
    print(f"    Replica range: {min_replicas} - {max_replicas}")
    print(f"    Peak queue depth: {max_queue:.0f}")
    print(f"    Cold start penalty: {autoscaler.cold_start_seconds}s per new pod")

    print("\n\nSTEP 5: Cost Calculator")
    print("-" * 40)

    scenarios = [
        ("2x A100 on-demand, 24h", "A100-80GB", 2, 24, False),
        ("2x A100 spot, 24h", "A100-80GB", 2, 24, True),
        ("4x L4 on-demand, 24h", "L4", 4, 24, False),
        ("4x L4 spot, 24h", "L4", 4, 24, True),
        ("1x H100 on-demand, 24h", "H100", 1, 24, False),
        ("2x T4 on-demand, 24h", "T4", 2, 24, False),
        ("2x A100, business hours only (10h)", "A100-80GB", 2, 10, False),
    ]

    print(f"\n  {'Configuration':<40s} {'Daily Cost':>10s} {'Monthly':>10s}")
    print(f"  {'-'*40} {'-'*10} {'-'*10}")

    for desc, gpu_type, count, hours, spot in scenarios:
        daily = calculate_cost(gpu_type, count, hours, spot)
        monthly = daily * 30
        print(f"  {desc:<40s} ${daily:>8.2f} ${monthly:>8.0f}")

    print(f"\n  Key insight: Right-sizing GPU type saves more than spot discounts.")
    a100_cost = calculate_cost("A100-80GB", 2, 24)
    l4_cost = calculate_cost("L4", 4, 24)
    savings = ((a100_cost - l4_cost) / a100_cost) * 100
    print(f"  4x L4 vs 2x A100: {savings:.0f}% savings (if model fits in 24GB)")

    print("\n\nSTEP 6: GPU Type Selection")
    print("-" * 40)

    models = [
        ("Llama 3.1 8B (fp16)", 16, 30),
        ("Llama 3.1 8B (int4)", 5, 25),
        ("Llama 3.1 70B (fp16)", 140, 15),
        ("Llama 3.1 70B (int4)", 38, 12),
        ("Mistral 7B (fp16)", 14, 35),
        ("Embedding model (fp16)", 2, 200),
    ]

    gpu_options = [
        ("T4", 16, 0.20),
        ("L4", 24, 0.31),
        ("A100-40GB", 40, 1.60),
        ("A100-80GB", 80, 2.21),
        ("H100", 80, 3.50),
    ]

    print(f"\n  {'Model':<30s} {'VRAM':>6s} {'Best GPU':<12s} {'GPUs':>5s} {'$/hr':>6s}")
    print(f"  {'-'*30} {'-'*6} {'-'*12} {'-'*5} {'-'*6}")

    for model_name, vram_gb, tps in models:
        best_gpu = None
        best_count = 999
        best_cost = float("inf")

        for gpu_name, gpu_mem, gpu_cost in gpu_options:
            gpus_needed = math.ceil(vram_gb / gpu_mem)
            total_cost = gpus_needed * gpu_cost
            if total_cost < best_cost:
                best_cost = total_cost
                best_gpu = gpu_name
                best_count = gpus_needed

        print(f"  {model_name:<30s} {vram_gb:>4d}GB {best_gpu:<12s} {best_count:>5d} ${best_cost:>5.2f}")

    print("\n\nSTEP 7: Spot Instance Risk Analysis")
    print("-" * 40)

    print(f"\n  Simulating spot preemption over 24 hours:")

    preemption_rate = 0.15
    hours = 24
    on_demand_pods = 2
    spot_pods = 2
    total_preemptions = 0
    downtime_minutes = 0

    for hour in range(hours):
        for _ in range(spot_pods):
            if random.random() < preemption_rate:
                total_preemptions += 1
                recovery_minutes = random.uniform(3, 5)
                downtime_minutes += recovery_minutes

    spot_cost = calculate_cost("A100-80GB", spot_pods, hours, is_spot=True)
    ondemand_cost = calculate_cost("A100-80GB", on_demand_pods, hours, is_spot=False)
    total_cost = spot_cost + ondemand_cost

    pure_ondemand = calculate_cost("A100-80GB", on_demand_pods + spot_pods, hours, is_spot=False)
    savings_pct = ((pure_ondemand - total_cost) / pure_ondemand) * 100

    print(f"    On-demand pods: {on_demand_pods} (always available)")
    print(f"    Spot pods: {spot_pods} (60-70% cheaper)")
    print(f"    Preemption rate: {preemption_rate*100:.0f}% per hour")
    print(f"    Total preemptions: {total_preemptions}")
    print(f"    Recovery time per preemption: 3-5 minutes")
    print(f"    Total downtime (spot capacity): {downtime_minutes:.0f} minutes")
    print(f"    Cost (mixed): ${total_cost:.2f}/day")
    print(f"    Cost (all on-demand): ${pure_ondemand:.2f}/day")
    print(f"    Savings: {savings_pct:.0f}%")

    print("\n\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print("  Built Kubernetes configuration for AI model serving:")
    print(f"    - 6 manifest files (Deployment, Service, KEDA, PVC, Ingress, PDB)")
    print(f"    - GPU scheduling across {len(nodes)} nodes with {sum(len(n.gpus) for n in nodes)} GPUs")
    print(f"    - Cold start: 2-5 min (cold) vs <1s (warm pool)")
    print(f"    - Autoscaling: queue-depth driven via KEDA")
    print(f"    - Cost optimization: GPU type selection + spot instances")
    print()
    print("  Key takeaways:")
    print("    1. Request nvidia.com/gpu in pod spec (GPUs are not auto-detected)")
    print("    2. Cold start is 3-5 minutes, use warm pools for latency-sensitive workloads")
    print("    3. Autoscale on queue depth, not CPU utilization")
    print("    4. Right-size GPU type before optimizing with spot instances")
    print("    5. Keep minAvailable: 1 PDB to survive node maintenance")
    print("    6. Set readinessProbe initialDelaySeconds to 120+ seconds for model loading")


if __name__ == "__main__":
    main()
