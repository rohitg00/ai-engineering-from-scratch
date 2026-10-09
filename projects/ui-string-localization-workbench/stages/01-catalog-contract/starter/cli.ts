import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import {
  readCatalog,
  proposeTranslations,
  reviewTranslations,
  renderWorkbench,
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
  const messages = readCatalog(data.messages),
    proposals = proposeTranslations(messages, data.proposals, data.locale),
    state = reviewTranslations(messages, proposals, review);
  await save("locale.json", state.catalog);
  await save("unresolved-strings.json", state.unresolved);
  await save("locale-review.json", state.review);
  await save(
    "report.html",
    renderWorkbench(messages, proposals, state, data.locale, data.values ?? {}),
  );
  console.log(
    JSON.stringify(
      {
        locale: data.locale,
        approved: Object.keys(state.catalog),
        unresolved: state.unresolved,
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
