import { describe } from "bun:test";
import { loadSuites, runSuites } from "./runner.ts";

const inputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/input/ec2.json",
);
const outputSuites = await loadSuites(
  "../vendor/botocore-protocol-tests/output/ec2.json",
);

describe("conformance ec2 input", () => {
  runSuites("input", inputSuites);
});

describe("conformance ec2 output", () => {
  runSuites("output", outputSuites);
});
