(function () {
  "use strict";

  const benchmarkQueries = [
    {
      id: "q1",
      name: "Exact Match",
      tenant: "tenant-alpha",
      prompt: "What is the return policy for defective laptops?",
      cachedPrompt: "What is the return policy for defective laptops?",
      similarity: 1.0,
      isExact: true,
      diffTenant: false,
      diffRev: false,
      isNegation: false,
      isNumber: false
    },
    {
      id: "q2",
      name: "Paraphrase",
      tenant: "tenant-alpha",
      prompt: "What is the return policy regarding defective laptops?",
      cachedPrompt: "What is the return policy for defective laptops?",
      similarity: 0.88,
      isExact: false,
      diffTenant: false,
      diffRev: false,
      isNegation: false,
      isNumber: false
    },
    {
      id: "q3",
      name: "Cross-Tenant Probe",
      tenant: "tenant-gamma",
      prompt: "What is the return policy for defective laptops?",
      cachedPrompt: "What is the return policy for defective laptops?",
      similarity: 1.0,
      isExact: true,
      diffTenant: true,
      diffRev: false,
      isNegation: false,
      isNumber: false
    },
    {
      id: "q4",
      name: "Negation Inversion",
      tenant: "tenant-alpha",
      prompt: "Can I not deploy the payment service to production on Friday?",
      cachedPrompt: "Can I deploy the payment service to production on Friday?",
      similarity: 0.91,
      isExact: false,
      diffTenant: false,
      diffRev: false,
      isNegation: true,
      isNumber: false
    },
    {
      id: "q5",
      name: "Numerical Near-Miss",
      tenant: "tenant-alpha",
      prompt: "What is the monthly fee for the 500 user tier?",
      cachedPrompt: "What is the monthly fee for the 50 user tier?",
      similarity: 0.93,
      isExact: false,
      diffTenant: false,
      diffRev: false,
      isNegation: false,
      isNumber: true
    },
    {
      id: "q6",
      name: "Stale Source Revision",
      tenant: "tenant-alpha",
      prompt: "What is the return policy for defective laptops?",
      cachedPrompt: "What is the return policy for defective laptops?",
      similarity: 1.0,
      isExact: true,
      diffTenant: false,
      diffRev: true,
      isNegation: false,
      isNumber: false
    }
  ];

  const controls = [
    {
      key: "threshold",
      label: "Semantic similarity threshold",
      type: "range",
      value: 0.85,
      min: 0.50,
      max: 1.00,
      step: 0.05
    },
    {
      key: "tenantIsolation",
      label: "Enforce strict tenant isolation",
      type: "checkbox",
      value: true
    },
    {
      key: "revisionFreshness",
      label: "Enforce source-revision freshness",
      type: "checkbox",
      value: true
    },
    {
      key: "blockNumbers",
      label: "Block numerical near-misses ($50 vs $500)",
      type: "checkbox",
      value: true
    },
    {
      key: "blockNegation",
      label: "Block inverted negation ('deploy' vs 'do not deploy')",
      type: "checkbox",
      value: true
    },
    {
      key: "strictGate",
      label: "Enforce strict CI zero-false-hits gate",
      type: "checkbox",
      value: true
    }
  ];

  const calculate = function (v) {
    let exactHits = 0;
    let semanticHits = 0;
    let safeMisses = 0;
    let falseHits = 0;
    let blockedNearMisses = 0;

    const rows = [];

    benchmarkQueries.forEach(function (q) {
      let outcome = "MISS";
      let reason = "Safe miss";
      let isFalseHit = false;

      if (q.diffTenant && !v.tenantIsolation) {
        outcome = "HIT-CROSS-TENANT";
        reason = "Privacy leak: cross-tenant reuse!";
        isFalseHit = true;
      } else if (q.diffRev && !v.revisionFreshness) {
        outcome = "HIT-STALE";
        reason = "Stale answer: revision mismatch!";
        isFalseHit = true;
      } else if (q.isExact && !q.diffTenant && !q.diffRev) {
        outcome = "HIT-EXACT";
        reason = "Exact identity match";
      } else if (!q.diffTenant && !q.diffRev && q.similarity >= v.threshold) {
        if (q.isNegation && v.blockNegation) {
          outcome = "MISS";
          reason = "Blocked: negation inversion";
          blockedNearMisses++;
        } else if (q.isNegation && !v.blockNegation) {
          outcome = "HIT-FALSE";
          reason = "Hallucination: negation inverted!";
          isFalseHit = true;
        } else if (q.isNumber && v.blockNumbers) {
          outcome = "MISS";
          reason = "Blocked: numerical mismatch";
          blockedNearMisses++;
        } else if (q.isNumber && !v.blockNumbers) {
          outcome = "HIT-FALSE";
          reason = "Hallucination: number mismatch ($50 vs $500)!";
          isFalseHit = true;
        } else {
          outcome = "HIT-SEMANTIC";
          reason = "Safe semantic paraphrase";
        }
      }

      if (isFalseHit) {
        falseHits++;
      } else if (outcome === "HIT-EXACT") {
        exactHits++;
      } else if (outcome === "HIT-SEMANTIC") {
        semanticHits++;
      } else {
        safeMisses++;
      }

      rows.push({
        name: q.name,
        similarity: q.similarity.toFixed(2),
        outcome: outcome,
        audit: reason
      });
    });

    const totalValidHits = exactHits + semanticHits;
    const latencySaved = totalValidHits * 350;
    const gatePassed = !v.strictGate || falseHits === 0;

    let summary = "";
    if (falseHits > 0) {
      summary = "CRITICAL: " + falseHits + " false cache hit(s) detected! Unsafe responses served to users. CI gate " + (v.strictGate ? "FAILED." : "DISABLED.");
    } else {
      summary = "SAFE: Zero false hits. " + totalValidHits + " queries safely served from cache, saving " + latencySaved + " ms. CI gate PASSED.";
    }

    return {
      summary: summary,
      metrics: [
        { label: "Exact Hits", value: exactHits },
        { label: "Semantic Hits", value: semanticHits },
        { label: "Safe Misses", value: safeMisses },
        { label: "False Hits", value: falseHits },
        { label: "CI Gate", value: gatePassed ? "PASS" : "FAIL" }
      ],
      bars: [
        { label: "Valid Hits", value: totalValidHits, max: benchmarkQueries.length },
        { label: "Safe Misses", value: safeMisses, max: benchmarkQueries.length },
        { label: "False Hits", value: falseHits, max: benchmarkQueries.length }
      ],
      columns: [
        { key: "name", label: "Query Scenario" },
        { key: "similarity", label: "Cosine Sim" },
        { key: "outcome", label: "Cache Status" },
        { key: "audit", label: "Audit Decision" }
      ],
      rows: rows
    };
  };

  const steps1 = [
    { label: "Identity & Freshness", detail: "compute_exact_key, is_fresh, validate_cache_request" },
    { label: "Bind identity", detail: "Construct deterministic SHA-256 keys binding tenant ID, model, source revision, and TTL." },
    { label: "Observe outcome", detail: "Guarantees complete cryptographic partition isolation across multiple tenants." }
  ];

  const steps2 = [
    { label: "Exact Store & Eviction", detail: "ExactCacheStore.get, put, invalidate_tenant, invalidate_source_revision" },
    { label: "Store & Invalidate", detail: "In-memory dictionary store supporting lazy TTL eviction and bulk scoped purges." },
    { label: "Observe outcome", detail: "Purging a tenant or updating documentation instantly invalidates all associated entries." }
  ];

  const steps3 = [
    { label: "Semantic Match & Guardrails", detail: "compute_tf_vector, cosine_similarity, check_adversarial_near_miss" },
    { label: "Filter Near-Misses", detail: "Evaluate cosine similarity within tenant partition while rejecting numbers, negation, and antonym swaps." },
    { label: "Observe outcome", detail: "Enables safe paraphrase reuse without hallucinating answers for critical near-miss questions." }
  ];

  const steps4 = [
    { label: "HTTP Adapter & Benchmark", detail: "CacheAdapter.handle_request, run_correctness_benchmark, export_report" },
    { label: "Export & Gate", detail: "Transparent HTTP caching headers, audit receipts, and automated CI correctness gate." },
    { label: "Observe outcome", detail: "Continuous verification that false cache hits remain strictly at zero." }
  ];

  window.AIFSProjectFigures.register("pj-semantic-cache-correctness-lab-1", {
    title: "Enforce identity, freshness and tenant boundaries",
    steps: steps1,
    caption: "Cryptographic cache keys enforce complete tenant partition isolation.",
    lab: { controls: controls, calculate: calculate }
  });

  window.AIFSProjectFigures.register("pj-semantic-cache-correctness-lab-2", {
    title: "Implement exact-match lookup and scoped invalidation",
    steps: steps2,
    caption: "Exact lookup with automatic TTL expiry and scoped tenant invalidation.",
    lab: { controls: controls, calculate: calculate }
  });

  window.AIFSProjectFigures.register("pj-semantic-cache-correctness-lab-3", {
    title: "Evaluate semantic candidates against adversarial near-miss pairs",
    steps: steps3,
    caption: "Reject false cache hits on inverted negation and altered numbers.",
    lab: { controls: controls, calculate: calculate }
  });

  window.AIFSProjectFigures.register("pj-semantic-cache-correctness-lab-4", {
    title: "Export a bounded HTTP adapter and correctness report",
    steps: steps4,
    caption: "HTTP proxy adapter with audit headers and zero-false-hit benchmark report.",
    lab: { controls: controls, calculate: calculate }
  });
})();
