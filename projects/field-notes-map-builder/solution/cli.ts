import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  importObservations,
  groupNearby,
  reviewGroups,
  exportGeoJSON,
  renderMap,
} from "./main.ts";
async function main() {
  const [input, output = "output", reviewFile] = process.argv.slice(2);
  if (!input || input === "--help") {
    console.log("node cli.ts INPUT.json [OUTPUT_DIRECTORY] [REVIEW.json]");
    return input ? 0 : 2;
  }
  const data = JSON.parse(await readFile(input, "utf8"));
  const review = reviewFile
    ? JSON.parse(await readFile(reviewFile, "utf8"))
    : undefined;
  await mkdir(output, { recursive: true });
  const save = async (name: string, value: any) =>
    writeFile(
      path.join(output, name),
      typeof value === "string" ? value : JSON.stringify(value, null, 2) + "\n",
    );
  const items = importObservations(data.observations),
    groups = groupNearby(items, data.radiusMeters),
    reviewed = reviewGroups(groups, review),
    geo = exportGeoJSON(items, reviewed);
  await save("observations.geojson", geo);
  await save("groups.json", { ...groups, ...reviewed });
  await save("report.html", renderMap(items, groups, reviewed));
  console.log(
    JSON.stringify(
      {
        observations: items.length,
        groups: reviewed.groups,
        edges: groups.edges,
        featureCount: geo.features.length,
        output,
      },
      null,
      2,
    ),
  );
  return 0;
}
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 2;
  });
