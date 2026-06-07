# bunsai — project status dashboard

> Generated snapshot. Operation coverage advances automatically through PR-driven development (Symphony loop).

## At a glance

| Metric                     | Value                                                                    |
| -------------------------- | ------------------------------------------------------------------------ |
| AWS services registered    | **113**                                                                  |
| Wire protocols supported   | **5** (query, json, rest-json, rest-xml, ec2)                            |
| Operations implemented     | **7225 / 8422**                                                          |
| Overall operation coverage | **85.8%** █████████░                                                     |
| Services at 100%           | **106**                                                                  |
| CI                         | `bun test` → **2000 pass / 86 skip / 0 fail** (224 files) + server build |

### Coverage distribution

| Bucket        | Services |
| ------------- | -------- |
| 100% complete | 106      |
| 50–99%        | 3        |
| 20–49%        | 4        |
| < 20%         | 0        |

## What "100% completeness" means

The north-star goal is a faithful local mock of AWS: every registered service should implement **all** of its modeled operations with stateful, SDK-deserializable responses. Progress is tracked along three axes:

1. **Service breadth** — how many AWS services are registered (currently 113).
2. **Operation depth** — implemented vs. modeled operations per service (the table below).
3. **Behavioral fidelity** — operations back real `ctx.store` state and round-trip through real `@aws-sdk/v3` clients, not just echo stubs.

## Roadmap

The active strategy completes **small / near-complete services first** (maximizing the count of fully-finished services), then medium services, then decomposes the large ones (`ec2` 765 ops, `sagemaker` 396, `connect` 370, `glue` 265) into thematic operation groups.

## Per-service operation coverage

Sorted by completion. `impl/total` counts handler entries vs. modeled operations.

