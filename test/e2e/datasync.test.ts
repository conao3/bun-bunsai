import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CancelTaskExecutionCommand,
  CreateAgentCommand,
  CreateLocationAzureBlobCommand,
  CreateLocationEfsCommand,
  CreateLocationFsxLustreCommand,
  CreateLocationFsxOntapCommand,
  CreateLocationFsxOpenZfsCommand,
  CreateLocationFsxWindowsCommand,
  CreateLocationHdfsCommand,
  CreateLocationNfsCommand,
  CreateLocationObjectStorageCommand,
  CreateLocationS3Command,
  CreateLocationSmbCommand,
  CreateTaskCommand,
  DataSyncClient,
  DeleteAgentCommand,
  DeleteLocationCommand,
  DeleteTaskCommand,
  DescribeAgentCommand,
  DescribeLocationAzureBlobCommand,
  DescribeLocationEfsCommand,
  DescribeLocationFsxLustreCommand,
  DescribeLocationFsxOntapCommand,
  DescribeLocationFsxOpenZfsCommand,
  DescribeLocationFsxWindowsCommand,
  DescribeLocationHdfsCommand,
  DescribeLocationNfsCommand,
  DescribeLocationObjectStorageCommand,
  DescribeLocationS3Command,
  DescribeLocationSmbCommand,
  DescribeTaskCommand,
  DescribeTaskExecutionCommand,
  ListAgentsCommand,
  ListLocationsCommand,
  ListTagsForResourceCommand,
  ListTaskExecutionsCommand,
  ListTasksCommand,
  StartTaskExecutionCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateAgentCommand,
  UpdateLocationNfsCommand,
  UpdateLocationS3Command,
  UpdateTaskCommand,
  UpdateTaskExecutionCommand,
} from "@aws-sdk/client-datasync";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

const client = () =>
  new DataSyncClient({ endpoint, region, credentials, requestHandler });

test("datasync location and task round-trip", async () => {
  const datasync = client();

  const source = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::bunsai-source-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/datasync-source",
      },
      Subdirectory: "/source",
    }),
  );
  const sourceArn = source.LocationArn;
  expect(sourceArn).toContain(":location/loc-");

  const destination = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::bunsai-destination-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/datasync-dest",
      },
      Subdirectory: "/destination",
    }),
  );
  const destinationArn = destination.LocationArn;
  expect(destinationArn).toContain(":location/loc-");

  const listedLocations = await datasync.send(new ListLocationsCommand({}));
  const locationArns = (listedLocations.Locations ?? []).map(
    (entry) => entry.LocationArn,
  );
  expect(locationArns).toContain(sourceArn);
  expect(locationArns).toContain(destinationArn);

  const createdTask = await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: sourceArn,
      DestinationLocationArn: destinationArn,
      Name: "bunsai-e2e-task",
    }),
  );
  const taskArn = createdTask.TaskArn;
  expect(taskArn).toContain(":task/task-");

  const describedTask = await datasync.send(
    new DescribeTaskCommand({ TaskArn: taskArn }),
  );
  expect(describedTask.TaskArn).toBe(taskArn);
  expect(describedTask.Name).toBe("bunsai-e2e-task");
  expect(describedTask.SourceLocationArn).toBe(sourceArn);
  expect(describedTask.DestinationLocationArn).toBe(destinationArn);
  expect(describedTask.Status).toBe("AVAILABLE");

  const listedTasks = await datasync.send(new ListTasksCommand({}));
  const taskArns = (listedTasks.Tasks ?? []).map((entry) => entry.TaskArn);
  expect(taskArns).toContain(taskArn);

  const execution = await datasync.send(
    new StartTaskExecutionCommand({ TaskArn: taskArn }),
  );
  expect(execution.TaskExecutionArn).toContain(`${taskArn}/execution/exec-`);

  const runningTask = await datasync.send(
    new DescribeTaskCommand({ TaskArn: taskArn }),
  );
  expect(runningTask.Status).toBe("RUNNING");
  expect(runningTask.CurrentTaskExecutionArn).toBe(execution.TaskExecutionArn);

  await datasync.send(new DeleteTaskCommand({ TaskArn: taskArn }));

  await expect(
    datasync.send(new DescribeTaskCommand({ TaskArn: taskArn })),
  ).rejects.toThrow();
});

