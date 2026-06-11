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
  athena.json          # botocore/data/athena/2017-05-18/service-2.json         (protocol json)
  glue.json            # botocore/data/glue/2017-03-31/service-2.json           (protocol json)
  elasticache.json     # botocore/data/elasticache/2015-02-02/service-2.json    (protocol query)
  efs.json             # botocore/data/efs/2015-02-01/service-2.json            (protocol rest-json)
  elbv2.json           # botocore/data/elasticloadbalancingv2/2015-12-01/service-2.json (protocol query)
  kinesis.json         # botocore/data/kinesis/2013-12-02/service-2.json        (protocol json)
  firehose.json        # botocore/data/firehose/2015-08-04/service-2.json       (protocol json)
  ecs.json             # botocore/data/ecs/2014-11-13/service-2.json            (protocol json)
  organizations.json   # botocore/data/organizations/2016-11-28/service-2.json  (protocol json)
  cloudfront.json      # botocore/data/cloudfront/2020-05-31/service-2.json     (protocol rest-xml)
  batch.json           # botocore/data/batch/2016-08-10/service-2.json          (protocol rest-json)
  redshift.json        # botocore/data/redshift/2012-12-01/service-2.json       (protocol query)
  acm.json             # botocore/data/acm/2015-12-08/service-2.json            (protocol json)
  cloudtrail.json      # botocore/data/cloudtrail/2013-11-01/service-2.json     (protocol json)
  opensearch.json      # botocore/data/opensearch/2021-01-01/service-2.json      (protocol rest-json)
  wafv2.json           # botocore/data/wafv2/2019-07-29/service-2.json           (protocol json)
  scheduler.json       # botocore/data/scheduler/2021-06-30/service-2.json       (protocol rest-json)
  sagemaker.json       # botocore/data/sagemaker/2017-07-24/service-2.json       (protocol json)
  mq.json              # botocore/data/mq/2017-11-27/service-2.json              (protocol rest-json)
  eks.json             # botocore/data/eks/2017-11-01/service-2.json             (protocol rest-json)
  appsync.json         # botocore/data/appsync/2017-07-25/service-2.json         (protocol rest-json)
  codebuild.json       # botocore/data/codebuild/2016-10-06/service-2.json       (protocol json)
  codedeploy.json      # botocore/data/codedeploy/2014-10-06/service-2.json      (protocol json)
  codepipeline.json    # botocore/data/codepipeline/2015-07-09/service-2.json    (protocol json)
  transfer.json        # botocore/data/transfer/2018-11-05/service-2.json        (protocol json)
  codecommit.json      # botocore/data/codecommit/2015-04-13/service-2.json      (protocol json)
  backup.json          # botocore/data/backup/2018-11-15/service-2.json          (protocol rest-json)
  fsx.json             # botocore/data/fsx/2018-03-01/service-2.json             (protocol json)
  datasync.json        # botocore/data/datasync/2018-11-09/service-2.json        (protocol json)
  elasticbeanstalk.json # botocore/data/elasticbeanstalk/2010-12-01/service-2.json (protocol query)
  apprunner.json        # botocore/data/apprunner/2020-05-15/service-2.json        (protocol json)
  servicediscovery.json # botocore/data/servicediscovery/2017-03-14/service-2.json (protocol json)
  memorydb.json         # botocore/data/memorydb/2021-01-01/service-2.json         (protocol json)
  dax.json              # botocore/data/dax/2017-04-19/service-2.json              (protocol json)
  keyspaces.json        # botocore/data/keyspaces/2022-02-10/service-2.json        (protocol json, signingName cassandra)
  emr.json              # botocore/data/emr/2009-03-31/service-2.json              (protocol json, signingName elasticmapreduce)
  amplify.json          # botocore/data/amplify/2017-07-25/service-2.json          (protocol rest-json)
  appconfig.json        # botocore/data/appconfig/2019-10-09/service-2.json        (protocol rest-json)
  pinpoint.json         # botocore/data/pinpoint/2016-12-01/service-2.json         (protocol rest-json, signingName mobiletargeting)
  config.json           # botocore/data/config/2014-11-12/service-2.json           (protocol json, endpointPrefix config, targetPrefix StarlingDoveService)
  guardduty.json        # botocore/data/guardduty/2017-11-28/service-2.json        (protocol rest-json)
  resourcegroups.json   # botocore/data/resource-groups/2017-11-27/service-2.json  (protocol rest-json, signingName resource-groups)
  globalaccelerator.json # botocore/data/globalaccelerator/2018-08-08/service-2.json (protocol json, targetPrefix GlobalAccelerator_V20180706)
  directconnect.json    # botocore/data/directconnect/2012-10-25/service-2.json    (protocol json, targetPrefix OvertureService)
  swf.json              # botocore/data/swf/2012-01-25/service-2.json              (protocol json, targetPrefix SimpleWorkflowService)
  datapipeline.json     # botocore/data/datapipeline/2012-10-29/service-2.json     (protocol json, targetPrefix DataPipeline)
  servicecatalog.json   # botocore/data/servicecatalog/2015-12-10/service-2.json   (protocol json, targetPrefix AWS242ServiceCatalogService)
  mediastore.json       # botocore/data/mediastore/2017-09-01/service-2.json       (protocol json, targetPrefix MediaStore_20170901)
  shield.json           # botocore/data/shield/2016-06-02/service-2.json           (protocol json, targetPrefix AWSShield_20160616)
  fms.json              # botocore/data/fms/2018-01-01/service-2.json              (protocol json, targetPrefix AWSFMS_20180101)
  licensemanager.json   # botocore/data/license-manager/2018-08-01/service-2.json  (protocol json, signingName license-manager, targetPrefix AWSLicenseManager)
  workspaces.json       # botocore/data/workspaces/2015-04-08/service-2.json       (protocol json, targetPrefix WorkspacesService)
  appstream.json        # botocore/data/appstream/2016-12-01/service-2.json        (protocol json, signingName appstream, endpointPrefix appstream2, targetPrefix PhotonAdminProxyService)
  storagegateway.json   # botocore/data/storagegateway/2013-06-30/service-2.json   (protocol json, targetPrefix StorageGateway_20130630)
  transcribe.json       # botocore/data/transcribe/2017-10-26/service-2.json       (protocol json, targetPrefix Transcribe)
  forecast.json         # botocore/data/forecast/2018-06-26/service-2.json         (protocol json, targetPrefix AmazonForecast)
  kendra.json           # botocore/data/kendra/2019-02-03/service-2.json           (protocol json, targetPrefix AWSKendraFrontendService)
  personalize.json      # botocore/data/personalize/2018-05-22/service-2.json      (protocol json, targetPrefix AmazonPersonalize)
  budgets.json          # botocore/data/budgets/2016-10-20/service-2.json          (protocol json, targetPrefix AWSBudgetServiceGateway)
  accessanalyzer.json   # botocore/data/accessanalyzer/2019-11-01/service-2.json   (protocol rest-json, endpointPrefix access-analyzer, signingName access-analyzer)
  networkmanager.json   # botocore/data/networkmanager/2019-07-05/service-2.json   (protocol rest-json, endpointPrefix networkmanager, signingName networkmanager)
  imagebuilder.json     # botocore/data/imagebuilder/2019-12-02/service-2.json     (protocol rest-json, endpointPrefix imagebuilder, signingName imagebuilder)
  detective.json        # botocore/data/detective/2018-10-26/service-2.json        (protocol rest-json, endpointPrefix api.detective, signingName detective)
  signer.json           # botocore/data/signer/2017-08-25/service-2.json           (protocol rest-json, endpointPrefix signer, signingName signer)
  dlm.json              # botocore/data/dlm/2018-01-12/service-2.json              (protocol rest-json, endpointPrefix dlm, signingName dlm)
  mediapackage.json     # botocore/data/mediapackage/2017-10-12/service-2.json     (protocol rest-json, endpointPrefix mediapackage, signingName mediapackage)
  greengrass.json       # botocore/data/greengrass/2017-06-07/service-2.json       (protocol rest-json, endpointPrefix greengrass, signingName greengrass)
  medialive.json        # botocore/data/medialive/2017-10-14/service-2.json        (protocol rest-json, endpointPrefix medialive, signingName medialive)
  appmesh.json          # botocore/data/appmesh/2019-01-25/service-2.json          (protocol rest-json, endpointPrefix appmesh, signingName appmesh)
  codeartifact.json     # botocore/data/codeartifact/2018-09-22/service-2.json     (protocol rest-json, endpointPrefix codeartifact, signingName codeartifact)
  iotevents.json        # botocore/data/iotevents/2018-07-27/service-2.json        (protocol rest-json, endpointPrefix iotevents, signingName iotevents)
  iotsitewise.json      # botocore/data/iotsitewise/2019-12-02/service-2.json      (protocol rest-json, endpointPrefix iotsitewise, signingName iotsitewise)
  ssm-contacts.json     # botocore/data/ssm-contacts/2021-05-03/service-2.json     (protocol json, endpointPrefix ssm-contacts, signingName ssm-contacts, targetPrefix SSMContacts)
  ivs.json              # botocore/data/ivs/2020-07-14/service-2.json              (protocol rest-json, endpointPrefix ivs, signingName ivs)
  frauddetector.json    # botocore/data/frauddetector/2019-11-15/service-2.json    (protocol json, endpointPrefix frauddetector, targetPrefix AWSHawksNestServiceFacade)
  comprehend.json       # botocore/data/comprehend/2017-11-27/service-2.json       (protocol json, endpointPrefix comprehend, signingName comprehend, targetPrefix Comprehend_20171127)
  mediatailor.json      # botocore/data/mediatailor/2018-04-23/service-2.json      (protocol rest-json, endpointPrefix api.mediatailor, signingName mediatailor)
  dataexchange.json     # botocore/data/dataexchange/2017-07-25/service-2.json     (protocol rest-json, endpointPrefix dataexchange, signingName dataexchange)
  groundstation.json    # botocore/data/groundstation/2019-05-23/service-2.json    (protocol rest-json, endpointPrefix groundstation, signingName groundstation)
  wisdom.json           # botocore/data/wisdom/2020-10-19/service-2.json           (protocol rest-json, endpointPrefix wisdom, signingName wisdom)
  mwaa.json             # botocore/data/mwaa/2020-07-01/service-2.json             (protocol rest-json, endpointPrefix airflow, signingName airflow)
  voiceid.json          # botocore/data/voice-id/2021-09-27/service-2.json         (protocol json, endpointPrefix voiceid, signingName voiceid, targetPrefix VoiceID)
  ssm-incidents.json    # botocore/data/ssm-incidents/2018-05-10/service-2.json    (protocol rest-json, endpointPrefix ssm-incidents, signingName ssm-incidents)
  outposts.json         # botocore/data/outposts/2019-12-03/service-2.json         (protocol rest-json, endpointPrefix outposts, signingName outposts)
  lakeformation.json    # botocore/data/lakeformation/2017-03-31/service-2.json    (protocol rest-json, endpointPrefix lakeformation, signingName lakeformation)
  emr-serverless.json   # botocore/data/emr-serverless/2021-07-13/service-2.json   (protocol rest-json, endpointPrefix emr-serverless, signingName emr-serverless)
  connect.json          # botocore/data/connect/2017-08-08/service-2.json          (protocol rest-json, endpointPrefix connect, signingName connect)
  lexv2.json            # botocore/data/lex-models-v2/2020-08-07/service-2.json    (protocol rest-json, endpointPrefix models-v2-lex, signingName lex)
  pinpoint-sms-voice-v2.json # botocore/data/pinpoint-sms-voice-v2/2022-03-31/service-2.json (protocol json, endpointPrefix sms-voice, signingName sms-voice, targetPrefix PinpointSMSVoiceV2)
  ram.json              # botocore/data/ram/2018-01-04/service-2.json              (protocol rest-json, endpointPrefix ram, signingName ram)
  network-firewall.json # botocore/data/network-firewall/2020-11-12/service-2.json (protocol json, endpointPrefix network-firewall, signingName network-firewall, targetPrefix NetworkFirewall_20201112)
  schemas.json          # botocore/data/schemas/2019-12-02/service-2.json          (protocol rest-json, endpointPrefix schemas, signingName schemas)
  autoscaling.json      # botocore/data/autoscaling/2011-01-01/service-2.json      (protocol query, signingName autoscaling)
  cognito-identity.json # botocore/data/cognito-identity/2014-06-30/service-2.json  (protocol json, signingName cognito-identity)
  pipes.json            # botocore/data/pipes/2015-10-07/service-2.json             (protocol rest-json, signingName pipes; Amazon EventBridge Pipes)
  apigatewayv2.json     # botocore/data/apigatewayv2/2018-11-29/service-2.json      (protocol rest-json, signingName apigateway; API Gateway v2)
  route53resolver.json  # botocore/data/route53resolver/2018-04-01/service-2.json   (protocol json, signingName route53resolver)
  application-autoscaling.json # botocore/data/application-autoscaling/2016-02-06/service-2.json (protocol json, signingName application-autoscaling, targetPrefix AnyScaleFrontendService)
  xray.json             # botocore/data/xray/2016-04-12/service-2.json             (protocol rest-json, signingName xray)
  kinesisanalyticsv2.json # botocore/data/kinesisanalyticsv2/2018-05-23/service-2.json (protocol json, signingName kinesisanalytics, endpointPrefix kinesisanalytics, targetPrefix KinesisAnalytics_20180523)
