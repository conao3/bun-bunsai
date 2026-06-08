import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  CreateTestCaseCommand,
  DescribeContactCommand,
  StartContactEvaluationCommand,
  StartContactRecordingCommand,
  StartTaskContactCommand,
  StopContactCommand,
  StopContactRecordingCommand,
  StopContactStreamingCommand,
  StopTestCaseExecutionCommand,
  SubmitContactEvaluationCommand,
  SuspendContactRecordingCommand,
  TagContactCommand,
  TagResourceCommand,
  ListTagsForResourceCommand,
  StartContactStreamingCommand,
  StartWebRTCContactCommand,
  StartTestCaseExecutionCommand,
  StopContactMediaProcessingCommand,
} from "@aws-sdk/client-connect";

const { endpoint, requestHandler } = startApp();
const region = "us-east-1";
const credentials = { accessKeyId: "test", secretAccessKey: "test" } as const;
const client = new ConnectClient({
  endpoint,
  region,
  credentials,
  requestHandler,
});

test("chunk23: StartTaskContact → DescribeContact → StopContact + TagContact + recording/streaming lifecycle", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk23-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const taskRes = await client.send(
    new StartTaskContactCommand({
      InstanceId: instanceId,
      ContactFlowId: "flow-1",
      Name: "Test Task",
    }),
  );
  const contactId = taskRes.ContactId ?? "";
  expect(contactId).toBeTruthy();

  const described = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(described.Contact?.Id).toBe(contactId);
  expect(described.Contact?.TotalPauseCount).toBe(0);

  await client.send(
    new TagContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      Tags: { env: "test", owner: "e2e" },
    }),
  );

  const afterTag = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(afterTag.Contact?.Tags?.["env"]).toBe("test");
  expect(afterTag.Contact?.Tags?.["owner"]).toBe("e2e");

  await client.send(
    new StartContactRecordingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      InitialContactId: contactId,
      VoiceRecordingConfiguration: { VoiceRecordingTrack: "ALL" },
    }),
  );

  await client.send(
    new SuspendContactRecordingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      InitialContactId: contactId,
    }),
  );

  await client.send(
    new StopContactRecordingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      InitialContactId: contactId,
    }),
  );

  const streamRes = await client.send(
    new StartContactStreamingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      ChatStreamingConfiguration: {
        StreamingEndpointArn: "arn:aws:sns:us-east-1:123456789012:test",
      },
      ClientToken: "token-chunk23",
    }),
  );
  expect(streamRes.StreamingId).toBeTruthy();

  await client.send(
    new StopContactStreamingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      StreamingId: streamRes.StreamingId ?? "",
    }),
  );

  await client.send(
    new StopContactMediaProcessingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );

  await client.send(
    new StopContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );

  const webrtcRes = await client.send(
    new StartWebRTCContactCommand({
      InstanceId: instanceId,
      ContactFlowId: "flow-1",
      ParticipantDetails: { DisplayName: "TestParticipant" },
    }),
  );
  expect(webrtcRes.ContactId).toBeTruthy();
  expect(webrtcRes.ParticipantId).toBeTruthy();
  expect(webrtcRes.ParticipantToken).toBeTruthy();

  const arn = `arn:aws:connect:us-east-1:000000000000:instance/${instanceId}/contact/${contactId}`;
  await client.send(
    new TagResourceCommand({
      resourceArn: arn,
      tags: { tier: "standard" },
    }),
  );

  const tagsRes = await client.send(
    new ListTagsForResourceCommand({ resourceArn: arn }),
  );
  expect(tagsRes.tags?.["tier"]).toBe("standard");

  const evalRes = await client.send(
    new StartContactEvaluationCommand({
      InstanceId: instanceId,
      ContactId: webrtcRes.ContactId ?? "",
      EvaluationFormId: "form-1",
    }),
  );
  const evaluationId = evalRes.EvaluationId ?? "";
  expect(evaluationId).toBeTruthy();

  const submitRes = await client.send(
    new SubmitContactEvaluationCommand({
      InstanceId: instanceId,
      EvaluationId: evaluationId,
    }),
  );
  expect(submitRes.EvaluationId).toBe(evaluationId);
  expect(submitRes.EvaluationArn).toBeTruthy();

  const tc = await client.send(
    new CreateTestCaseCommand({
      InstanceId: instanceId,
      Name: "MyTestCase",
      Content: "{}",
    }),
  );
  const testCaseId = tc.TestCaseId ?? "";
  expect(testCaseId).toBeTruthy();

  const execRes = await client.send(
    new StartTestCaseExecutionCommand({
      InstanceId: instanceId,
      TestCaseId: testCaseId,
    }),
  );
  const executionId = execRes.TestCaseExecutionId ?? "";
  expect(executionId).toBeTruthy();
  expect(execRes.TestCaseId).toBe(testCaseId);

  await client.send(
    new StopTestCaseExecutionCommand({
      InstanceId: instanceId,
      TestCaseId: testCaseId,
      TestCaseExecutionId: executionId,
    }),
  );

  const missingContactErr = await client
    .send(
      new StopContactCommand({
        InstanceId: instanceId,
        ContactId: "non-existent-contact-id",
      }),
    )
    .catch((e: unknown) => e);
  expect((missingContactErr as { name: string }).name).toBe(
    "ResourceNotFoundException",
  );
});