test("datasync agent round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateAgentCommand({ ActivationKey: "AAAAA-BBBBB-CCCCC-DDDDD-EEEEE" }),
  );
  const agentArn = created.AgentArn;
  expect(agentArn).toContain(":agent/agent-");

  const described = await datasync.send(
    new DescribeAgentCommand({ AgentArn: agentArn }),
  );
  expect(described.AgentArn).toBe(agentArn);
  expect(described.Status).toBe("ONLINE");

  const listed = await datasync.send(new ListAgentsCommand({}));
  const arns = (listed.Agents ?? []).map((a) => a.AgentArn);
  expect(arns).toContain(agentArn);

  await datasync.send(
    new UpdateAgentCommand({ AgentArn: agentArn, Name: "renamed" }),
  );

  const afterUpdate = await datasync.send(
    new DescribeAgentCommand({ AgentArn: agentArn }),
  );
  expect(afterUpdate.Name).toBe("renamed");

  await datasync.send(new DeleteAgentCommand({ AgentArn: agentArn }));

  await expect(
    datasync.send(new DescribeAgentCommand({ AgentArn: agentArn })),
  ).rejects.toThrow();
});

test("datasync DescribeLocationS3 and DeleteLocation", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::describe-test-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/role",
      },
    }),
  );
  const locArn = created.LocationArn!;

  const described = await datasync.send(
    new DescribeLocationS3Command({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("s3://");
  expect(described.S3Config?.BucketAccessRoleArn).toBe(
    "arn:aws:iam::000000000000:role/role",
  );

  await datasync.send(
    new UpdateLocationS3Command({
      LocationArn: locArn,
      S3StorageClass: "STANDARD_IA",
    }),
  );

  await datasync.send(new DeleteLocationCommand({ LocationArn: locArn }));

  await expect(
    datasync.send(new DescribeLocationS3Command({ LocationArn: locArn })),
  ).rejects.toThrow();
});

test("datasync NFS location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationNfsCommand({
      ServerHostname: "nfs.example.com",
      Subdirectory: "/exports/data",
      OnPremConfig: { AgentArns: [] },
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationNfsCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("nfs://");

  await datasync.send(
    new UpdateLocationNfsCommand({
      LocationArn: locArn,
      Subdirectory: "/exports/updated",
    }),
  );
});

test("datasync SMB location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationSmbCommand({
      ServerHostname: "smb.example.com",
      Subdirectory: "/share",
      User: "Administrator",
      Password: "Password1",
      AgentArns: [],
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationSmbCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("smb://");
  expect(described.User).toBe("Administrator");
});

test("datasync HDFS location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationHdfsCommand({
      NameNodes: [{ Hostname: "namenode.example.com", Port: 8020 }],
      AuthenticationType: "SIMPLE",
      SimpleUser: "hadoop",
      AgentArns: [],
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationHdfsCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.AuthenticationType).toBe("SIMPLE");
  expect(described.SimpleUser).toBe("hadoop");
});

test("datasync EFS location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationEfsCommand({
      EfsFilesystemArn:
        "arn:aws:elasticfilesystem:us-east-1:000000000000:file-system/fs-12345678",
      Ec2Config: {
        SubnetArn: "arn:aws:ec2:us-east-1:000000000000:subnet/subnet-12345678",
        SecurityGroupArns: [
          "arn:aws:ec2:us-east-1:000000000000:security-group/sg-12345678",
        ],
      },
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationEfsCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("efs://");
});

test("datasync FSx Windows location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationFsxWindowsCommand({
      FsxFilesystemArn:
        "arn:aws:fsx:us-east-1:000000000000:file-system/fs-12345678",
      SecurityGroupArns: [
        "arn:aws:ec2:us-east-1:000000000000:security-group/sg-12345678",
      ],
      User: "Admin",
      Password: "Password1",
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationFsxWindowsCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("fsxw://");
  expect(described.User).toBe("Admin");
});

test("datasync FSx Lustre location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationFsxLustreCommand({
      FsxFilesystemArn:
        "arn:aws:fsx:us-east-1:000000000000:file-system/fs-lustre01",
      SecurityGroupArns: [
        "arn:aws:ec2:us-east-1:000000000000:security-group/sg-12345678",
      ],
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationFsxLustreCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("fsxl://");
});

test("datasync FSx OpenZFS location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationFsxOpenZfsCommand({
      FsxFilesystemArn:
        "arn:aws:fsx:us-east-1:000000000000:file-system/fs-openzfs01",
      SecurityGroupArns: [
        "arn:aws:ec2:us-east-1:000000000000:security-group/sg-12345678",
      ],
      Protocol: { NFS: { MountOptions: { Version: "AUTOMATIC" } } },
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationFsxOpenZfsCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("fsxz://");
});

