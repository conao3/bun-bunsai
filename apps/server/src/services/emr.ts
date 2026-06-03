import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import emrModel from "../../../../test/vendor/aws-models/emr.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(emrModel);

type StoredCluster = {
  Id: string;
  Name: string;
  ClusterArn: string;
  State: string;
  ReleaseLabel: string | undefined;
  LogUri: string | undefined;
  Steps: { Id: string; Name: string }[];
};

const clusterKey = (id: string): string => `cluster/${id}`;

const requireString = (input: Record<string, unknown>, key: string): string => {
  const value = input[key];
  if (typeof value !== "string" || value === "") {
    throw awsError("InvalidRequestException", `${key} is required.`, 400);
  }
  return value;
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const clusterArn = (ctx: ServiceContext, id: string): string =>
  `arn:aws:elasticmapreduce:${ctx.region}:${ctx.account}:cluster/${id}`;

const newId = (): string =>
  `j-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`;

const statusOf = (state: string): Record<string, unknown> => ({
  State: state,
  StateChangeReason: { Code: "USER_REQUEST", Message: "" },
  Timeline: {},
});

const requireCluster = (ctx: ServiceContext, id: string): StoredCluster => {
  const cluster = ctx.store.get<StoredCluster>(clusterKey(id));
  if (cluster === undefined) {
    throw awsError(
      "InvalidRequestException",
      `Cluster id '${id}' is not valid.`,
      400,
    );
  }
  return cluster;
};

const RunJobFlow: OperationHandler = (input, ctx) => {
  const name = requireString(input, "Name");
  if (input["Instances"] === undefined) {
    throw awsError("InvalidRequestException", "Instances is required.", 400);
  }
  const id = newId();
  const cluster: StoredCluster = {
    Id: id,
    Name: name,
    ClusterArn: clusterArn(ctx, id),
    State: "WAITING",
    ReleaseLabel: stringOrUndefined(input["ReleaseLabel"]),
    LogUri: stringOrUndefined(input["LogUri"]),
    Steps: [],
  };
  ctx.store.set(clusterKey(id), cluster);
  return { JobFlowId: id, ClusterArn: cluster.ClusterArn };
};

const ListClusters: OperationHandler = (_input, ctx) => {
  const clusters = ctx.store
    .list<StoredCluster>()
    .filter((entry) => entry.key.startsWith("cluster/"))
    .map((entry) => ({
      Id: entry.value.Id,
      Name: entry.value.Name,
      ClusterArn: entry.value.ClusterArn,
      Status: statusOf(entry.value.State),
      NormalizedInstanceHours: 0,
    }));
  return { Clusters: clusters };
};

const DescribeCluster: OperationHandler = (input, ctx) => {
  const id = requireString(input, "ClusterId");
  const cluster = requireCluster(ctx, id);
  return {
    Cluster: {
      Id: cluster.Id,
      Name: cluster.Name,
      ClusterArn: cluster.ClusterArn,
      Status: statusOf(cluster.State),
      ReleaseLabel: cluster.ReleaseLabel,
      LogUri: cluster.LogUri,
      InstanceCollectionType: "INSTANCE_GROUP",
      AutoTerminate: false,
      TerminationProtected: false,
      VisibleToAllUsers: true,
      Tags: [],
    },
  };
};

const AddJobFlowSteps: OperationHandler = (input, ctx) => {
  const id = requireString(input, "JobFlowId");
  const cluster = requireCluster(ctx, id);
  const steps = Array.isArray(input["Steps"]) ? input["Steps"] : [];
  const added = steps.map((step) => ({
    Id: `s-${crypto.randomUUID().replace(/-/g, "").slice(0, 13).toUpperCase()}`,
    Name:
      typeof step === "object" && step !== null && "Name" in step
        ? String((step as Record<string, unknown>)["Name"])
        : "step",
  }));
  const updated: StoredCluster = {
    ...cluster,
    Steps: [...cluster.Steps, ...added],
  };
  ctx.store.set(clusterKey(id), updated);
  return { StepIds: added.map((step) => step.Id) };
};

const TerminateJobFlows: OperationHandler = (input, ctx) => {
  const ids = stringList(input["JobFlowIds"]);
  for (const id of ids) {
    ctx.store.delete(clusterKey(id));
  }
  return {};
};

const emr = {
  name: "elasticmapreduce",
  protocol: "json",
  operations: {
    RunJobFlow,
    ListClusters,
    DescribeCluster,
    AddJobFlowSteps,
    TerminateJobFlows,
  },
  model,
} as const satisfies ServiceDefinition;

export default emr;
