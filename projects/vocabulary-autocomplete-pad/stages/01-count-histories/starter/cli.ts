import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { train, importModel, completeText, renderPad } from "./main.ts";
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
  const model = data.model ? importModel(data.model) : train(data.corpus);
  const result = completeText(model, data.text ?? "");
  await save("vocabulary-model.json", model);
  await save("suggestions.json", result);
  await save("report.html", renderPad(model, data.text ?? ""));
  console.log(
    JSON.stringify(
      { vocabulary: Object.keys(model.words).length, ...result, output },
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
