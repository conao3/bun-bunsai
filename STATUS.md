# bunsai — project status dashboard

> Generated snapshot — run `bun maint/bin/gen-status.ts` to regenerate.

## At a glance

| Metric                   | Value                                         |
| ------------------------ | --------------------------------------------- |
| Services registered      | **141**                                       |
| Wire protocols           | **5** (ec2, json, query, rest-json, rest-xml) |
| Services at 100%         | **139 / 141**                                 |
| Unimplemented operations | **141**                                       |
| E2E test files           | **534**                                       |
| Scenario test files      | **40**                                        |

## Features

- **Management dashboard** — 5-screen web UI: Overview, Request Log, Resource Browser, Snapshots, Settings
- **State snapshots API** — capture and restore full server state via REST; available in tests and the dashboard
- **Parity harness** — replay recorded real-AWS responses against the mock to verify behavioral fidelity
- **Inter-service event routing** — cross-service event delivery (S3 → SNS, SNS → SQS, SQS/SNS → Lambda, EventBridge rules)

## Per-service coverage

Sorted by total modeled operations (descending). `impl/total` counts handler entries vs. modeled operations.

| Service                 | Protocol  | Ops     | E2E files |
| ----------------------- | --------- | ------- | --------- |
| ec2                     | ec2       | 765/765 | 66        |
| sagemaker               | json      | 396/396 | 32        |
| connect                 | rest-json | 370/370 | 23        |
| iot                     | rest-json | 272/272 | 6         |
| glue                    | json      | 265/265 | 26        |
| iam                     | query     | 176/176 | 14        |
| cloudfront              | rest-xml  | 45/167  | 6         |
| rds                     | query     | 164/164 | 9         |
| ssm                     | json      | 146/146 | 3         |
| redshift                | query     | 141/141 | 1         |
| cognito-idp             | json      | 126/126 | 7         |
| apigateway              | rest-json | 124/124 | 12        |
| medialive               | rest-json | 123/123 | 1         |
| pinpoint                | rest-json | 122/122 | 1         |
| dms                     | json      | 119/119 | 1         |
| logs                    | json      | 113/113 | 9         |
| s3                      | rest-xml  | 92/111  | 25        |
| sesv2                   | rest-json | 111/111 | 3         |
| backup                  | rest-json | 109/109 | 2         |
| lexv2                   | rest-json | 107/107 | 1         |
| bedrock                 | rest-json | 106/106 | 1         |
| pinpoint-sms-voice-v2   | json      | 106/106 | 1         |
| iotsitewise             | rest-json | 104/104 | 1         |
| apigatewayv2            | rest-json | 103/103 | 2         |
| config                  | json      | 97/97   | 1         |
| storagegateway          | json      | 96/96   | 1         |
| networkmanager          | rest-json | 95/95   | 1         |
| greengrass              | rest-json | 92/92   | 1         |
| workspaces              | json      | 91/91   | 1         |
| cloudformation          | query     | 90/90   | 7         |
| servicecatalog          | json      | 90/90   | 1         |
| appstream               | json      | 89/89   | 1         |
| opensearch              | rest-json | 88/88   | 1         |
| guardduty               | rest-json | 87/87   | 1         |
| comprehend              | json      | 85/85   | 1         |
| lambda                  | rest-json | 85/85   | 10        |
| codecommit              | json      | 79/79   | 1         |
| network-firewall        | json      | 79/79   | 1         |
| sso-admin               | json      | 79/79   | 1         |
| ecs                     | json      | 77/77   | 4         |
| imagebuilder            | rest-json | 77/77   | 1         |
| elasticache             | query     | 75/75   | 4         |
| appsync                 | rest-json | 74/74   | 2         |
| frauddetector           | json      | 73/73   | 1         |
| route53resolver         | json      | 72/72   | 3         |
| personalize             | json      | 71/71   | 1         |
| route53                 | rest-xml  | 71/71   | 8         |
| ses                     | query     | 71/71   | 1         |
| transfer                | json      | 71/71   | 1         |
| athena                  | json      | 70/70   | 4         |
| autoscaling             | query     | 66/66   | 2         |
| kendra                  | json      | 66/66   | 1         |
| eks                     | rest-json | 64/64   | 5         |
| directconnect           | json      | 63/63   | 1         |
| forecast                | json      | 63/63   | 1         |
| organizations           | json      | 63/63   | 2         |
| licensemanager          | json      | 62/62   | 1         |
| lakeformation           | rest-json | 61/61   | 1         |
| cloudtrail              | json      | 60/60   | 3         |
| emr                     | json      | 60/60   | 1         |
| codebuild               | json      | 59/59   | 1         |
| kafka                   | rest-json | 59/59   | 1         |
| ecr                     | json      | 58/58   | 2         |
| dynamodb                | json      | 57/57   | 28        |
| eventbridge             | json      | 57/57   | 9         |
| globalaccelerator       | json      | 56/56   | 1         |
| wafv2                   | json      | 55/55   | 2         |
| kms                     | json      | 54/54   | 6         |
| datasync                | json      | 53/53   | 1         |
| elbv2                   | query     | 51/51   | 2         |
| codeartifact            | rest-json | 48/48   | 1         |
| fsx                     | json      | 48/48   | 1         |
| mediatailor             | rest-json | 48/48   | 1         |
| ce                      | json      | 47/47   | 1         |
| codedeploy              | json      | 47/47   | 1         |
| elasticbeanstalk        | query     | 47/47   | 1         |
| cloudwatch              | json      | 46/46   | 3         |
| appconfig               | rest-json | 45/45   | 1         |
| batch                   | rest-json | 45/45   | 4         |
| memorydb                | json      | 45/45   | 1         |
| codepipeline            | json      | 44/44   | 1         |
| transcribe              | json      | 43/43   | 1         |
| fms                     | json      | 42/42   | 1         |
| sns                     | query     | 42/42   | 13        |
| wisdom                  | rest-json | 41/41   | 1         |
| groundstation           | rest-json | 40/40   | 1         |
| ivs                     | rest-json | 40/40   | 1         |
| accessanalyzer          | rest-json | 39/39   | 1         |
| kinesis                 | json      | 39/39   | 8         |
| ssm-contacts            | json      | 39/39   | 1         |
| swf                     | json      | 39/39   | 1         |
| appmesh                 | rest-json | 38/38   | 1         |
| xray                    | rest-json | 38/38   | 1         |
| amplify                 | rest-json | 37/37   | 1         |
| apprunner               | json      | 37/37   | 1         |
| dataexchange            | rest-json | 37/37   | 1         |
| outposts                | rest-json | 37/37   | 1         |
| stepfunctions           | json      | 37/37   | 13        |
| shield                  | json      | 36/36   | 1         |
| ram                     | rest-json | 35/35   | 1         |
| mediaconvert            | rest-json | 34/34   | 1         |
| verifiedpermissions     | json      | 34/34   | 1         |
| kinesisanalyticsv2      | json      | 33/33   | 1         |
| efs                     | rest-json | 31/31   | 2         |
| schemas                 | rest-json | 31/31   | 1         |
| ssm-incidents           | rest-json | 31/31   | 1         |
| servicediscovery        | json      | 30/30   | 1         |
| detective               | rest-json | 29/29   | 1         |
| voiceid                 | json      | 29/29   | 1         |
| budgets                 | json      | 26/26   | 1         |
| fis                     | rest-json | 26/26   | 1         |
| iotevents               | rest-json | 26/26   | 1         |
| textract                | json      | 25/25   | 1         |
| mq                      | rest-json | 24/24   | 2         |
| acm-pca                 | json      | 23/23   | 1         |
| cognito-identity        | json      | 23/23   | 1         |
| resourcegroups          | rest-json | 23/23   | 1         |
| secretsmanager          | json      | 23/23   | 7         |
| sqs                     | json      | 23/23   | 11        |
| emr-serverless          | rest-json | 22/22   | 1         |
| dax                     | json      | 21/21   | 1         |
| mediastore              | json      | 21/21   | 1         |
| datapipeline            | json      | 19/19   | 1         |
| identitystore           | json      | 19/19   | 0         |
| keyspaces               | json      | 19/19   | 1         |
| mediapackage            | rest-json | 19/19   | 1         |
| signer                  | rest-json | 19/19   | 1         |
| timestream-write        | json      | 19/19   | 0         |
| acm                     | json      | 17/17   | 4         |
| timestream-query        | json      | 15/15   | 1         |
| application-autoscaling | json      | 14/14   | 1         |
| serverlessrepo          | rest-json | 14/14   | 1         |
| firehose                | json      | 12/12   | 3         |
| mwaa                    | rest-json | 12/12   | 1         |
| scheduler               | rest-json | 12/12   | 1         |
| iot-data                | rest-json | 11/11   | 0         |
| sts                     | query     | 11/11   | 2         |
| bedrock-runtime         | rest-json | 10/10   | 0         |
| pipes                   | rest-json | 10/10   | 1         |
| cloudcontrol            | json      | 8/8     | 1         |
| dlm                     | rest-json | 8/8     | 1         |

---

_Models vendored verbatim from botocore 1.43.19 (Apache-2.0). Coverage figures count registered service handlers against the botocore operation set._
