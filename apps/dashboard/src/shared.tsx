import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ReactNode, SVGProps } from "react";
import type { Protocol } from "./api";

export type IconProps = SVGProps<SVGSVGElement>;

export const Ico = {
  overview: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="3"
        width="7"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="14"
        y="3"
        width="7"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="14"
        y="12"
        width="7"
        height="9"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <rect
        x="3"
        y="16"
        width="7"
        height="5"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  log: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 6h16M4 12h16M4 18h10"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="19" cy="18" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  browser: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 5.5h6l1.5 2H20a1 1 0 0 1 1 1V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  ),
  search: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m20 20-3.4-3.4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  ),
  play: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M7 5.5v13l11-6.5z" />
    </svg>
  ),
  pause: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <rect x="6.5" y="5.5" width="3.6" height="13" rx="1" />
      <rect x="13.9" y="5.5" width="3.6" height="13" rx="1" />
    </svg>
  ),
  trash: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M5 7h14M10 7V5.5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1V7M6.5 7l.8 11a1 1 0 0 0 1 .95h7.4a1 1 0 0 0 1-.95L18 7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  close: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m6 6 12 12M18 6 6 18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  ),
  caret: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  chevR: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  check: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="m5 12.5 4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  sun: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3v2.2M12 18.8V21M21 12h-2.2M5.2 12H3M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  moon: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M20 13.5A8 8 0 0 1 10.5 4a7 7 0 1 0 9.5 9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  warn: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M12 4.5 21 19.5H3L12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 10v4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.6" r="1" fill="currentColor" />
    </svg>
  ),
  filter: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path
        d="M4 6h16l-6 7v5l-4 2v-7L4 6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  snapshot: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect
        x="3"
        y="4"
        width="18"
        height="4"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M5 8v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M9 13h6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  settings: (p: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
} as const;

export const serviceMeta: Record<
  string,
  {
    name: string;
    tag: string;
    kind: string;
    color: string;
    resourceLabel: string;
  }
