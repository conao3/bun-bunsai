import { describe } from "bun:test";
import { loadSuites, runSuites } from "./runner.ts";

const inputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/input/rest-json.json",
);
const outputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/output/rest-json.json",
);

describe("conformance rest-json input", () => {
  runSuites("input", inputSuites);
});

describe("conformance rest-json output", () => {
  runSuites("output", outputSuites);
});
