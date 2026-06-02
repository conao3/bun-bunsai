import { describe } from "bun:test";
import { loadSuites, runSuites } from "./runner.ts";

const inputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/input/query.json",
);
const outputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/output/query.json",
);

describe("conformance query input", () => {
  runSuites("input", inputSuites);
});

describe("conformance query output", () => {
  runSuites("output", outputSuites);
});
