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

## Refreshing

Re-run with the same GitHub Contents API + raw.githubusercontent.com flow
against a newer tag, then update the tag / commit / fetch date in this file.
The fetch is a verbatim copy, so refreshing is a matter of re-downloading and
diffing.
