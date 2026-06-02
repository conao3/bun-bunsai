# Vendored upstream test data — provenance

All data under `test/vendor/` is fetched from upstream at a pinned ref and
committed verbatim (vendoring). No bunsai-side modification has been applied;
files are byte-for-byte copies of the upstream raw content.

## botocore-protocol-tests/

|               |                                                                                                                                                                              |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream repo | https://github.com/boto/botocore                                                                                                                                             |
| License       | Apache-2.0                                                                                                                                                                   |
| Pinned tag    | `1.43.19`                                                                                                                                                                    |
| Commit hash   | `8fdb47d1636e7f7ae0cacdd4584ffd339f88c546`                                                                                                                                   |
| Source path   | `tests/unit/protocols/`                                                                                                                                                      |
| Fetched on    | 2026-06-02 (JST)                                                                                                                                                             |
| Method        | GitHub Contents API (`api.github.com/repos/boto/botocore/contents/...?ref=<tag>`) for the file listing, `raw.githubusercontent.com/boto/botocore/<commit>/...` for the bytes |

### Layout

```
botocore-protocol-tests/
  input/                 # server deserialize fixtures (serialized request -> params)
    ec2.json
    json.json            # awsJson 1.1
    json_1_0.json        # awsJson 1.0
    json_1_0-query-compatible.json
    query.json
    rest-json.json
    rest-xml.json
    smithy-rpc-v2-cbor.json
    smithy-rpc-v2-cbor-query-compatible.json
    smithy-rpc-v2-cbor-non-query-compatible.json
  output/                # server serialize fixtures (result/error -> serialized response)
    (same file set as input/)
  legacy/
    input/               # ec2 / json / query / rest-json / rest-xml (older fixture shape)
    output/
  protocol-tests-ignore-list.json   # botocore's own skip list
  LICENSE.txt            # upstream Apache-2.0 license text
  NOTICE                 # upstream NOTICE
```

### Notes

- `smithy-rpc-v2-cbor*.json` are vendored for completeness but `rpcv2Cbor` is a
  bunsai known-gap (no CBOR decoder yet); the conformance runner skips them.
- The upstream `LICENSE.txt` and `NOTICE` are co-located in
  `botocore-protocol-tests/` to satisfy Apache-2.0 4(a)/4(d). The root `NOTICE`
  propagates the Botocore attribution.

## aws-models/

|               |                                                                                                                                                |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream repo | https://github.com/boto/botocore                                                                                                               |
| License       | Apache-2.0                                                                                                                                     |
| Pinned tag    | `1.43.19`                                                                                                                                      |
| Commit hash   | `8fdb47d1636e7f7ae0cacdd4584ffd339f88c546`                                                                                                     |
| Source path   | `botocore/data/<service>/<apiVersion>/service-2.json`                                                                                          |
| Fetched on    | 2026-06-02 (JST)                                                                                                                                |
| Method        | GitHub Contents API (`api.github.com/repos/boto/botocore/contents/botocore/data/<service>?ref=<tag>`) to discover the apiVersion directory, then `raw.githubusercontent.com/boto/botocore/<commit>/botocore/data/<service>/<apiVersion>/service-2.json` for the bytes (verbatim) |

### Layout

```
aws-models/
  s3.json              # botocore/data/s3/2006-03-01/service-2.json             (protocol rest-xml)
  sqs.json             # botocore/data/sqs/2012-11-05/service-2.json            (protocol json)
  sts.json             # botocore/data/sts/2011-06-15/service-2.json            (protocol query)
  dynamodb.json        # botocore/data/dynamodb/2012-08-10/service-2.json       (protocol json)
  sns.json             # botocore/data/sns/2010-03-31/service-2.json            (protocol query)
  secretsmanager.json  # botocore/data/secretsmanager/2017-10-17/service-2.json (protocol json)
  ssm.json             # botocore/data/ssm/2014-11-06/service-2.json            (protocol json)
  kms.json             # botocore/data/kms/2014-11-01/service-2.json            (protocol json)
  iam.json             # botocore/data/iam/2010-05-08/service-2.json            (protocol query)
  logs.json            # botocore/data/logs/2014-03-28/service-2.json           (protocol json)
  eventbridge.json     # botocore/data/events/2015-10-07/service-2.json         (protocol json)
  lambda.json          # botocore/data/lambda/2015-03-31/service-2.json         (protocol rest-json)
  cloudwatch.json      # botocore/data/cloudwatch/2010-08-01/service-2.json     (protocol json)
  stepfunctions.json   # botocore/data/stepfunctions/2016-11-23/service-2.json  (protocol json)
  ses.json             # botocore/data/ses/2010-12-01/service-2.json            (protocol query)
  route53.json         # botocore/data/route53/2013-04-01/service-2.json        (protocol rest-xml)
  cloudformation.json  # botocore/data/cloudformation/2010-05-15/service-2.json (protocol query)
  apigateway.json      # botocore/data/apigateway/2015-07-09/service-2.json     (protocol rest-json)
  ec2.json             # botocore/data/ec2/2016-11-15/service-2.json            (protocol ec2)
  rds.json             # botocore/data/rds/2014-10-31/service-2.json            (protocol query)
  ecr.json             # botocore/data/ecr/2015-09-21/service-2.json            (protocol json)
  cognito-idp.json     # botocore/data/cognito-idp/2016-04-18/service-2.json    (protocol json)
```

### Notes

- Each file is the upstream `service-2.json` ( `{ metadata, operations, shapes }` )
  byte-for-byte. bunsai's `apps/server/src/core/shapes.ts` loads them at runtime
  and normalizes the shapes dict into a common `ShapeRegistry`.
- Apache-2.0 attribution is satisfied by the co-located
  `botocore-protocol-tests/LICENSE.txt` / `NOTICE` and the root `NOTICE`, which
  already propagate the Botocore attribution for all vendored botocore data.

## Refreshing

Re-run with the same GitHub Contents API + raw.githubusercontent.com flow
against a newer tag, then update the tag / commit / fetch date in this file.
The fetch is a verbatim copy, so refreshing is a matter of re-downloading and
diffing.