test("datasync FSx ONTAP location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationFsxOntapCommand({
      StorageVirtualMachineArn:
        "arn:aws:fsx:us-east-1:000000000000:storage-virtual-machine/fs-12345678/svm-12345678",
      SecurityGroupArns: [
        "arn:aws:ec2:us-east-1:000000000000:security-group/sg-12345678",
      ],
      Protocol: {
        SMB: { MountOptions: { Version: "AUTOMATIC" }, User: "bunsai" },
      },
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationFsxOntapCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("fsxo://");
  expect(described.StorageVirtualMachineArn).toContain("svm-");
});

test("datasync Azure Blob location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationAzureBlobCommand({
      ContainerUrl: "https://myaccount.blob.core.windows.net/mycontainer",
      AuthenticationType: "SAS",
      AgentArns: [],
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationAzureBlobCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.AuthenticationType).toBe("SAS");
});

test("datasync ObjectStorage location round-trip", async () => {
  const datasync = client();

  const created = await datasync.send(
    new CreateLocationObjectStorageCommand({
      ServerHostname: "s3.example.com",
      BucketName: "my-bucket",
      AgentArns: [],
    }),
  );
  const locArn = created.LocationArn!;
  expect(locArn).toContain(":location/loc-");

  const described = await datasync.send(
    new DescribeLocationObjectStorageCommand({ LocationArn: locArn }),
  );
  expect(described.LocationArn).toBe(locArn);
  expect(described.LocationUri).toContain("object-storage://");
});

test("datasync task execution describe, list, cancel", async () => {
  const datasync = client();

  const srcLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::exec-test-src",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const dstLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::exec-test-dst",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const task = await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: srcLoc.LocationArn,
      DestinationLocationArn: dstLoc.LocationArn,
    }),
  );
  const tArn = task.TaskArn!;

  const exec = await datasync.send(
    new StartTaskExecutionCommand({ TaskArn: tArn }),
  );
  const execArn = exec.TaskExecutionArn!;

  const described = await datasync.send(
    new DescribeTaskExecutionCommand({ TaskExecutionArn: execArn }),
  );
  expect(described.TaskExecutionArn).toBe(execArn);
  expect(described.Status).toBeDefined();

  const listed = await datasync.send(
    new ListTaskExecutionsCommand({ TaskArn: tArn }),
  );
  const listedArns = (listed.TaskExecutions ?? []).map(
    (e) => e.TaskExecutionArn,
  );
  expect(listedArns).toContain(execArn);

  await datasync.send(
    new UpdateTaskExecutionCommand({ TaskExecutionArn: execArn, Options: {} }),
  );

  await datasync.send(
    new CancelTaskExecutionCommand({ TaskExecutionArn: execArn }),
  );

  const afterCancel = await datasync.send(
    new DescribeTaskExecutionCommand({ TaskExecutionArn: execArn }),
  );
  expect(afterCancel.Status).toBe("ERROR");
});

test("datasync UpdateTask", async () => {
  const datasync = client();

  const srcLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::update-task-src",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const dstLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::update-task-dst",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const task = await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: srcLoc.LocationArn,
      DestinationLocationArn: dstLoc.LocationArn,
      Name: "original-name",
    }),
  );
  const tArn = task.TaskArn!;

  await datasync.send(
    new UpdateTaskCommand({ TaskArn: tArn, Name: "updated-name" }),
  );

  const described = await datasync.send(
    new DescribeTaskCommand({ TaskArn: tArn }),
  );
  expect(described.Name).toBe("updated-name");
});

test("datasync ListTasks pagination", async () => {
  const datasync = client();

  const srcLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::pagination-src",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const dstLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::pagination-dst",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );

  const createdArns: string[] = [];
  for (let i = 0; i < 3; i++) {
    const t = await datasync.send(
      new CreateTaskCommand({
        SourceLocationArn: srcLoc.LocationArn,
        DestinationLocationArn: dstLoc.LocationArn,
        Name: `page-task-${i}`,
      }),
    );
    createdArns.push(t.TaskArn!);
  }

  const page1 = await datasync.send(new ListTasksCommand({ MaxResults: 2 }));
  expect((page1.Tasks ?? []).length).toBeGreaterThanOrEqual(1);
  expect(page1.NextToken).toBeDefined();

  const allArns: (string | undefined)[] = (page1.Tasks ?? []).map(
    (t) => t.TaskArn,
  );
  let nextToken: string | undefined = page1.NextToken;
  while (nextToken !== undefined) {
    const page = await datasync.send(
      new ListTasksCommand({ MaxResults: 2, NextToken: nextToken }),
    );
    allArns.push(...(page.Tasks ?? []).map((t) => t.TaskArn));
    nextToken = page.NextToken;
  }

  for (const arn of createdArns) {
    expect(allArns).toContain(arn);
  }
});

