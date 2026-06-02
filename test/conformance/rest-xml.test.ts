import { describe } from "bun:test";
import { loadSuites, runSuites } from "./runner.ts";

const inputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/input/rest-xml.json",
);
const outputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/output/rest-xml.json",
);

describe("conformance rest-xml input", () => {
  runSuites("input", inputSuites);
});

describe("conformance rest-xml output", () => {
  runSuites("output", outputSuites);
});
