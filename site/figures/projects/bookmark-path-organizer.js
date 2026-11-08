window.AIFSProjectFigures.register("pj-bookmark-path-organizer-1", {
  title: "Import bookmarks with their original hierarchy",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Flatten a folder tree while keeping original URLs and every ancestor folder.",
    },
    { label: "Compute", detail: "importBookmarks(input: unknown): Bookmark[]" },
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
        key: "folder",
        label: "Ancestor path",
        type: "text",
        value: "Maps/Basics",
      },
      {
        key: "title",
        label: "Bookmark title",
        type: "text",
        value: "Coordinates",
      },
    ],
    calculate(v) {
      const p = v.folder.split("/").filter(Boolean);
      return {
        summary: "Flattening retains each ancestor.",
        metrics: [{ label: "Depth", value: p.length }],
        columns: ["Field", "Value"],
        rows: [
          ["title", v.title],
          ["folders", JSON.stringify(p)],
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-bookmark-path-organizer-2", {
  title: "Normalize links and explain duplicate groups",
  steps: [
    {
      label: "Read evidence",
      detail: "Explain exactly why two saved links point at the same document.",
    },
    {
      label: "Compute",
      detail:
        "normalizeURL(value: string): string; groupDuplicates(items: Bookmark[]): Group[]",
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
        key: "url",
        label: "Saved URL",
        type: "text",
        value: "https://EXAMPLE.invalid:443/maps#intro",
      },
    ],
    calculate(v) {
      try {
        const u = new URL(v.url);
        if (
          !["http:", "https:"].includes(u.protocol) ||
          u.username ||
          u.password
        )
          throw Error();
        u.hash = "";
        return {
          summary:
            "Only the fragment is discarded beyond URL parser normalization.",
          columns: ["Original", "Group key"],
          rows: [[v.url, u.href]],
        };
      } catch {
        return { summary: "Reject this URL." };
      }
    },
  },
});

window.AIFSProjectFigures.register("pj-bookmark-path-organizer-3", {
  title: "Rank topics and assemble a reading path",
  steps: [
    {
      label: "Read evidence",
      detail: "Rank a reading collection with visible keyword evidence.",
    },
    {
      label: "Compute",
      detail:
        "readingPath(groups: Group[], topics: Record<string,string[]>): Reading[]",
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
      { key: "title", label: "Title", type: "text", value: "Map basics" },
      {
        key: "notes",
        label: "Notes",
        type: "text",
        value: "Read this map first",
      },
    ],
    calculate(v) {
      const has = (s) =>
        (s.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).includes("map");
      const a = has(v.title) ? 3 : 0,
        b = has(v.notes) ? 1 : 0;
      return {
        summary: "Topic keyword: map",
        metrics: [{ label: "Score", value: a + b }],
        bars: [
          { label: "Title", value: a, max: 4 },
          { label: "Notes", value: b, max: 4 },
        ],
      };
    },
  },
});

window.AIFSProjectFigures.register("pj-bookmark-path-organizer-4", {
  title: "Export an editable collection and progress file",
  steps: [
    {
      label: "Read evidence",
      detail:
        "Carry reading order and completion between a browser review and the next command.",
    },
    {
      label: "Compute",
      detail:
        "applyProgress(items: Reading[], value?: unknown): {items: Reading[]; progress: Progress}; renderCollection(items: Reading[], progress: Progress): string",
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
        key: "completed",
        label: "Completed IDs (comma separated)",
        type: "text",
        value: "a,b",
      },
    ],
    calculate(v) {
      const ids = v.completed
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
        ok =
          new Set(ids).size === ids.length &&
          ids.every((x) => ["a", "b", "c"].includes(x));
      return {
        summary: ok ? "Progress accepted." : "Reject unknown or duplicate IDs.",
        metrics: [
          { label: "Completed", value: ok ? ids.length : 0 },
          { label: "Remaining", value: ok ? 3 - ids.length : 3 },
        ],
      };
    },
  },
});
