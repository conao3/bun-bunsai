# Contributing to bunsai

## Recording parity fixtures against real AWS

Parity fixtures in `test/parity/fixtures/` describe expected AWS API responses.
Most expected values come from OSS data or documentation. When a response can
only be confirmed against a real AWS account, contributors with live credentials
can record them using `maint/bin/record-parity.ts`.

**This is a last resort.** Prefer deriving expected values from AWS documentation
or OSS clients before resorting to live recording.

### When to use this

Record against real AWS only when:

- The expected response field is not documented and cannot be inferred
- The existing fixture has missing or placeholder `expected` values for a step

### Prerequisites

- A real AWS account with credentials configured (any method in the
  [standard SDK credential chain](https://docs.aws.amazon.com/sdkref/latest/guide/standardized-credentials.html))
- The region set via `AWS_DEFAULT_REGION` or `AWS_REGION`
- Permissions to call the operations in the fixture's steps

### Running the script

```sh
# Dry run: review the fixture first
cat test/parity/fixtures/<service>/<fixture>.json

# Record (requires --yes to confirm real AWS calls)
bun maint/bin/record-parity.ts <service> <fixture-path> --yes

# Write to a file instead of stdout
bun maint/bin/record-parity.ts <service> <fixture-path> --yes --out <fixture-path>
```

**Cost notice:** This script calls real AWS endpoints. Only lightweight,
short-lived resources (e.g. a bucket created and then deleted in the same
fixture) are expected. Verify that the fixture's delete steps clean up every
resource before running. You are responsible for any charges incurred.

### What the script does

1. Reads the fixture JSON (steps with `input` and `expected` fields)
2. Executes each step against real AWS using your environment credentials
3. Replaces each `expected` field with the observed response
4. Normalizes dynamic values (`<ANY>`): ISO 8601 timestamps, UUIDs, 12-digit
   AWS account IDs, account IDs embedded in ARNs, and 16-char hex IDs

### Submitting recorded fixtures

Open a PR that includes:

- The updated fixture file(s) under `test/parity/fixtures/`
- A note in the PR description stating which AWS region you recorded in
- Confirmation that you verified the fixture's delete steps cleaned up all
  resources

Label the PR `parity-recording` so maintainers can review the recording context.
