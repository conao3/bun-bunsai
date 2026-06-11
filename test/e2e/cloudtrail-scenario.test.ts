import { describe, expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  CloudTrailClient,
  CreateTrailCommand,
  DeleteTrailCommand,
  DescribeTrailsCommand,
  GetEventSelectorsCommand,
  GetTrailStatusCommand,
  ListTrailsCommand,
  LookupEventsCommand,
  PutEventSelectorsCommand,
  StartLoggingCommand,
  StopLoggingCommand,
} from "@aws-sdk/client-cloudtrail";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;

describe("CloudTrail scenario e2e", () => {
  const cloudtrail = () =>
    new CloudTrailClient({ endpoint, region, credentials, requestHandler });

  test("audit trail lifecycle: create → log → selectors → stop → delete", async () => {
    const client = cloudtrail();
    const trailName = "bunsai-e2e-scenario-audit-trail";
    const bucketName = "bunsai-e2e-scenario-bucket";

    const created = await client.send(
      new CreateTrailCommand({ Name: trailName, S3BucketName: bucketName }),
    );
    expect(created.Name).toBe(trailName);
    expect(created.TrailARN).toContain(trailName);

    const initialStatus = await client.send(
      new GetTrailStatusCommand({ Name: trailName }),
    );
    expect(initialStatus.IsLogging).toBe(false);
    expect(initialStatus.StartLoggingTime).toBeUndefined();

    await client.send(new StartLoggingCommand({ Name: trailName }));
    const afterStartStatus = await client.send(
      new GetTrailStatusCommand({ Name: trailName }),
    );
    expect(afterStartStatus.IsLogging).toBe(true);
    expect(afterStartStatus.StartLoggingTime).toBeDefined();
    expect(afterStartStatus.LatestDeliveryTime).toBeDefined();

    const putResult = await client.send(
      new PutEventSelectorsCommand({
        TrailName: trailName,
        EventSelectors: [
          {
            ReadWriteType: "All",
            IncludeManagementEvents: true,
          },
        ],
      }),
    );
    expect(putResult.TrailARN).toContain(trailName);
    expect(putResult.EventSelectors).toHaveLength(1);
    expect(putResult.EventSelectors?.[0]?.ReadWriteType).toBe("All");

    const getSelectors = await client.send(
      new GetEventSelectorsCommand({ TrailName: trailName }),
    );
    expect(getSelectors.EventSelectors).toHaveLength(1);
    expect(getSelectors.EventSelectors?.[0]?.IncludeManagementEvents).toBe(
      true,
    );

    const described = await client.send(new DescribeTrailsCommand({}));
    const allNames = (described.trailList ?? []).map((t) => t.Name);
    expect(allNames).toContain(trailName);

    const filteredDescribe = await client.send(
      new DescribeTrailsCommand({ trailNameList: [trailName] }),
    );
    expect((filteredDescribe.trailList ?? []).map((t) => t.Name)).toContain(
      trailName,
    );

    const listed = await client.send(new ListTrailsCommand({}));
    expect((listed.Trails ?? []).map((t) => t.Name)).toContain(trailName);

    const events = await client.send(new LookupEventsCommand({}));
    expect(events.Events ?? []).toEqual([]);

    await client.send(new StopLoggingCommand({ Name: trailName }));
    const afterStopStatus = await client.send(
      new GetTrailStatusCommand({ Name: trailName }),
    );
    expect(afterStopStatus.IsLogging).toBe(false);
    expect(afterStopStatus.StopLoggingTime).toBeDefined();

    await client.send(new DeleteTrailCommand({ Name: trailName }));

    await expect(
      client.send(new GetTrailStatusCommand({ Name: trailName })),
    ).rejects.toMatchObject({ name: "TrailNotFoundException" });

    const afterDelete = await client.send(new DescribeTrailsCommand({}));
    expect((afterDelete.trailList ?? []).map((t) => t.Name)).not.toContain(
      trailName,
    );
  });
});
