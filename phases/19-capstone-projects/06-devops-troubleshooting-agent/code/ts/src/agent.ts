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
            "Pod payments-api-7c4 が10分で2回 OOMKilled。memory request 256Mi が低すぎます。",
          evidence: [
            "kube-state-metrics: kube_pod_container_status_terminated_reason{reason=OOMKilled}",
            "Prom: container_memory_working_set_bytes p99 が limit に到達",
          ],
          remediation: "payments-api の request を 512Mi、limit を 1Gi に上げる",
        },
        {
          rank: 2,
          summary: "v2.41 rollout (Argo) で memory leak が入った可能性があります。",
          evidence: ["ArgoCD: payments-api revision v2.41 deployed 14m ago"],
          remediation: "payments-api を v2.40 に roll back する",
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
          summary: "auth-svc が CrashLoopBackOff。readiness probe path が 404 です。",
          evidence: [
            "kube_pod_container_status_waiting_reason{reason=CrashLoopBackOff}",
            "auth-svc deployment が probe path を /healthz から /ready に変更",
          ],
          remediation: "auth-svc deployment の spec.probe.path を /healthz に戻す",
        },
      ],
    };
  }
  return {
    incidentId,
    topHypotheses: [
      {
        rank: 1,
        summary: "prior signal がありません。agent は telemetry 収集を推奨します。",
        evidence: ["直近30分に matching prom alert なし"],
        remediation: "remediation 提案なし",
      },
    ],
  };
}
