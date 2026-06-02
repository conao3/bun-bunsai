import type { ServiceDefinition } from "../core/types.ts";
import sts from "./sts.ts";
import s3 from "./s3.ts";
import sqs from "./sqs.ts";

export const services: ServiceDefinition[] = [sts, s3, sqs];

export const findService = (name: string): ServiceDefinition | undefined =>
  services.find((s) => s.name === name);
