import { expect, test } from "bun:test"
import { rules } from "./catalog"

test("alert names are unique", () => {
  const names = rules.map((rule) => rule.alert)
  expect(new Set(names).size).toBe(names.length)
})
