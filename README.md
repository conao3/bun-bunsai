# bunsai

A lightweight, dependency-free local AWS cloud emulator written in [Bun](https://bun.sh) (TypeScript). Think LocalStack, rebuilt from scratch as a single fast Bun process.

`bunsai` ingests the same service definitions the AWS SDK ships internally (botocore `service-2.json` / Smithy models) and drives protocol encoding/decoding from that data, so adding or extending a service is a matter of writing handlers against a model rather than hand-rolling wire formats.

> **Status:** broad and growing — **113 AWS services** registered across all 5 AWS wire protocols, validated by real `@aws-sdk/v3` round-trip tests. Operation coverage is **~58%** (92 services at 100%) and growing via automated PR-driven development. See [STATUS.md](./STATUS.md) for the live coverage dashboard.

## Quick start

```sh
bun install
bun run dev        # starts the AWS gateway + management UI
```

This launches two servers from a single process:

| Port   | Purpose                                                          |
| ------ | ---------------------------------------------------------------- |
| `4566` | AWS gateway — point any AWS SDK / CLI at `http://localhost:4566` |
| `5666` | Management API + React dashboard (`/__bunsai/*`)                 |

Point an AWS SDK client at the gateway:

```ts
import { S3Client, CreateBucketCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  forcePathStyle: true, // bunsai serves S3 path-style
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

await s3.send(new CreateBucketCommand({ Bucket: "my-bucket" }));
```

## How it works

The server resolves every request through a single, model-driven pipeline:

```
request → router (service/region/account)
        → framework.dispatch
            → resolve operation + input/output/error shapes
            → codec.parse  (protocol → JS object)
            → validate     (required members)
            → operation handler  (your logic)
            → codec.serialize (JS object → protocol)
        → request log → Response
```

- **Router** (`core/router.ts`) identifies the target service from the SigV4 credential scope, then falls back to `X-Amz-Target` and `Host`.
- **Shape registry** (`core/shapes.ts`) normalizes botocore/Smithy models into a uniform shape table.
- **Codec** (`core/codec/*`) is a single shape-driven implementation covering all five protocols: `query`, `json` (awsJson), `rest-json`, `rest-xml`, and `ec2`.
- **State store** (`core/state.ts`) is a KV store scoped per `(account, region, service)`.
- **Request log** (`core/log.ts`) records every call and streams it to the dashboard over SSE.

A service is just a plain object:

```ts
const myService = {
  name: "sqs", // AWS signingName (lowercase)
  protocol: "json",
  model: loadServiceModel(sqsModel),
  operations: {
    CreateQueue: (input, ctx, req) => {
      /* ... */
    },
  },
} as const satisfies ServiceDefinition;
```

Handlers receive the parsed input, a `(account, region, service)`-scoped `ctx.store`, and the raw request. Errors are thrown via `awsError(code, message, statusCode)` and serialized into the correct per-protocol shape automatically.

## Architecture

Bun workspaces monorepo:

- **`apps/server`** — the emulator backend. Zero runtime dependencies.
  - `src/core/` — router, framework, shapes, codec, state, log.
  - `src/services/` — one file per AWS service, registered in `services/index.ts`.
- **`apps/dashboard`** — React 19 management UI (served on port `5666`).

### Management API (port 5666)

| Endpoint                                 | Returns                                                           |
| ---------------------------------------- | ----------------------------------------------------------------- |
| `GET /__bunsai/services`                 | registered services with protocol, status, resource & call counts |
| `GET /__bunsai/resources?service=<name>` | stored resources for a service                                    |
| `GET /__bunsai/logs`                     | recent request log entries                                        |
| `GET /__bunsai/logs/stream`              | live request log (SSE)                                            |

## Supported protocols

| Protocol         | Services |
| ---------------- | -------- |
| `json` (awsJson) | 57       |
| `rest-json`      | 42       |
| `query`          | 10       |
| `rest-xml`       | 3        |
| `ec2`            | 1        |

## Testing

Two test layers (see [`STATUS.md`](./STATUS.md)):

- **L0 / e2e** — real `@aws-sdk/v3` clients hit an in-process `bunsai` server on an ephemeral port and assert full round-trips (`test/e2e/`).
- **L1 / conformance** — botocore protocol test suite (`test/conformance/`) drives the codec in-process.

```sh
bun test
```

CI runs `bun test` and a production server build on every push.

> AWS service models under `test/vendor/aws-models/` are vendored verbatim from [botocore](https://github.com/boto/botocore) (tag `1.43.19`, Apache-2.0). See `test/vendor/PROVENANCE.md`.

## License

[Apache-2.0](./LICENSE). Copyright bunsai contributors.