> = {
  s3: {
    name: "S3",
    tag: "S3",
    kind: "Object storage",
    color: "#5db872",
    resourceLabel: "Buckets",
  },
  sqs: {
    name: "SQS",
    tag: "SQS",
    kind: "Message queue",
    color: "#cc785c",
    resourceLabel: "Queues",
  },
  dynamodb: {
    name: "DynamoDB",
    tag: "DynamoDB",
    kind: "NoSQL table",
    color: "#5db8a6",
    resourceLabel: "Tables",
  },
  secretsmanager: {
    name: "Secrets Manager",
    tag: "Secrets",
    kind: "Secrets store",
    color: "#e8a55a",
    resourceLabel: "Secrets",
  },
  lambda: {
    name: "Lambda",
    tag: "Lambda",
    kind: "Function runtime",
    color: "#d4885c",
    resourceLabel: "Functions",
  },
  sns: {
    name: "SNS",
    tag: "SNS",
    kind: "Pub/sub topic",
    color: "#c87888",
    resourceLabel: "Topics",
  },
  events: {
    name: "EventBridge",
    tag: "Events",
    kind: "Event bus",
    color: "#5aaac4",
    resourceLabel: "Rules",
  },
  logs: {
    name: "CloudWatch Logs",
    tag: "Logs",
    kind: "Log group",
    color: "#8ab878",
    resourceLabel: "Log groups",
  },
  monitoring: {
    name: "CloudWatch",
    tag: "CloudWatch",
    kind: "Metrics & alarms",
    color: "#d4a840",
    resourceLabel: "Alarms",
  },
  cloudformation: {
    name: "CloudFormation",
    tag: "CFN",
    kind: "Stack orchestration",
    color: "#8878c0",
    resourceLabel: "Stacks",
  },
  states: {
    name: "Step Functions",
    tag: "StepFn",
    kind: "Workflow engine",
    color: "#b078b0",
    resourceLabel: "State machines",
  },
  "cognito-idp": {
    name: "Cognito",
    tag: "Cognito",
    kind: "Identity provider",
    color: "#b06878",
    resourceLabel: "User pools",
  },
  kms: {
    name: "KMS",
    tag: "KMS",
    kind: "Key management",
    color: "#9870b8",
    resourceLabel: "Keys",
  },
  sts: {
    name: "STS",
    tag: "STS",
    kind: "Security tokens",
    color: "#7888c4",
    resourceLabel: "Tokens",
  },
  iam: {
    name: "IAM",
    tag: "IAM",
    kind: "Access management",
    color: "#c46860",
    resourceLabel: "Roles",
  },
  apigateway: {
    name: "API Gateway",
    tag: "APIGW",
    kind: "REST/HTTP API",
    color: "#8878b0",
    resourceLabel: "APIs",
  },
  ssm: {
    name: "Systems Manager",
    tag: "SSM",
    kind: "Parameter store",
    color: "#5898bc",
    resourceLabel: "Parameters",
  },
  kinesis: {
    name: "Kinesis",
    tag: "Kinesis",
    kind: "Data stream",
    color: "#6878c4",
    resourceLabel: "Streams",
  },
  elasticache: {
    name: "ElastiCache",
    tag: "Cache",
    kind: "In-memory cache",
    color: "#5ab0a0",
    resourceLabel: "Clusters",
  },
  rds: {
    name: "RDS",
    tag: "RDS",
    kind: "Relational DB",
    color: "#5880b8",
    resourceLabel: "Instances",
  },
  ecs: {
    name: "ECS",
    tag: "ECS",
    kind: "Container service",
    color: "#e88050",
    resourceLabel: "Clusters",
  },
  "cognito-identity": {
    name: "Cognito Identity",
    tag: "CognitoID",
    kind: "Federated identity",
    color: "#c07888",
    resourceLabel: "Identity pools",
  },
  pipes: {
    name: "EventBridge Pipes",
    tag: "Pipes",
    kind: "Event pipe",
    color: "#60b4cc",
    resourceLabel: "Pipes",
  },
  autoscaling: {
    name: "Auto Scaling",
    tag: "ASG",
    kind: "Auto scaling group",
    color: "#70b870",
    resourceLabel: "Groups",
  },
  xray: {
    name: "X-Ray",
    tag: "X-Ray",
    kind: "Distributed tracing",
    color: "#788898",
    resourceLabel: "Traces",
  },
  route53resolver: {
    name: "Route 53 Resolver",
    tag: "R53R",
    kind: "DNS resolver",
    color: "#60a8c0",
    resourceLabel: "Rules",
  },
  codedeploy: {
    name: "CodeDeploy",
    tag: "Deploy",
    kind: "Deployment service",
    color: "#c8a060",
    resourceLabel: "Applications",
  },
  "application-autoscaling": {
    name: "Application Auto Scaling",
    tag: "AppASG",
    kind: "Scalable target",
    color: "#78b878",
    resourceLabel: "Targets",
  },
  kafka: {
    name: "MSK",
    tag: "MSK",
    kind: "Kafka cluster",
    color: "#c85858",
    resourceLabel: "Clusters",
  },
  kinesisanalytics: {
    name: "Kinesis Analytics",
    tag: "KDA",
    kind: "Stream analytics",
    color: "#5870c0",
    resourceLabel: "Applications",
  },
  timestream: {
    name: "Timestream",
    tag: "Timestream",
    kind: "Time-series DB",
    color: "#58a890",
    resourceLabel: "Databases",
  },
  bedrock: {
    name: "Bedrock",
    tag: "Bedrock",
    kind: "Foundation models",
    color: "#7060c8",
    resourceLabel: "Models",
  },
  textract: {
    name: "Textract",
    tag: "Textract",
    kind: "Document extraction",
    color: "#b888c4",
    resourceLabel: "Documents",
  },
  verifiedpermissions: {
    name: "Verified Permissions",
    tag: "AVP",
    kind: "Policy store",
    color: "#a07898",
    resourceLabel: "Policy stores",
  },
  "acm-pca": {
    name: "ACM Private CA",
    tag: "PCA",
    kind: "Private certificate authority",
    color: "#9090c8",
    resourceLabel: "CAs",
  },
  sso: {
    name: "IAM Identity Center",
    tag: "SSO",
    kind: "SSO management",
    color: "#c07060",
    resourceLabel: "Instances",
  },
  identitystore: {
    name: "Identity Store",
    tag: "IdStore",
    kind: "Identity directory",
    color: "#b06870",
    resourceLabel: "Users",
  },
  iot: {
    name: "IoT Core",
    tag: "IoT",
    kind: "IoT connectivity",
    color: "#60b0a0",
    resourceLabel: "Things",
  },
  iotdata: {
    name: "IoT Data",
    tag: "IoTData",
    kind: "IoT data plane",
    color: "#50a898",
    resourceLabel: "Topics",
  },
  mediaconvert: {
    name: "MediaConvert",
    tag: "MediaConvert",
    kind: "Video transcoding",
    color: "#d08058",
    resourceLabel: "Jobs",
  },
  ce: {
    name: "Cost Explorer",
    tag: "CE",
    kind: "Cost analysis",
    color: "#58a840",
    resourceLabel: "Reports",
  },
  cloudcontrolapi: {
    name: "Cloud Control",
    tag: "CloudCtrl",
    kind: "Cloud resource API",
    color: "#9898a0",
    resourceLabel: "Resources",
  },
  fis: {
    name: "FIS",
    tag: "FIS",
    kind: "Fault injection",
    color: "#c06070",
    resourceLabel: "Experiments",
  },
  serverlessrepo: {
    name: "Serverless Repo",
    tag: "SAR",
    kind: "App repository",
    color: "#d09068",
    resourceLabel: "Applications",
  },
  tagging: {
    name: "Resource Groups Tagging API",
    tag: "Tagging",
    kind: "Cross-service tags",
    color: "#a48d3c",
    resourceLabel: "Tagged resources",
  },
  support: {
    name: "Support",
    tag: "Support",
    kind: "Support cases",
    color: "#7a98c0",
    resourceLabel: "Cases",
  },
  dms: {
    name: "DMS",
    tag: "DMS",
    kind: "Database migration",
    color: "#5878c8",
    resourceLabel: "Tasks",
  },
  ses: {
    name: "SES",
    tag: "SES",
    kind: "Email delivery",
    color: "#d09870",
    resourceLabel: "Identities",
  },
  route53: {
    name: "Route 53",
    tag: "R53",
    kind: "DNS service",
    color: "#60b0d0",
    resourceLabel: "Hosted zones",
  },
  ec2: {
    name: "EC2",
    tag: "EC2",
    kind: "Virtual machines",
    color: "#e07848",
    resourceLabel: "Instances",
  },
  ecr: {
    name: "ECR",
    tag: "ECR",
    kind: "Container registry",
    color: "#c0785c",
    resourceLabel: "Repositories",
  },
  athena: {
    name: "Athena",
    tag: "Athena",
    kind: "Serverless SQL query",
    color: "#8870c0",
    resourceLabel: "Workgroups",
  },
  glue: {
    name: "Glue",
    tag: "Glue",
    kind: "ETL integration",
    color: "#7898c0",
    resourceLabel: "Jobs",
  },
  elasticfilesystem: {
    name: "EFS",
    tag: "EFS",
    kind: "Elastic file system",
    color: "#78b898",
    resourceLabel: "File systems",
  },
  elasticloadbalancing: {
    name: "ELB",
    tag: "ELB",
    kind: "Load balancer",
    color: "#6890c8",
    resourceLabel: "Load balancers",
  },
  firehose: {
    name: "Firehose",
    tag: "Firehose",
    kind: "Data delivery stream",
    color: "#e06858",
    resourceLabel: "Streams",
  },
  organizations: {
    name: "Organizations",
    tag: "Orgs",
    kind: "Account management",
    color: "#8898b8",
    resourceLabel: "Accounts",
  },
  cloudfront: {
    name: "CloudFront",
    tag: "CF",
    kind: "CDN distribution",
    color: "#e0a040",
    resourceLabel: "Distributions",
  },
  batch: {
    name: "Batch",
    tag: "Batch",
    kind: "Batch computing",
    color: "#70a868",
    resourceLabel: "Job queues",
  },
  redshift: {
    name: "Redshift",
    tag: "Redshift",
    kind: "Data warehouse",
    color: "#5868c8",
    resourceLabel: "Clusters",
  },
  acm: {
    name: "ACM",
    tag: "ACM",
    kind: "Certificate management",
    color: "#90b8a8",
    resourceLabel: "Certificates",
  },
  cloudtrail: {
    name: "CloudTrail",
    tag: "Trail",
    kind: "API audit logging",
    color: "#a0b888",
    resourceLabel: "Trails",
  },
  es: {
    name: "OpenSearch",
    tag: "OpenSearch",
    kind: "Search analytics",
    color: "#5898c8",
    resourceLabel: "Domains",
  },
  wafv2: {
    name: "WAF",
    tag: "WAF",
    kind: "Web app firewall",
    color: "#c87060",
    resourceLabel: "Web ACLs",
  },
  scheduler: {
    name: "Scheduler",
    tag: "Scheduler",
    kind: "Scheduled invocations",
    color: "#88a878",
    resourceLabel: "Schedules",
  },
  sagemaker: {
    name: "SageMaker",
    tag: "SageMaker",
    kind: "ML platform",
    color: "#9060c0",
    resourceLabel: "Endpoints",
  },
  mq: {
    name: "Amazon MQ",
    tag: "MQ",
    kind: "Managed broker",
    color: "#c89858",
    resourceLabel: "Brokers",
  },
  eks: {
    name: "EKS",
    tag: "EKS",
    kind: "Kubernetes service",
    color: "#5888d0",
    resourceLabel: "Clusters",
  },
  appsync: {
    name: "AppSync",
    tag: "AppSync",
    kind: "GraphQL API",
    color: "#b88070",
    resourceLabel: "APIs",
  },
  codebuild: {
    name: "CodeBuild",
    tag: "Build",
    kind: "Build service",
    color: "#78a8c8",
    resourceLabel: "Projects",
  },
  codepipeline: {
    name: "CodePipeline",
    tag: "Pipeline",
    kind: "CI/CD pipeline",
    color: "#9878c0",
    resourceLabel: "Pipelines",
  },
  transfer: {
    name: "Transfer Family",
    tag: "Transfer",
    kind: "Managed file transfer",
    color: "#68a898",
    resourceLabel: "Servers",
  },
  codecommit: {
    name: "CodeCommit",
    tag: "Commit",
    kind: "Git repository",
    color: "#a89870",
    resourceLabel: "Repositories",
  },
  backup: {
    name: "Backup",
    tag: "Backup",
    kind: "Centralized backup",
    color: "#7090c0",
    resourceLabel: "Vaults",
  },
  fsx: {
    name: "FSx",
    tag: "FSx",
    kind: "Managed file storage",
    color: "#789880",
    resourceLabel: "File systems",
  },
  datasync: {
    name: "DataSync",
    tag: "DataSync",
    kind: "Data transfer service",
    color: "#6898a8",
    resourceLabel: "Tasks",
  },
  elasticbeanstalk: {
    name: "Elastic Beanstalk",
    tag: "EB",
    kind: "PaaS deployment",
    color: "#98c878",
    resourceLabel: "Applications",
  },
  apprunner: {
    name: "App Runner",
    tag: "AppRunner",
    kind: "Container app service",
    color: "#e8785c",
    resourceLabel: "Services",
  },
  servicediscovery: {
    name: "Cloud Map",
    tag: "CloudMap",
    kind: "Service discovery",
    color: "#70a0b8",
    resourceLabel: "Namespaces",
  },
  memorydb: {
    name: "MemoryDB",
    tag: "MemoryDB",
    kind: "Redis-compatible DB",
    color: "#90c0a0",
    resourceLabel: "Clusters",
  },
  dax: {
    name: "DAX",
    tag: "DAX",
    kind: "DynamoDB accelerator",
    color: "#a870c0",
    resourceLabel: "Clusters",
  },
  cassandra: {
    name: "Keyspaces",
    tag: "Keyspaces",
    kind: "Managed Cassandra",
    color: "#5880b0",
    resourceLabel: "Tables",
  },
  elasticmapreduce: {
    name: "EMR",
    tag: "EMR",
    kind: "Hadoop/Spark cluster",
    color: "#c86858",
    resourceLabel: "Clusters",
  },
  amplify: {
    name: "Amplify",
    tag: "Amplify",
    kind: "Web/mobile hosting",
    color: "#f07040",
    resourceLabel: "Apps",
  },
  appconfig: {
    name: "AppConfig",
    tag: "AppConfig",
    kind: "Feature flag config",
    color: "#88a8c8",
    resourceLabel: "Applications",
  },
  mobiletargeting: {
    name: "Pinpoint",
    tag: "Pinpoint",
    kind: "Customer engagement",
    color: "#e8885c",
    resourceLabel: "Apps",
  },
  config: {
    name: "Config",
    tag: "Config",
    kind: "Resource compliance",
    color: "#b0a070",
    resourceLabel: "Rules",
  },
  guardduty: {
    name: "GuardDuty",
    tag: "GD",
    kind: "Threat detection",
    color: "#c06868",
    resourceLabel: "Detectors",
  },
  "resource-groups": {
    name: "Resource Groups",
    tag: "ResGrp",
    kind: "Resource grouping",
    color: "#8898a8",
    resourceLabel: "Groups",
  },
  globalaccelerator: {
    name: "Global Accelerator",
    tag: "GA",
    kind: "Global networking",
    color: "#5068d8",
    resourceLabel: "Accelerators",
  },
  directconnect: {
    name: "Direct Connect",
    tag: "DX",
    kind: "Dedicated network",
    color: "#6878c8",
    resourceLabel: "Connections",
  },
  swf: {
    name: "SWF",
    tag: "SWF",
    kind: "Workflow service",
    color: "#a08868",
    resourceLabel: "Domains",
  },
  datapipeline: {
    name: "Data Pipeline",
    tag: "DPL",
    kind: "Data orchestration",
    color: "#7880b8",
    resourceLabel: "Pipelines",
  },
  servicecatalog: {
    name: "Service Catalog",
    tag: "SC",
    kind: "Product catalog",
    color: "#908868",
    resourceLabel: "Products",
  },
  mediastore: {
    name: "MediaStore",
    tag: "MediaStore",
    kind: "Media object storage",
    color: "#a07868",
    resourceLabel: "Containers",
  },
  shield: {
    name: "Shield",
    tag: "Shield",
    kind: "DDoS protection",
    color: "#c05870",
    resourceLabel: "Protections",
  },
  fms: {
    name: "Firewall Manager",
    tag: "FMS",
    kind: "Firewall management",
    color: "#b87858",
    resourceLabel: "Policies",
  },
  "license-manager": {
    name: "License Manager",
    tag: "LM",
    kind: "License tracking",
    color: "#9888a0",
    resourceLabel: "Configurations",
  },
  workspaces: {
    name: "WorkSpaces",
    tag: "WS",
    kind: "Virtual desktops",
    color: "#7090a8",
    resourceLabel: "Workspaces",
  },
  appstream: {
    name: "AppStream",
    tag: "AppStream",
    kind: "App streaming",
    color: "#8870a8",
    resourceLabel: "Fleets",
  },
  storagegateway: {
    name: "Storage Gateway",
    tag: "SGW",
    kind: "Hybrid storage",
    color: "#708898",
    resourceLabel: "Gateways",
  },
  transcribe: {
    name: "Transcribe",
    tag: "Transcribe",
    kind: "Speech-to-text",
    color: "#80b8b0",
    resourceLabel: "Jobs",
  },
  forecast: {
    name: "Forecast",
    tag: "Forecast",
    kind: "Time-series forecasting",
    color: "#98c0a0",
    resourceLabel: "Predictors",
  },
  kendra: {
    name: "Kendra",
    tag: "Kendra",
    kind: "Enterprise search",
    color: "#7878c8",
    resourceLabel: "Indexes",
  },
  personalize: {
    name: "Personalize",
    tag: "Personalize",
    kind: "ML recommendations",
    color: "#c888a0",
    resourceLabel: "Datasets",
  },
  budgets: {
    name: "Budgets",
    tag: "Budgets",
    kind: "Cost budget alerts",
    color: "#80a858",
    resourceLabel: "Budgets",
  },
  "access-analyzer": {
    name: "Access Analyzer",
    tag: "AA",
    kind: "Access analysis",
    color: "#b88898",
    resourceLabel: "Analyzers",
  },
  networkmanager: {
    name: "Network Manager",
    tag: "NM",
    kind: "Global network mgmt",
    color: "#6880b0",
    resourceLabel: "Networks",
  },
  imagebuilder: {
    name: "Image Builder",
    tag: "IB",
    kind: "AMI automation",
    color: "#d08870",
    resourceLabel: "Pipelines",
  },
  detective: {
    name: "Detective",
    tag: "Detective",
    kind: "Security investigation",
    color: "#8898c8",
    resourceLabel: "Graphs",
  },
  signer: {
    name: "Signer",
    tag: "Signer",
    kind: "Code signing",
    color: "#a0b898",
    resourceLabel: "Profiles",
  },
  dlm: {
    name: "DLM",
    tag: "DLM",
    kind: "Lifecycle management",
    color: "#7888a0",
    resourceLabel: "Policies",
  },
  mediapackage: {
    name: "MediaPackage",
    tag: "MediaPkg",
    kind: "Video packaging",
    color: "#c07888",
    resourceLabel: "Channels",
  },
  greengrass: {
    name: "Greengrass",
    tag: "GG",
    kind: "IoT edge runtime",
    color: "#68b068",
    resourceLabel: "Groups",
  },
  medialive: {
    name: "MediaLive",
    tag: "MediaLive",
    kind: "Live video encoding",
    color: "#d07060",
    resourceLabel: "Channels",
  },
  appmesh: {
    name: "App Mesh",
    tag: "AppMesh",
    kind: "Service mesh",
    color: "#88b0c8",
    resourceLabel: "Meshes",
  },
  codeartifact: {
    name: "CodeArtifact",
    tag: "CodeArt",
    kind: "Artifact repository",
    color: "#a898c0",
    resourceLabel: "Domains",
  },
  iotevents: {
    name: "IoT Events",
    tag: "IoTEvt",
    kind: "IoT event detection",
    color: "#68a8c0",
    resourceLabel: "Detectors",
  },
  iotsitewise: {
    name: "IoT SiteWise",
    tag: "SiteWise",
    kind: "Industrial IoT data",
    color: "#78b0a8",
    resourceLabel: "Assets",
  },
  "ssm-contacts": {
    name: "Incident Manager Contacts",
    tag: "Contacts",
    kind: "On-call contacts",
    color: "#b89888",
    resourceLabel: "Contacts",
  },
  ivs: {
    name: "IVS",
    tag: "IVS",
    kind: "Interactive live stream",
    color: "#e07858",
    resourceLabel: "Channels",
  },
  frauddetector: {
    name: "Fraud Detector",
    tag: "FD",
    kind: "Fraud detection ML",
    color: "#c86870",
    resourceLabel: "Detectors",
  },
  comprehend: {
    name: "Comprehend",
    tag: "NLP",
    kind: "NLP service",
    color: "#88a0c8",
    resourceLabel: "Entities",
  },
  mediatailor: {
    name: "MediaTailor",
    tag: "MediaTailor",
    kind: "Ad insertion",
    color: "#d09060",
    resourceLabel: "Configurations",
  },
  dataexchange: {
    name: "Data Exchange",
    tag: "DX",
    kind: "Data marketplace",
    color: "#78a8b8",
    resourceLabel: "Datasets",
  },
  groundstation: {
    name: "Ground Station",
    tag: "GS",
    kind: "Satellite operations",
    color: "#9898c0",
    resourceLabel: "Contacts",
  },
  wisdom: {
    name: "Connect Wisdom",
    tag: "Wisdom",
    kind: "Knowledge assistant",
    color: "#b0a8d8",
    resourceLabel: "Assistants",
  },
  airflow: {
    name: "MWAA",
    tag: "MWAA",
    kind: "Managed Airflow",
    color: "#5890c8",
    resourceLabel: "Environments",
  },
  voiceid: {
    name: "Connect Voice ID",
    tag: "VoiceID",
    kind: "Voice authentication",
    color: "#c888b0",
    resourceLabel: "Domains",
  },
  "ssm-incidents": {
    name: "Incident Manager",
    tag: "IncMgr",
    kind: "Incident response",
    color: "#c86878",
    resourceLabel: "Incidents",
  },
  outposts: {
    name: "Outposts",
    tag: "Outposts",
    kind: "On-premises AWS",
    color: "#8890a8",
    resourceLabel: "Outposts",
  },
  lakeformation: {
    name: "Lake Formation",
    tag: "LakeForm",
    kind: "Data lake governance",
    color: "#68b8a0",
    resourceLabel: "Databases",
  },
  "emr-serverless": {
    name: "EMR Serverless",
    tag: "EMR-SL",
    kind: "Serverless Spark/Hive",
    color: "#d06858",
    resourceLabel: "Applications",
  },
  connect: {
    name: "Connect",
    tag: "Connect",
    kind: "Contact center",
    color: "#5898c0",
    resourceLabel: "Instances",
  },
  lex: {
    name: "Lex",
    tag: "Lex",
    kind: "Conversational AI",
    color: "#90a0d8",
    resourceLabel: "Bots",
  },
  "sms-voice": {
    name: "Pinpoint SMS Voice",
    tag: "SMSVoice",
    kind: "SMS/voice messaging",
    color: "#d888a8",
    resourceLabel: "Phone numbers",
  },
  ram: {
    name: "RAM",
    tag: "RAM",
    kind: "Resource sharing",
    color: "#9870b0",
    resourceLabel: "Shares",
  },
  "network-firewall": {
    name: "Network Firewall",
    tag: "NFW",
    kind: "Managed firewall",
    color: "#b07060",
    resourceLabel: "Firewalls",
  },
  schemas: {
    name: "EventBridge Schemas",
    tag: "Schemas",
    kind: "Event schema registry",
    color: "#8888b0",
    resourceLabel: "Registries",
  },
} as const;

