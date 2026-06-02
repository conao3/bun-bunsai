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
import lambda from "./lambda.ts";
import cloudwatch from "./cloudwatch.ts";
import stepFunctions from "./stepfunctions.ts";
import ses from "./ses.ts";
import route53 from "./route53.ts";
import cloudFormation from "./cloudformation.ts";
import apiGateway from "./apigateway.ts";
import ec2 from "./ec2.ts";
import rds from "./rds.ts";
import ecr from "./ecr.ts";
import cognitoIdp from "./cognito-idp.ts";
import athena from "./athena.ts";
import glue from "./glue.ts";
import elasticache from "./elasticache.ts";
import efs from "./efs.ts";
import elbv2 from "./elbv2.ts";
import kinesis from "./kinesis.ts";
import firehose from "./firehose.ts";
import ecs from "./ecs.ts";
import organizations from "./organizations.ts";
import cloudfront from "./cloudfront.ts";
import batch from "./batch.ts";
import redshift from "./redshift.ts";
import acm from "./acm.ts";
import cloudtrail from "./cloudtrail.ts";
import opensearch from "./opensearch.ts";
import wafv2 from "./wafv2.ts";
import scheduler from "./scheduler.ts";
import sagemaker from "./sagemaker.ts";
import mq from "./mq.ts";
import eks from "./eks.ts";
import appsync from "./appsync.ts";
import codebuild from "./codebuild.ts";
import codepipeline from "./codepipeline.ts";
import transfer from "./transfer.ts";
import codecommit from "./codecommit.ts";
import backup from "./backup.ts";
import fsx from "./fsx.ts";
import datasync from "./datasync.ts";
import elasticbeanstalk from "./elasticbeanstalk.ts";

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
  lambda,
  cloudwatch,
  stepFunctions,
  ses,
  route53,
  cloudFormation,
  apiGateway,
  ec2,
  rds,
  ecr,
  cognitoIdp,
  athena,
  glue,
  elasticache,
  efs,
  elbv2,
  kinesis,
  firehose,
  ecs,
  organizations,
  cloudfront,
  batch,
  redshift,
  acm,
  cloudtrail,
  opensearch,
  wafv2,
  scheduler,
  sagemaker,
  mq,
  eks,
  appsync,
  codebuild,
  codepipeline,
  transfer,
  codecommit,
  backup,
  fsx,
  datasync,
  elasticbeanstalk,
];

export const findService = (name: string): ServiceDefinition | undefined =>
  services.find((s) => s.name === name);
