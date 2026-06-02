import type { ServiceDefinition } from "../core/types.ts";
import sts from "./sts.ts";
import s3 from "./s3.ts";
import sqs from "./sqs.ts";
import dynamodb from "./dynamodb.ts";
import sns from "./sns.ts";
import secretsmanager from "./secretsmanager.ts";
import ssm from "./ssm.ts";
import kms from "./kms.ts";
import iam from "./iam.ts";
import logs from "./logs.ts";
import eventBridge from "./eventbridge.ts";

export const services: ServiceDefinition[] = [
  sts,
  s3,
  sqs,
  dynamodb,
  sns,
  secretsmanager,
  ssm,
  kms,
  iam,
  logs,
  eventBridge,
];

export const findService = (name: string): ServiceDefinition | undefined =>
  services.find((s) => s.name === name);
