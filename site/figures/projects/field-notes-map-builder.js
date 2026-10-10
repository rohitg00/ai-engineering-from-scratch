window.AIFSProjectFigures.register("pj-field-notes-map-builder-1", {
  title: "Import coordinates, timestamps and evidence",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Keep each location and its original evidence as an independent observation.",
    },
    {
      label: "Compute",
      detail: "importObservations(value: unknown): Observation[]",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      { key: "lon", label: "Longitude", type: "number", value: 77.59 },
      { key: "lat", label: "Latitude", type: "number", value: 12.97 },
    ],
    calculate(v) {
      const ok = Math.abs(v.lon) <= 180 && Math.abs(v.lat) <= 90;
      return {
        summary: ok
          ? "Valid WGS84 coordinates."
          : "Reject out-of-range location.",
        columns: ["GeoJSON coordinate array"],
        rows: [[JSON.stringify([v.lon, v.lat])]],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-field-notes-map-builder-2", {
  title: "Compute distances and explain nearby groups",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Group nearby records using a reproducible distance rule and retained pairwise evidence.",
    },
    {
      label: "Compute",
      detail:
        "distanceMeters(a,b): number; groupNearby(items:Observation[],radiusMeters:number):Groups",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      {
        key: "delta",
        label: "Longitude separation at equator (degrees)",
        type: "range",
        value: 0.001,
        min: 0,
        max: 0.01,
        step: 0.0001,
      },
      {
        key: "radius",
        label: "Grouping radius (meters)",
        type: "range",
        value: 120,
        min: 0,
        max: 1200,
        step: 10,
      },
    ],
    calculate(v) {
      const d = ((6371008.8 * Math.PI) / 180) * v.delta;
      return {
        summary:
          d <= v.radius
            ? "Add a nearby edge."
            : "Keep these points disconnected.",
        metrics: [
          { label: "Distance", value: d.toFixed(2) + " m" },
          { label: "Radius", value: v.radius + " m" },
        ],
        bars: [
          { label: "Distance", value: d, max: 1200 },
          { label: "Threshold", value: v.radius, max: 1200 },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-field-notes-map-builder-3", {
  title: "Review groups without merging observations",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Let reviewers split a computed group without deleting any observation.",
    },
    {
      label: "Compute",
      detail:
        "reviewGroups(groups:Groups,value?:unknown):{schemaVersion:1;groups;decisions}",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      {
        key: "members",
        label: "Component members",
        type: "range",
        value: 3,
        min: 1,
        max: 10,
        step: 1,
      },
      { key: "split", label: "Keep separate", type: "checkbox", value: true },
    ],
    calculate(v) {
      return {
        summary: "Review changes groups without deleting evidence.",
        metrics: [
          { label: "Exported groups", value: v.split ? v.members : 1 },
          { label: "Original observations", value: v.members },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-field-notes-map-builder-4", {
  title: "Export GeoJSON and a portable map report",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Produce a mapping interchange artifact and a reviewable offline map.",
    },
    {
      label: "Compute",
      detail:
        "exportGeoJSON(items:Observation[],review):{type:string;features:any[]}; renderMap(items,groups,review):string",
    },
    {
      label: "Inspect result",
      detail: "Change an input and explain the resulting decision.",
    },
  ],
  caption:
    "Original calculated teaching mechanism. Real exported artifacts come from the TypeScript implementation.",
  lab: {
    controls: [
      { key: "lon", label: "Longitude", type: "number", value: -179.999 },
      {
        key: "origin",
        label: "First observation longitude",
        type: "number",
        value: 179.999,
      },
    ],
    calculate(v) {
      const x = v.origin + ((v.lon - v.origin + 540) % 360) - 180;
      return {
        summary:
          "Unwrap around the first point for the schematic view; keep original GeoJSON coordinates.",
        metrics: [
          { label: "Display longitude", value: x.toFixed(3) },
          { label: "Export longitude", value: v.lon },
        ],
      };
    },
  },
});
