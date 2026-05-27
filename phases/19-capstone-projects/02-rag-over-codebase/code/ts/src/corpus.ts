import type { Chunk } from "./types.ts";

export const SAMPLE_CORPUS: Chunk[] = [
  {
    repo: "uploader",
    path: "services/retry.go",
    startLine: 122,
    endLine: 148,
    symbol: "AbortMultipartOnFail",
    body: "if ctx.Err() != nil { return abort() }; decrement bucket budget; retry with backoff",
    summary:
      "aborts an in-flight S3 multipart upload and decrements the per-bucket retry budget",
  },
  {
    repo: "uploader",
    path: "config/budgets.yaml",
    startLine: 34,
    endLine: 51,
    symbol: "bucket_budget",
    body: "per_bucket_budget: 64; backoff_ms: [100, 500, 2500]; abort_threshold: 3",
    summary:
      "declares the retry budget and exponential backoff schedule per S3 bucket",
  },
  {
    repo: "client",
    path: "libs/s3client/multipart.ts",
    startLine: 44,
    endLine: 61,
    symbol: "abortUpload",
    body: "await s3.abortMultipartUpload({Bucket, Key, UploadId}); metrics.inc('s3.abort')",
    summary: "client-side S3 multipart abort with metrics instrumentation",
  },
  {
    repo: "auth",
    path: "services/authz/check.py",
    startLine: 12,
    endLine: 38,
    symbol: "check_permission",
    body: "def check_permission(user, resource, action): return policy.evaluate(user, resource, action)",
    summary:
      "central authorization gateway evaluating an OPA policy for user-resource-action",
  },
  {
    repo: "auth",
    path: "libs/policy/opa.py",
    startLine: 88,
    endLine: 110,
    symbol: "evaluate",
    body: "def evaluate(user, resource, action): return self.engine.query('authz', input=...)",
    summary: "OPA policy engine query wrapper for authorization checks",
  },
  {
    repo: "catalog",
    path: "services/search/query.rs",
    startLine: 200,
    endLine: 240,
    symbol: "rank_fusion",
    body: "pub fn rank_fusion(dense: Vec<Hit>, sparse: Vec<Hit>) -> Vec<Hit>",
    summary: "reciprocal rank fusion of dense and sparse retrieval results",
  },
];