export function svcInfo(svc: string) {
  return (
    serviceMeta[svc] ?? {
      name: svc,
      tag: svc,
      kind: "Service",
      color: "#a09d96",
      resourceLabel: "Resources",
    }
  );
}

const dotLabel: Record<"running" | "error" | "idle", string> = {
  running: "Running",
  error: "Error",
  idle: "Idle",
};

export function StatusDot({
  state,
  pulse,
  lg,
}: {
  state: "running" | "error" | "idle";
  pulse?: boolean;
  lg?: boolean;
}) {
  return (
    <span
      role="img"
      aria-label={dotLabel[state]}
      className={`dot ${state}${pulse ? " pulse" : ""}${lg ? " lg" : ""}`}
    />
  );
}

export function ServiceTag({ svc }: { svc: string }) {
  const s = svcInfo(svc);
  return (
    <span
      className="svc-tag"
      style={{
        color: s.color,
        background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
      }}
    >
      {s.tag}
    </span>
  );
}

export function StatusChip({ status }: { status: number }) {
  const cls = status < 400 ? "2xx" : status < 500 ? "4xx" : "5xx";
  return <span className={`status-chip status-${cls}`}>{status}</span>;
}

export function ProtoBadge({ protocol }: { protocol: Protocol | string }) {
  return <span className="proto-badge">{protocol}</span>;
}