| Service              | Protocol  | Ops     | Coverage |
| -------------------- | --------- | ------- | -------- |
| iam                  | query     | 176/176 | 100%     |
| rds                  | query     | 164/164 | 100%     |
| ssm                  | json      | 146/146 | 100%     |
| redshift             | query     | 141/141 | 100%     |
| cognito-idp          | json      | 126/126 | 100%     |
| apigateway           | rest-json | 124/124 | 100%     |
| medialive            | rest-json | 123/123 | 100%     |
| mobiletargeting      | rest-json | 122/122 | 100%     |
| logs                 | json      | 113/113 | 100%     |
| backup               | rest-json | 109/109 | 100%     |
| lex                  | rest-json | 107/107 | 100%     |
| sms-voice            | json      | 106/106 | 100%     |
| iotsitewise          | rest-json | 104/104 | 100%     |
| config               | json      | 97/97   | 100%     |
| storagegateway       | json      | 96/96   | 100%     |
| networkmanager       | rest-json | 95/95   | 100%     |
| greengrass           | rest-json | 92/92   | 100%     |
| workspaces           | json      | 91/91   | 100%     |
| cloudformation       | query     | 90/90   | 100%     |
| servicecatalog       | json      | 90/90   | 100%     |
| appstream            | json      | 89/89   | 100%     |
| es                   | rest-json | 88/88   | 100%     |
| guardduty            | rest-json | 87/87   | 100%     |
| lambda               | rest-json | 85/85   | 100%     |
| comprehend           | json      | 85/85   | 100%     |
| codecommit           | json      | 79/79   | 100%     |
| network-firewall     | json      | 79/79   | 100%     |
| ecs                  | json      | 77/77   | 100%     |
| imagebuilder         | rest-json | 77/77   | 100%     |
| elasticache          | query     | 75/75   | 100%     |
| appsync              | rest-json | 74/74   | 100%     |
| frauddetector        | json      | 73/73   | 100%     |
| ses                  | query     | 71/71   | 100%     |
| route53              | rest-xml  | 71/71   | 100%     |
| transfer             | json      | 71/71   | 100%     |
| personalize          | json      | 71/71   | 100%     |
| athena               | json      | 70/70   | 100%     |
| kendra               | json      | 66/66   | 100%     |
| eks                  | rest-json | 64/64   | 100%     |
| organizations        | json      | 63/63   | 100%     |
| directconnect        | json      | 63/63   | 100%     |
| forecast             | json      | 63/63   | 100%     |
| license-manager      | json      | 62/62   | 100%     |
| lakeformation        | rest-json | 61/61   | 100%     |
| cloudtrail           | json      | 60/60   | 100%     |
| elasticmapreduce     | json      | 60/60   | 100%     |
| codebuild            | json      | 59/59   | 100%     |
| ecr                  | json      | 58/58   | 100%     |
| dynamodb             | json      | 57/57   | 100%     |
| events               | json      | 57/57   | 100%     |
| globalaccelerator    | json      | 56/56   | 100%     |
| wafv2                | json      | 55/55   | 100%     |
| kms                  | json      | 54/54   | 100%     |
| datasync             | json      | 53/53   | 100%     |
| elasticloadbalancing | query     | 51/51   | 100%     |
| fsx                  | json      | 48/48   | 100%     |
| codeartifact         | rest-json | 48/48   | 100%     |
| mediatailor          | rest-json | 48/48   | 100%     |
| elasticbeanstalk     | query     | 47/47   | 100%     |
| monitoring           | json      | 46/46   | 100%     |
| batch                | rest-json | 45/45   | 100%     |
| memorydb             | json      | 45/45   | 100%     |
| appconfig            | rest-json | 45/45   | 100%     |
| codepipeline         | json      | 44/44   | 100%     |
| transcribe           | json      | 43/43   | 100%     |
| sns                  | query     | 42/42   | 100%     |
| fms                  | json      | 42/42   | 100%     |
| wisdom               | rest-json | 41/41   | 100%     |
| ivs                  | rest-json | 40/40   | 100%     |
| groundstation        | rest-json | 40/40   | 100%     |
| kinesis              | json      | 39/39   | 100%     |
| swf                  | json      | 39/39   | 100%     |
| access-analyzer      | rest-json | 39/39   | 100%     |
| ssm-contacts         | json      | 39/39   | 100%     |
| appmesh              | rest-json | 38/38   | 100%     |
| states               | json      | 37/37   | 100%     |
| apprunner            | json      | 37/37   | 100%     |
| amplify              | rest-json | 37/37   | 100%     |
| dataexchange         | rest-json | 37/37   | 100%     |
| outposts             | rest-json | 37/37   | 100%     |
| shield               | json      | 36/36   | 100%     |
| ram                  | rest-json | 35/35   | 100%     |
| elasticfilesystem    | rest-json | 31/31   | 100%     |
| ssm-incidents        | rest-json | 31/31   | 100%     |
| schemas              | rest-json | 31/31   | 100%     |
| servicediscovery     | json      | 30/30   | 100%     |
| detective            | rest-json | 29/29   | 100%     |
| voiceid              | json      | 29/29   | 100%     |
| budgets              | json      | 26/26   | 100%     |
| iotevents            | rest-json | 26/26   | 100%     |
| mq                   | rest-json | 24/24   | 100%     |
| sqs                  | json      | 23/23   | 100%     |
| secretsmanager       | json      | 23/23   | 100%     |
| resource-groups      | rest-json | 23/23   | 100%     |
| emr-serverless       | rest-json | 22/22   | 100%     |
| dax                  | json      | 21/21   | 100%     |
| mediastore           | json      | 21/21   | 100%     |
| cassandra            | json      | 19/19   | 100%     |
| datapipeline         | json      | 19/19   | 100%     |
| signer               | rest-json | 19/19   | 100%     |
| mediapackage         | rest-json | 19/19   | 100%     |
| acm                  | json      | 17/17   | 100%     |
| firehose             | json      | 12/12   | 100%     |
| scheduler            | rest-json | 12/12   | 100%     |
| airflow              | rest-json | 12/12   | 100%     |
| dlm                  | rest-json | 8/8     | 100%     |
| glue                 | json      | 187/265 | 71%      |
| sagemaker            | json      | 205/396 | 52%      |
| connect              | rest-json | 185/370 | 50%      |
| s3                   | rest-xml  | 53/111  | 48%      |
| sts                  | query     | 4/11    | 36%      |
| ec2                  | ec2       | 209/765 | 27%      |
| cloudfront           | rest-xml  | 45/167  | 27%      |

---

_Models vendored verbatim from botocore 1.43.19 (Apache-2.0). Coverage figures count registered service handlers against the botocore operation set._