test("datasync ListTasks filter by LocationId", async () => {
  const datasync = client();

  const srcLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::filter-src-unique",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const dstLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::filter-dst-unique",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const otherSrc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::filter-other-src",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );

  const targetTask = await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: srcLoc.LocationArn,
      DestinationLocationArn: dstLoc.LocationArn,
      Name: "filter-target-task",
    }),
  );
  await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: otherSrc.LocationArn,
      DestinationLocationArn: dstLoc.LocationArn,
      Name: "filter-other-task",
    }),
  );

  const filtered = await datasync.send(
    new ListTasksCommand({
      Filters: [
        {
          Name: "LocationId",
          Values: [srcLoc.LocationArn!],
          Operator: "Equals",
        },
      ],
    }),
  );
  const filteredArns = (filtered.Tasks ?? []).map((t) => t.TaskArn);
  expect(filteredArns).toContain(targetTask.TaskArn);
  for (const arn of filteredArns) {
    expect(arn).not.toBeUndefined();
  }
});

test("datasync CreateTask missing location error", async () => {
  const datasync = client();

  const fakeArn =
    "arn:aws:datasync:us-east-1:000000000000:location/loc-nonexistent";

  const srcLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::missing-loc-src",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );

  await expect(
    datasync.send(
      new CreateTaskCommand({
        SourceLocationArn: fakeArn,
        DestinationLocationArn: srcLoc.LocationArn,
      }),
    ),
  ).rejects.toThrow();

  await expect(
    datasync.send(
      new CreateTaskCommand({
        SourceLocationArn: srcLoc.LocationArn,
        DestinationLocationArn: fakeArn,
      }),
    ),
  ).rejects.toThrow();
});

test("datasync tag operations", async () => {
  const datasync = client();

  const loc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::tag-test-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/r",
      },
    }),
  );
  const resourceArn = loc.LocationArn!;

  await datasync.send(
    new TagResourceCommand({
      ResourceArn: resourceArn,
      Tags: [{ Key: "env", Value: "test" }],
    }),
  );

  const listed = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  const tags = listed.Tags ?? [];
  expect(tags.some((t) => t.Key === "env" && t.Value === "test")).toBe(true);

  await datasync.send(
    new UntagResourceCommand({ ResourceArn: resourceArn, Keys: ["env"] }),
  );

  const afterUntag = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: resourceArn }),
  );
  expect((afterUntag.Tags ?? []).some((t) => t.Key === "env")).toBe(false);
});

test("datasync fidelity: create-time tags, dedup, cleanup, in-use guard", async () => {
  const datasync = client();

  const loc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::fidelity-src-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/fidelity-role",
      },
      Tags: [{ Key: "tier", Value: "12" }],
    }),
  );
  const locArn = loc.LocationArn!;

  const afterCreate = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: locArn }),
  );
  expect(
    (afterCreate.Tags ?? []).some((t) => t.Key === "tier" && t.Value === "12"),
  ).toBe(true);

  await datasync.send(
    new TagResourceCommand({
      ResourceArn: locArn,
      Tags: [{ Key: "tier", Value: "updated" }],
    }),
  );
  const afterDedup = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: locArn }),
  );
  const tierTags = (afterDedup.Tags ?? []).filter((t) => t.Key === "tier");
  expect(tierTags.length).toBe(1);
  expect(tierTags[0]?.Value).toBe("updated");

  const dstLoc = await datasync.send(
    new CreateLocationS3Command({
      S3BucketArn: "arn:aws:s3:::fidelity-dst-bucket",
      S3Config: {
        BucketAccessRoleArn: "arn:aws:iam::000000000000:role/fidelity-role",
      },
    }),
  );
  const dstArn = dstLoc.LocationArn!;

  const task = await datasync.send(
    new CreateTaskCommand({
      SourceLocationArn: locArn,
      DestinationLocationArn: dstArn,
      Name: "fidelity-task",
      Tags: [{ Key: "task-tag", Value: "yes" }],
    }),
  );
  const taskArn = task.TaskArn!;

  const taskTags = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: taskArn }),
  );
  expect(
    (taskTags.Tags ?? []).some(
      (t) => t.Key === "task-tag" && t.Value === "yes",
    ),
  ).toBe(true);

  await expect(
    datasync.send(new DeleteLocationCommand({ LocationArn: locArn })),
  ).rejects.toThrow();

  await datasync.send(new DeleteTaskCommand({ TaskArn: taskArn }));

  const afterTaskDelete = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: taskArn }),
  );
  expect((afterTaskDelete.Tags ?? []).length).toBe(0);

  await datasync.send(new DeleteLocationCommand({ LocationArn: locArn }));

  const afterLocDelete = await datasync.send(
    new ListTagsForResourceCommand({ ResourceArn: locArn }),
  );
  expect((afterLocDelete.Tags ?? []).length).toBe(0);
});
