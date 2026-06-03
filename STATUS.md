# bunsai — project status dashboard

> Generated snapshot. Operation coverage advances automatically through PR-driven development (Symphony loop). Re-generate with the coverage script in `.claude-dev/`.

## At a glance

| Metric                     | Value                                                                   |
| -------------------------- | ----------------------------------------------------------------------- |
| AWS services registered    | **113**                                                                 |
| Wire protocols supported   | **5** (query, json, rest-json, rest-xml, ec2)                           |
| Operations implemented     | **1106 / 8422**                                                         |
| Overall operation coverage | **13.1%** █░░░░░░░░░                                                    |
| Services at 100%           | **2** (s3, sts)                                                         |
| CI                         | `bun test` → **797 pass / 86 skip / 0 fail** (162 files) + server build |

### Coverage distribution

| Bucket        | Services |
| ------------- | -------- |
| 100% complete | 2        |
| 50–99%        | 8        |
| 20–49%        | 24       |
| < 20%         | 79       |

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
| s3                   | rest-xml  | 111/111 | 100%     |
| sts                  | query     | 11/11   | 100%     |
| firehose             | json      | 11/12   | 92%      |
| sqs                  | json      | 18/23   | 78%      |
| route53              | rest-xml  | 44/71   | 62%      |
| acm                  | json      | 10/17   | 59%      |
| scheduler            | rest-json | 7/12    | 58%      |
| sns                  | query     | 23/42   | 55%      |
| secretsmanager       | json      | 12/23   | 52%      |
| dlm                  | rest-json | 4/8     | 50%      |
| dynamodb             | json      | 26/57   | 46%      |
| cassandra            | json      | 8/19    | 42%      |
| kinesis              | json      | 16/39   | 41%      |
| states               | json      | 15/37   | 41%      |
| cloudfront           | rest-xml  | 60/167  | 36%      |
| airflow              | rest-json | 4/12    | 33%      |
| batch                | rest-json | 15/45   | 33%      |
| kms                  | json      | 18/54   | 33%      |
| lambda               | rest-json | 26/85   | 31%      |
| events               | json      | 16/57   | 28%      |
| monitoring           | json      | 13/46   | 28%      |
| wafv2                | json      | 15/55   | 27%      |
| mq                   | rest-json | 6/24    | 25%      |
| dax                  | json      | 5/21    | 24%      |
| cloudtrail           | json      | 14/60   | 23%      |
| eks                  | rest-json | 15/64   | 23%      |
| servicediscovery     | json      | 7/30    | 23%      |
| amplify              | rest-json | 8/37    | 22%      |
| resource-groups      | rest-json | 5/23    | 22%      |
| athena               | json      | 15/70   | 21%      |
| datapipeline         | json      | 4/19    | 21%      |
| ecs                  | json      | 16/77   | 21%      |
| mediapackage         | rest-json | 4/19    | 21%      |
| signer               | rest-json | 4/19    | 21%      |
| elasticfilesystem    | rest-json | 6/31    | 19%      |
| iam                  | query     | 34/176  | 19%      |
| mediastore           | json      | 4/21    | 19%      |
| emr-serverless       | rest-json | 4/22    | 18%      |
| appconfig            | rest-json | 7/45    | 16%      |
| apprunner            | json      | 6/37    | 16%      |
| elasticloadbalancing | query     | 8/51    | 16%      |
| budgets              | json      | 4/26    | 15%      |
| elasticache          | query     | 11/75   | 15%      |
| iotevents            | rest-json | 4/26    | 15%      |
| cloudformation       | query     | 13/90   | 14%      |
| codepipeline         | json      | 6/44    | 14%      |
| dataexchange         | rest-json | 5/37    | 14%      |
| logs                 | json      | 16/113  | 14%      |
| voiceid              | json      | 4/29    | 14%      |
| datasync             | json      | 7/53    | 13%      |
| elasticbeanstalk     | query     | 6/47    | 13%      |
| organizations        | json      | 8/63    | 13%      |
| schemas              | rest-json | 4/31    | 13%      |
| ssm-incidents        | rest-json | 4/31    | 13%      |
| codebuild            | json      | 7/59    | 12%      |
| apigateway           | rest-json | 14/124  | 11%      |
| appmesh              | rest-json | 4/38    | 11%      |
| cognito-idp          | json      | 14/126  | 11%      |
| memorydb             | json      | 5/45    | 11%      |
| outposts             | rest-json | 4/37    | 11%      |
| ram                  | rest-json | 4/35    | 11%      |
| shield               | json      | 4/36    | 11%      |
| access-analyzer      | rest-json | 4/39    | 10%      |
| detective            | rest-json | 3/29    | 10%      |
| ecr                  | json      | 6/58    | 10%      |
| fms                  | json      | 4/42    | 10%      |
| fsx                  | json      | 5/48    | 10%      |
| groundstation        | rest-json | 4/40    | 10%      |
| ivs                  | rest-json | 4/40    | 10%      |
| ses                  | query     | 7/71    | 10%      |
| ssm-contacts         | json      | 4/39    | 10%      |
| swf                  | json      | 4/39    | 10%      |
| transfer             | json      | 7/71    | 10%      |
| wisdom               | rest-json | 4/41    | 10%      |
| appsync              | rest-json | 7/74    | 9%       |
| codecommit           | json      | 7/79    | 9%       |
| globalaccelerator    | json      | 5/56    | 9%       |
| rds                  | query     | 14/164  | 9%       |
| transcribe           | json      | 4/43    | 9%       |
| codeartifact         | rest-json | 4/48    | 8%       |
| elasticmapreduce     | json      | 5/60    | 8%       |
| mediatailor          | rest-json | 4/48    | 8%       |
| ssm                  | json      | 11/146  | 8%       |
| appstream            | json      | 6/89    | 7%       |
| backup               | rest-json | 8/109   | 7%       |
| es                   | rest-json | 6/88    | 7%       |
| lakeformation        | rest-json | 4/61    | 7%       |
| config               | json      | 6/97    | 6%       |
| forecast             | json      | 4/63    | 6%       |
| glue                 | json      | 16/265  | 6%       |
| guardduty            | rest-json | 5/87    | 6%       |
| kendra               | json      | 4/66    | 6%       |
| license-manager      | json      | 4/62    | 6%       |
| personalize          | json      | 4/71    | 6%       |
| servicecatalog       | json      | 5/90    | 6%       |
| comprehend           | json      | 4/85    | 5%       |
| directconnect        | json      | 3/63    | 5%       |
| ec2                  | ec2       | 37/765  | 5%       |
| imagebuilder         | rest-json | 4/77    | 5%       |
| network-firewall     | json      | 4/79    | 5%       |
| workspaces           | json      | 5/91    | 5%       |
| frauddetector        | json      | 3/73    | 4%       |
| greengrass           | rest-json | 4/92    | 4%       |
| iotsitewise          | rest-json | 4/104   | 4%       |
| lex                  | rest-json | 4/107   | 4%       |
| redshift             | query     | 5/141   | 4%       |
| sagemaker            | json      | 15/396  | 4%       |
| storagegateway       | json      | 4/96    | 4%       |
| medialive            | rest-json | 4/123   | 3%       |
| mobiletargeting      | rest-json | 4/122   | 3%       |
| networkmanager       | rest-json | 3/95    | 3%       |
| sms-voice            | json      | 3/106   | 3%       |
| connect              | rest-json | 4/370   | 1%       |

---

_Models vendored verbatim from botocore 1.43.19 (Apache-2.0). Coverage figures count registered service handlers against the botocore operation set._
