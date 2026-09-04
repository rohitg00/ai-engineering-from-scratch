import type { AgentReport } from "./types.js";

let incidentCounter = 0;

export function mockAgent(alertText: string): AgentReport {
  const tokens = alertText.toLowerCase();
  incidentCounter += 1;
  const incidentId = `inc-${Date.now()}-${incidentCounter}`;
  if (tokens.includes("oom") || tokens.includes("memory")) {
    return {
      incidentId,
      topHypotheses: [
        {
          rank: 1,
          summary:
            "Pod payments-api-7c4 OOMKilled twice in 10m, memory request 256Mi too low.",
          evidence: [
            "kube-state-metrics: kube_pod_container_status_terminated_reason{reason=OOMKilled}",
            "Prom: container_memory_working_set_bytes p99 hit limit",
          ],
          remediation: "bump payments-api request to 512Mi, limit 1Gi",
        },
        {
          rank: 2,
          summary: "Possible memory-leak introduced by v2.41 rollout (Argo).",
          evidence: ["ArgoCD: payments-api revision v2.41 deployed 14m ago"],
          remediation: "roll back payments-api to v2.40",
        },
      ],
    };
  }
  if (tokens.includes("crashloop") || tokens.includes("restart")) {
    return {
      incidentId,
      topHypotheses: [
        {
          rank: 1,
          summary: "CrashLoopBackOff on auth-svc - readiness probe path 404s.",
          evidence: [
            "kube_pod_container_status_waiting_reason{reason=CrashLoopBackOff}",
            "auth-svc deployment changed probe path from /healthz to /ready",
          ],
          remediation: "revert auth-svc deployment spec.probe.path to /healthz",
        },
      ],
    };
  }
  return {
    incidentId,
    topHypotheses: [
      {
        rank: 1,
        summary: "No prior signal; agent recommends collecting telemetry.",
        evidence: ["no matching prom alerts in last 30m"],
        remediation: "no remediation proposed",
      },
    ],
  };
}
