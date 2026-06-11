import { pickService } from "../core/router.ts";
import type { ParsedRequest, ServiceDefinition } from "../core/types.ts";
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
import sesv2 from "./sesv2.ts";
import route53 from "./route53.ts";
import cloudFormation from "./cloudformation.ts";
import apiGateway from "./apigateway.ts";
import apiGatewayV2 from "./apigatewayv2.ts";
import ec2 from "./ec2.ts";
import rds from "./rds.ts";
import ecr from "./ecr.ts";
import cognitoIdp from "./cognito-idp.ts";
import cognitoIdentity from "./cognito-identity.ts";
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
import acmPca from "./acm-pca.ts";
import cloudtrail from "./cloudtrail.ts";
import opensearch from "./opensearch.ts";
import wafv2 from "./wafv2.ts";
import scheduler from "./scheduler.ts";
import sagemaker from "./sagemaker.ts";
import mq from "./mq.ts";
import eks from "./eks.ts";
import appsync from "./appsync.ts";
import codebuild from "./codebuild.ts";
import codedeploy from "./codedeploy.ts";
import codepipeline from "./codepipeline.ts";
import transfer from "./transfer.ts";
import codecommit from "./codecommit.ts";
import backup from "./backup.ts";
import fsx from "./fsx.ts";
import datasync from "./datasync.ts";
import elasticbeanstalk from "./elasticbeanstalk.ts";
import apprunner from "./apprunner.ts";
import servicediscovery from "./servicediscovery.ts";
import memorydb from "./memorydb.ts";
import dax from "./dax.ts";
import keyspaces from "./keyspaces.ts";
import emr from "./emr.ts";
import amplify from "./amplify.ts";
import appconfig from "./appconfig.ts";
import pinpoint from "./pinpoint.ts";
import config from "./config.ts";
import guardduty from "./guardduty.ts";
import resourcegroups from "./resourcegroups.ts";
import globalaccelerator from "./globalaccelerator.ts";
import directconnect from "./directconnect.ts";
import swf from "./swf.ts";
import datapipeline from "./datapipeline.ts";
import servicecatalog from "./servicecatalog.ts";
import mediastore from "./mediastore.ts";
import shield from "./shield.ts";
import fms from "./fms.ts";
import licensemanager from "./licensemanager.ts";
import workspaces from "./workspaces.ts";
import appstream from "./appstream.ts";
import storagegateway from "./storagegateway.ts";
import transcribe from "./transcribe.ts";
import forecast from "./forecast.ts";
import kendra from "./kendra.ts";
import personalize from "./personalize.ts";
import budgets from "./budgets.ts";
import accessanalyzer from "./accessanalyzer.ts";
import networkmanager from "./networkmanager.ts";
import imagebuilder from "./imagebuilder.ts";
import detective from "./detective.ts";
import signer from "./signer.ts";
import dlm from "./dlm.ts";
import mediapackage from "./mediapackage.ts";
import greengrass from "./greengrass.ts";
import medialive from "./medialive.ts";
import appmesh from "./appmesh.ts";
import codeartifact from "./codeartifact.ts";
import iotevents from "./iotevents.ts";
import iotsitewise from "./iotsitewise.ts";
import ssmContacts from "./ssm-contacts.ts";
import ivs from "./ivs.ts";
import frauddetector from "./frauddetector.ts";
import comprehend from "./comprehend.ts";
import mediatailor from "./mediatailor.ts";
import dataexchange from "./dataexchange.ts";
import groundstation from "./groundstation.ts";
import wisdom from "./wisdom.ts";
import mwaa from "./mwaa.ts";
import voiceid from "./voiceid.ts";
import ssmIncidents from "./ssm-incidents.ts";
import outposts from "./outposts.ts";
import lakeformation from "./lakeformation.ts";
import emrServerless from "./emr-serverless.ts";
import connect from "./connect.ts";
import lexv2 from "./lexv2.ts";
import smsVoice from "./pinpoint-sms-voice-v2.ts";
import ram from "./ram.ts";
import networkFirewall from "./network-firewall.ts";
import schemas from "./schemas.ts";
import autoscaling from "./autoscaling.ts";
import pipes from "./pipes.ts";
import route53resolver from "./route53resolver.ts";
import applicationAutoscaling from "./application-autoscaling.ts";
import xray from "./xray.ts";
import bedrock from "./bedrock.ts";
import bedrockRuntime from "./bedrock-runtime.ts";
import textract from "./textract.ts";
import dms from "./dms.ts";
import timestreamWrite from "./timestream-write.ts";
import timestreamQuery from "./timestream-query.ts";
import kinesisanalyticsv2 from "./kinesisanalyticsv2.ts";
import verifiedpermissions from "./verifiedpermissions.ts";
import mediaconvert from "./mediaconvert.ts";
import kafka from "./kafka.ts";
import ce from "./ce.ts";

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
  sesv2,
  route53,
  cloudFormation,
  apiGateway,
  apiGatewayV2,
  ec2,
  rds,
  ecr,
  cognitoIdp,
  cognitoIdentity,
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
  acmPca,
  cloudtrail,
  opensearch,
  wafv2,
  scheduler,
  sagemaker,
  mq,
  eks,
  appsync,
  codebuild,
  codedeploy,
  codepipeline,
  transfer,
  codecommit,
  backup,
  fsx,
  datasync,
  elasticbeanstalk,
  apprunner,
  servicediscovery,
  memorydb,
  dax,
  keyspaces,
  emr,
  amplify,
  appconfig,
  pinpoint,
  config,
  guardduty,
  resourcegroups,
  globalaccelerator,
  directconnect,
  swf,
  datapipeline,
  servicecatalog,
  mediastore,
  shield,
  fms,
  licensemanager,
  workspaces,
  appstream,
  storagegateway,
  transcribe,
  forecast,
  kendra,
  personalize,
  budgets,
  accessanalyzer,
  networkmanager,
  imagebuilder,
  detective,
  signer,
  dlm,
  mediapackage,
  greengrass,
  medialive,
  appmesh,
  codeartifact,
  iotevents,
  iotsitewise,
  ssmContacts,
  ivs,
  frauddetector,
  comprehend,
  mediatailor,
  mediaconvert,
  dataexchange,
  groundstation,
  wisdom,
  mwaa,
  voiceid,
  ssmIncidents,
  outposts,
  lakeformation,
  emrServerless,
  connect,
  lexv2,
  smsVoice,
  ram,
  networkFirewall,
  schemas,
  autoscaling,
  pipes,
  route53resolver,
  applicationAutoscaling,
  xray,
  bedrockRuntime,
  bedrock,
  textract,
  dms,
  timestreamWrite,
  timestreamQuery,
  kinesisanalyticsv2,
  verifiedpermissions,
  kafka,
  ce,
];

export const findService = (
  name: string,
  path?: string,
  target?: string,
): ServiceDefinition | undefined => {
  const candidates = services.filter(
    (s) =>
      s.name === name ||
      s.model?.metadata?.targetPrefix?.toLowerCase() === name,
  );
  if (candidates.length <= 1) return candidates[0];
  if (target !== undefined) {
    const req = { path: path ?? "/", target } as ParsedRequest;
    const matched = candidates.find((s) => s.matches?.(req) === true);
    if (matched !== undefined) return matched;
  }
  if (path === undefined) return candidates[0];
  return pickService(candidates, path);
};