const tokenRe =
  /("(\\.|[^"\\])*"\s*:)|("(\\.|[^"\\])*")|(\b-?\d+\.?\d*\b)|(\btrue\b|\bfalse\b|\bnull\b)|([{}\[\],])/g;

function highlightJson(text: string): ReactNode[] {
  const tokens: ReactNode[] = [];
  let last = 0;
  let i = 0;
  let m: RegExpExecArray | null;
  tokenRe.lastIndex = 0;
  while ((m = tokenRe.exec(text)) !== null) {
    if (m.index > last)
      tokens.push(<span key={i++}>{text.slice(last, m.index)}</span>);
    let cls = "p";
    if (m[1]) cls = "k";
    else if (m[3]) cls = "s";
    else if (m[5]) cls = "n";
    else if (m[6]) cls = "n";
    tokens.push(
      <span key={i++} className={cls}>
        {m[0]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length)
    tokens.push(<span key={i++}>{text.slice(last)}</span>);
  return tokens;
}

export function prettyMaybeJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function CodeBlock({
  text,
  highlight,
}: {
  text: string;
  highlight?: boolean;
}) {
  if (!text) return <pre className="codeblock muted">{"(empty)"}</pre>;
  return (
    <pre className="codeblock">{highlight ? highlightJson(text) : text}</pre>
  );
}

export function Popover({
  anchor,
  children,
  onClose,
  align = "left",
}: {
  anchor: HTMLElement | null;
  children: ReactNode;
  onClose: () => void;
  align?: "left" | "right";
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        ref.current &&
        !ref.current.contains(t) &&
        anchor &&
        !anchor.contains(t)
      )
        onClose();
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", h);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", h);
      document.removeEventListener("keydown", esc);
    };
  }, [anchor, onClose]);
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const style =
    align === "right"
      ? { top: r.bottom + 6, right: window.innerWidth - r.right }
      : { top: r.bottom + 6, left: r.left };
  return createPortal(
    <div className="popover fadein" ref={ref} style={style}>
      {children}
    </div>,
    document.body,
  );
}

