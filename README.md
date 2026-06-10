# bunsai

A stateful AWS mock server built in [Bun](https://bun.sh). Think LocalStack, rebuilt from scratch as a zero-dependency Bun process.

`bunsai` reads the same service definitions the AWS SDK ships internally (botocore `service-2.json` / Smithy models) and drives all protocol encoding/decoding from that model data, so adding or extending a service is a matter of writing handlers — not hand-rolling wire formats.

> **Status:** **113 AWS services** across all 5 AWS wire protocols. Operation coverage is **~86%** (106 services at 100%) and growing via automated PR-driven development. See [STATUS.md](./STATUS.md) for the live coverage table.

## Quick Start

```sh
bun install
bun run dev    # AWS gateway on :4566 + management dashboard on :5666
```

| Port   | Purpose                                          |
| ------ | ------------------------------------------------ |
| `4566` | AWS gateway — point any AWS SDK or CLI here      |
| `5666` | Management API + React dashboard (`/__bunsai/*`) |

Override the default ports with environment variables:

| Variable         | Default | Description             |
| ---------------- | ------- | ----------------------- |
| `BUNSAI_PORT`    | `4566`  | AWS gateway listen port |
| `BUNSAI_UI_PORT` | `5666`  | Dashboard listen port   |

## Pointing Clients at bunsai

bunsai does not validate credentials — any key/secret pair will work.

### AWS CLI

```sh
aws --endpoint-url http://localhost:4566 \
    --region us-east-1 \
    sqs create-queue --queue-name my-queue
```

Pass dummy credentials if not already set in your environment:

```sh
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws --endpoint-url http://localhost:4566 s3 mb s3://my-bucket
```

### AWS SDK v3 (JavaScript / TypeScript)

```ts
import { SQSClient, CreateQueueCommand } from "@aws-sdk/client-sqs";

const sqs = new SQSClient({
  endpoint: "http://localhost:4566",
  region: "us-east-1",
  credentials: { accessKeyId: "test", secretAccessKey: "test" },
});

await sqs.send(new CreateQueueCommand({ QueueName: "my-queue" }));
```

S3 requires `forcePathStyle: true`:

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

### Terraform

```hcl
provider "aws" {
  region                      = "us-east-1"
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3  = "http://localhost:4566"
    sqs = "http://localhost:4566"
    # add other services as needed
  }
}
```

## Dashboard

Open `http://localhost:5666` to access the management dashboard:

- **Overview** — per-service call counts, protocol, and status at a glance.
- **Request Log** — live stream of every AWS API call with request/response detail.
- **Resource Browser** — inspect stored resources for any registered service.
- **Snapshots** — save, restore, and delete named state snapshots.
- **Settings** — runtime configuration.

## State Snapshots

bunsai is in-memory: restarting the process clears all state. Snapshots let you checkpoint and restore the full store without restarting.

Open the **Snapshots** tab in the dashboard to save and restore snapshots interactively, or use the management API directly:

```sh
# Save a snapshot (optional name in body)
curl -X POST http://localhost:5666/__bunsai/snapshots \
  -H 'Content-Type: application/json' \
  -d '{"name": "after-seed"}'

# List saved snapshots
curl http://localhost:5666/__bunsai/snapshots

# Restore a snapshot by id
curl -X POST http://localhost:5666/__bunsai/snapshots/<id>/restore
```

## Scope / Limitations

- **In-memory state** — all resources live in process memory; a restart clears everything. Use [snapshots](#state-snapshots) to mitigate.
- **IAM not enforced** — any credential pair (including `test`/`test`) is accepted; policies are ignored.
- **No `rpcv2Cbor` protocol** — AWS is rolling out a new binary protocol that bunsai does not yet support.
- **No event-stream APIs** — streaming operations such as `Kinesis SubscribeToShard` are not supported.
- **Service fidelity varies** — some services are partial stubs; see [STATUS.md](./STATUS.md) for per-service and per-operation coverage.

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

| Endpoint                             | Method   | Description                                                       |
| ------------------------------------ | -------- | ----------------------------------------------------------------- |
| `/__bunsai/services`                 | `GET`    | registered services with protocol, status, resource & call counts |
| `/__bunsai/resources?service=<name>` | `GET`    | stored resources for a service                                    |
| `/__bunsai/logs`                     | `GET`    | recent request log entries                                        |
| `/__bunsai/logs/stream`              | `GET`    | live request log (SSE)                                            |
| `/__bunsai/snapshots`                | `GET`    | list saved snapshots                                              |
| `/__bunsai/snapshots`                | `POST`   | create a snapshot (`{ name? }` body)                              |
| `/__bunsai/snapshots/<id>`           | `DELETE` | delete a snapshot                                                 |
| `/__bunsai/snapshots/<id>/restore`   | `POST`   | restore a snapshot                                                |

## Supported protocols

| Protocol         | Services |
| ---------------- | -------- |
| `json` (awsJson) | 57       |
| `rest-json`      | 42       |
| `query`          | 10       |
| `rest-xml`       | 3        |
| `ec2`            | 1        |

## Development

Four gates — all must pass before submitting a PR:

```sh
bun test         # e2e round-trips + botocore conformance suite
bun run lint     # TypeScript type check + knip dead-code
bun run fmt      # Prettier (--write; use fmt:check in CI)
bun run build    # production server build
```

Two test layers (see [`STATUS.md`](./STATUS.md)):

- **L0 / e2e** — real `@aws-sdk/v3` clients drive the `bunsai` gateway handler in-process (no HTTP, via a custom `requestHandler`) and assert full round-trips (`test/e2e/`).
- **L1 / conformance** — botocore protocol test suite (`test/conformance/`) drives the codec in-process.

Coverage and gap tools:

```sh
bun maint/bin/coverage.ts          # per-service coverage table
bun maint/bin/missing.ts <service> # list unimplemented operations
```

> AWS service models under `test/vendor/aws-models/` are vendored verbatim from [botocore](https://github.com/boto/botocore) (tag `1.43.19`, Apache-2.0). See `test/vendor/PROVENANCE.md`.

## License

[Apache-2.0](./LICENSE). Copyright bunsai contributors.
