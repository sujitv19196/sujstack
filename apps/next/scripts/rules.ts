import { renderRules } from "@sujstack/metrics-core"
import { rules } from "../src/server/metrics/catalog"

const file = Bun.file(new URL("../rules.yaml", import.meta.url))
const rendered = renderRules("sujstack", rules)

if (process.argv.includes("--check")) {
  const current = (await file.exists()) ? await file.text() : ""
  if (current !== rendered) {
    console.error("rules.yaml is stale. Run `bun run metrics:rules`.")
    process.exit(1)
  }
  console.info("rules.yaml is up to date.")
} else {
  await Bun.write(file, rendered)
  console.info(`Wrote ${rules.length} rule(s) to rules.yaml.`)
}