export function EmptyState({
  glyph,
  title,
  sub,
  action,
}: {
  glyph: ReactNode;
  title: string;
  sub?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="glyph">{glyph}</div>
      <div className="et">{title}</div>
      {sub && <div className="es">{sub}</div>}
      {action}
    </div>
  );
}

export function MultiFilter({
  label,
  options,
  selected,
  onChange,
  render,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  render?: (o: string) => ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const all = selected.length === 0;
  const toggle = (o: string) => {
    if (selected.includes(o)) onChange(selected.filter((x) => x !== o));
    else onChange([...selected, o]);
  };
  return (
    <>
      <button
        className={`select-pill${all ? "" : " on"}`}
        ref={ref}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <Ico.filter width="13" height="13" />
        <span>
          {label}
          {all ? "" : ` · ${selected.length}`}
        </span>
        <Ico.caret
          width="12"
          height="12"
          style={{ color: "var(--muted-soft)" }}
        />
      </button>
      {open && (
        <Popover anchor={ref.current} onClose={() => setOpen(false)}>
          <button className="opt" onClick={() => onChange([])}>
            <span style={{ fontWeight: 500 }}>All {label.toLowerCase()}</span>
            {all && <Ico.check className="chk" width="15" height="15" />}
          </button>
          <div className="sep" />
          {options.map((o) => (
            <button key={o} className="opt" onClick={() => toggle(o)}>
              <span>{render ? render(o) : o}</span>
              {selected.includes(o) && (
                <Ico.check className="chk" width="15" height="15" />
              )}
            </button>
          ))}
        </Popover>
      )}
    </>
  );
}

export function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.toTimeString().slice(0, 8)}.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

export function fmtLatency(ms: number): string {
  return ms < 10 ? ms.toFixed(2) : ms.toFixed(0);
}