```

### Notes

- Each file is the upstream `service-2.json` ( `{ metadata, operations, shapes }` )
  byte-for-byte. bunsai's `apps/server/src/core/shapes.ts` loads them at runtime
  and normalizes the shapes dict into a common `ShapeRegistry`.
- Apache-2.0 attribution is satisfied by the co-located
  `botocore-protocol-tests/LICENSE.txt` / `NOTICE` and the root `NOTICE`, which
  already propagate the Botocore attribution for all vendored botocore data.

## localstack-snapshots/

|               |                                                                                                                                                                                                     |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Upstream repo | https://github.com/localstack/localstack                                                                                                                                                            |
| License       | Apache-2.0                                                                                                                                                                                          |
| Pinned tag    | `v3.8.1`                                                                                                                                                                                            |
| Commit hash   | `529aba7d8372e9199f42a31a6500071363ad8c18`                                                                                                                                                          |
| Source path   | `tests/aws/services/{sqs,sns,lambda_}/*.snapshot.json`                                                                                                                                              |
| Fetched on    | 2026-06-11 (JST)                                                                                                                                                                                    |
| Method        | GitHub Contents API (`api.github.com/repos/localstack/localstack/contents/...?ref=<tag>`) for the file listing, `raw.githubusercontent.com/localstack/localstack/<commit>/...` for the bytes |

### Layout

```
localstack-snapshots/
  sqs/
    test_sqs.snapshot.json           # snapshot responses for tests/aws/services/sqs/test_sqs.py
    test_sqs_move_task.snapshot.json # snapshot responses for tests/aws/services/sqs/test_sqs_move_task.py
  sns/
    test_sns.snapshot.json           # snapshot responses for tests/aws/services/sns/test_sns.py
    test_sns_filter_policy.snapshot.json
  lambda/
    test_lambda.snapshot.json
    test_lambda_api.snapshot.json    # snapshot responses for tests/aws/services/lambda_/test_lambda_api.py
    test_lambda_common.snapshot.json
    test_lambda_destinations.snapshot.json
    test_lambda_runtimes.snapshot.json
  LICENSE.txt                        # upstream Apache-2.0 license text
```

### Notes

- Each `.snapshot.json` is a dict keyed by `tests/aws/services/<svc>/test_<name>.py::<Class>::<method>[<variant>]`.
  Values are `{ "recorded-date": "...", "recorded-content": { "<label>": <response> } }` where each
  `<response>` is the raw boto3 response dict recorded against real AWS.
- Placeholder tokens in the responses: `<resource:N>`, `<partition>`, `<region>`, `"timestamp"`,
  `"date"`, `<code-sha256:N>`, `<uuid:N>` etc. — these are localstack's own normalizers applied at
  record time to make snapshots region/account-agnostic.
- Apache-2.0 attribution is satisfied by the co-located `localstack-snapshots/LICENSE.txt`. The v3.8.1
  tag was chosen because it predates localstack's license change to BSL; the `LICENSE.txt` at that
  commit confirms Apache-2.0.

## Refreshing

Re-run with the same GitHub Contents API + raw.githubusercontent.com flow
against a newer tag, then update the tag / commit / fetch date in this file.
The fetch is a verbatim copy, so refreshing is a matter of re-downloading and
diffing.
