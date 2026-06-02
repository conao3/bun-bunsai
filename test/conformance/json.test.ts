import { describe } from "bun:test";
import { loadSuites, runSuites } from "./runner.ts";

const inputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/input/json.json",
);
const outputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/output/json.json",
);

describe("conformance json input", () => {
  runSuites("input", inputSuites);
});

describe("conformance json output", () => {
  runSuites("output", outputSuites);
});
