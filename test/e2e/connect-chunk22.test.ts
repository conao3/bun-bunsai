import { expect, test } from "bun:test";
import { startApp } from "./harness.ts";
import {
  ConnectClient,
  CreateInstanceCommand,
  DescribeContactCommand,
  StartChatContactCommand,
  StartContactRecordingCommand,
  StartContactStreamingCommand,
  StartEmailContactCommand,
  StartOutboundVoiceContactCommand,
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

test("chunk22: start contact ops lifecycle", async () => {
  const inst = await client.send(
    new CreateInstanceCommand({
      IdentityManagementType: "CONNECT_MANAGED",
      InstanceAlias: `bunsai-e2e-chunk22-${Date.now()}`,
      InboundCallsEnabled: true,
      OutboundCallsEnabled: true,
    }),
  );
  const instanceId = inst.Id ?? "";
  expect(instanceId).toBeTruthy();

  const chatRes = await client.send(
    new StartChatContactCommand({
      InstanceId: instanceId,
      ContactFlowId: "flow-1",
      ParticipantDetails: { DisplayName: "TestUser" },
    }),
  );
  const contactId = chatRes.ContactId ?? "";
  expect(contactId).toBeTruthy();
  expect(chatRes.ParticipantId).toBeTruthy();
  expect(chatRes.ParticipantToken).toBeTruthy();

  const described = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(described.Contact?.Id).toBe(contactId);
  expect(described.Contact?.TotalPauseCount).toBe(0);
  expect(described.Contact?.Recordings).toBeUndefined();

  await client.send(
    new StartContactRecordingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      InitialContactId: contactId,
      VoiceRecordingConfiguration: { VoiceRecordingTrack: "ALL" },
    }),
  );

  const afterRecording = await client.send(
    new DescribeContactCommand({
      InstanceId: instanceId,
      ContactId: contactId,
    }),
  );
  expect(afterRecording.Contact?.Recordings).toBeDefined();
  expect(Array.isArray(afterRecording.Contact?.Recordings)).toBe(true);
  expect((afterRecording.Contact?.Recordings?.length ?? 0) > 0).toBe(true);

  const streamRes = await client.send(
    new StartContactStreamingCommand({
      InstanceId: instanceId,
      ContactId: contactId,
      ChatStreamingConfiguration: {
        StreamingEndpointArn: "arn:aws:sns:us-east-1:123456789012:test",
      },
      ClientToken: "token-1",
    }),
  );
  expect(streamRes.StreamingId).toBeTruthy();

  const emailRes = await client.send(
    new StartEmailContactCommand({
      InstanceId: instanceId,
      FromEmailAddress: { EmailAddress: "from@example.com" },
      DestinationEmailAddress: "to@example.com",
      EmailMessage: {
        MessageSourceType: "RAW",
        RawMessage: {
          Subject: "Test",
          Body: "Hello",
          ContentType: "text/plain",
        },
      },
    }),
  );
  expect(emailRes.ContactId).toBeTruthy();

  const voiceRes = await client.send(
    new StartOutboundVoiceContactCommand({
      InstanceId: instanceId,
      DestinationPhoneNumber: "+15551234567",
      ContactFlowId: "flow-1",
    }),
  );
  expect(voiceRes.ContactId).toBeTruthy();

  const missingInstanceErr = await client
    .send(
      new StartChatContactCommand({
        InstanceId: "non-existent-instance-id",
        ContactFlowId: "flow-1",
        ParticipantDetails: { DisplayName: "TestUser" },
      }),
    )
    .catch((e: unknown) => e);
  expect((missingInstanceErr as { name: string }).name).toBe(
    "ResourceNotFoundException",
  );
});
