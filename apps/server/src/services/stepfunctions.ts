import { awsError } from "../core/framework.ts";
import { loadServiceModel } from "../core/shapes.ts";
import { invokeTaskResource } from "../core/events.ts";
import { parseArn } from "../core/arn.ts";
import stepFunctionsModel from "../../../../test/vendor/aws-models/stepfunctions.json" with { type: "json" };
import type {
  OperationHandler,
  ServiceContext,
  ServiceDefinition,
} from "../core/types.ts";

const model = loadServiceModel(stepFunctionsModel);

type StoredStateMachine = {
  stateMachineArn: string;
  name: string;
  definition: string;
  roleArn: string;
  type: string;
  status: string;
  creationDate: number;
};

type HistoryEvent = {
  timestamp: number;
  type: string;
  id: number;
  previousEventId: number;
  executionStartedEventDetails?: { input: string };
  executionSucceededEventDetails?: { output: string };
  executionFailedEventDetails?: { error?: string; cause?: string };
  executionAbortedEventDetails?: { error?: string; cause?: string };
  stateEnteredEventDetails?: { name: string; input: string };
  stateExitedEventDetails?: { name: string; output: string };
  taskScheduledEventDetails?: {
    resourceType: string;
    resource: string;
    region: string;
    parameters: string;
  };
  taskSucceededEventDetails?: {
    resourceType: string;
    resource: string;
    output: string;
  };
  taskFailedEventDetails?: {
    resourceType: string;
    resource: string;
    error?: string;
    cause?: string;
  };
  mapIterationStartedEventDetails?: { name: string; index: number };
  mapIterationSucceededEventDetails?: { name: string; index: number };
  mapIterationFailedEventDetails?: { name: string; index: number };
};

type StoredExecution = {
  executionArn: string;
  stateMachineArn: string;
  name: string;
  status: string;
  startDate: number;
  stopDate: number | undefined;
  input: string;
  output: string | undefined;
  error: string | undefined;
  cause: string | undefined;
  events: HistoryEvent[];
};

type AslChoiceCondition = {
  Variable?: string;
  StringEquals?: string;
  StringEqualsPath?: string;
  StringGreaterThan?: string;
  StringLessThan?: string;
  StringGreaterThanOrEquals?: string;
  StringLessThanOrEquals?: string;
  NumericEquals?: number;
  NumericEqualsPath?: string;
  NumericGreaterThan?: number;
  NumericLessThan?: number;
  NumericGreaterThanOrEquals?: number;
  NumericLessThanOrEquals?: number;
  BooleanEquals?: boolean;
  BooleanEqualsPath?: string;
  IsNull?: boolean;
  IsPresent?: boolean;
  IsNumeric?: boolean;
  IsString?: boolean;
  IsBoolean?: boolean;
  And?: AslChoiceCondition[];
  Or?: AslChoiceCondition[];
  Not?: AslChoiceCondition;
};

type AslChoiceRule = AslChoiceCondition & { Next: string };

type AslRetryConfig = {
  ErrorEquals: string[];
  MaxAttempts?: number;
  IntervalSeconds?: number;
};

type AslCatchConfig = {
  ErrorEquals: string[];
  Next: string;
  ResultPath?: string | null;
};

type AslState = {
  Type: string;
  Next?: string;
  End?: boolean;
  Result?: unknown;
  ResultPath?: string | null;
  ResultSelector?: Record<string, unknown>;
  Parameters?: Record<string, unknown>;
  OutputPath?: string | null;
  Choices?: AslChoiceRule[];
  Default?: string;
  Error?: string;
  Cause?: string;
  Seconds?: number;
  Resource?: string;
  Retry?: AslRetryConfig[];
  Catch?: AslCatchConfig[];
  ItemsPath?: string;
  Iterator?: AslDefinition;
  ItemProcessor?: AslDefinition;
  MaxConcurrency?: number;
  Branches?: AslDefinition[];
};

type AslDefinition = {
  StartAt: string;
  States: Record<string, AslState>;
};

type AslExecutionResult = {
  status: "SUCCEEDED" | "FAILED" | "RUNNING";
  output: string;
  error?: string;
  cause?: string;
  events: HistoryEvent[];
  pendingToken?: string;
};

type PendingTask = {
  readonly activityArn: string;
  readonly input: string;
  readonly executionArn: string;
  readonly resume: (output: string) => Promise<AslExecutionResult>;
  readonly fail: (
    error: string | undefined,
    cause: string | undefined,
  ) => AslExecutionResult;
};

const pendingTasks = new Map<string, PendingTask>();
const activityQueues = new Map<string, string[]>();

const jsonPathGet = (data: unknown, path: string): unknown => {
  if (path === "$") return data;
  if (!path.startsWith("$.")) return undefined;
  const parts = path.slice(2).split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
};

const jsonPathSet = (data: unknown, path: string, value: unknown): unknown => {
  if (path === "$") return value;
  const inputObj =
    typeof data === "object" && data !== null
      ? (data as Record<string, unknown>)
      : {};
  const parts = path.slice(2).split(".");
  const clone: Record<string, unknown> = { ...inputObj };
  let current = clone;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const child = current[part];
    current[part] =
      typeof child === "object" && child !== null
        ? { ...(child as Record<string, unknown>) }
        : {};
    current = current[part] as Record<string, unknown>;
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart !== undefined) current[lastPart] = value;
  return clone;
};

const applyParameters = (
  params: Record<string, unknown>,
  input: unknown,
): unknown => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (key.endsWith(".$")) {
      result[key.slice(0, -2)] =
        typeof value === "string" ? jsonPathGet(input, value) : undefined;
    } else {
      result[key] = value;
    }
  }
  return result;
};

const evaluateCondition = (
  condition: AslChoiceCondition,
  input: unknown,
): boolean => {
  if (condition.And !== undefined)
    return condition.And.every((c) => evaluateCondition(c, input));
  if (condition.Or !== undefined)
    return condition.Or.some((c) => evaluateCondition(c, input));
  if (condition.Not !== undefined)
    return !evaluateCondition(condition.Not, input);

  const varValue =
    condition.Variable !== undefined
      ? jsonPathGet(input, condition.Variable)
      : undefined;

  if (condition.IsPresent !== undefined)
    return condition.IsPresent === (varValue !== undefined);
  if (condition.IsNull !== undefined)
    return condition.IsNull === (varValue === null);
  if (condition.IsNumeric !== undefined)
    return condition.IsNumeric === (typeof varValue === "number");
  if (condition.IsString !== undefined)
    return condition.IsString === (typeof varValue === "string");
  if (condition.IsBoolean !== undefined)
    return condition.IsBoolean === (typeof varValue === "boolean");
  if (condition.StringEquals !== undefined)
    return varValue === condition.StringEquals;
  if (condition.StringEqualsPath !== undefined)
    return varValue === jsonPathGet(input, condition.StringEqualsPath);
  if (condition.StringGreaterThan !== undefined)
    return (
      typeof varValue === "string" && varValue > condition.StringGreaterThan
    );
  if (condition.StringLessThan !== undefined)
    return typeof varValue === "string" && varValue < condition.StringLessThan;
  if (condition.StringGreaterThanOrEquals !== undefined)
    return (
      typeof varValue === "string" &&
      varValue >= condition.StringGreaterThanOrEquals
    );
  if (condition.StringLessThanOrEquals !== undefined)
    return (
      typeof varValue === "string" &&
      varValue <= condition.StringLessThanOrEquals
    );
  if (condition.NumericEquals !== undefined)
    return varValue === condition.NumericEquals;
  if (condition.NumericEqualsPath !== undefined)
    return varValue === jsonPathGet(input, condition.NumericEqualsPath);
  if (condition.NumericGreaterThan !== undefined)
    return (
      typeof varValue === "number" && varValue > condition.NumericGreaterThan
    );
  if (condition.NumericLessThan !== undefined)
    return typeof varValue === "number" && varValue < condition.NumericLessThan;
  if (condition.NumericGreaterThanOrEquals !== undefined)
    return (
      typeof varValue === "number" &&
      varValue >= condition.NumericGreaterThanOrEquals
    );
  if (condition.NumericLessThanOrEquals !== undefined)
    return (
      typeof varValue === "number" &&
      varValue <= condition.NumericLessThanOrEquals
    );
  if (condition.BooleanEquals !== undefined)
    return varValue === condition.BooleanEquals;
  if (condition.BooleanEqualsPath !== undefined)
    return varValue === jsonPathGet(input, condition.BooleanEqualsPath);
  return false;
};

const matchesError = (
  errorEquals: string[],
  error: string | undefined,
): boolean => {
  if (errorEquals.includes("States.ALL")) return true;
  return error !== undefined && errorEquals.includes(error);
};

const runAslStates = async (
  definition: AslDefinition,
  initialInput: unknown,
  startStateName: string,
  events: HistoryEvent[],
  idRef: { n: number },
  ctx: ServiceContext,
  executionArn: string,
): Promise<AslExecutionResult> => {
  const addEvent = (
    type: string,
    details: Omit<
      HistoryEvent,
      "timestamp" | "type" | "id" | "previousEventId"
    > = {},
  ): void => {
    const id = idRef.n++;
    events.push({
      timestamp: Math.floor(Date.now() / 1000),
      type,
      id,
      previousEventId: id - 1,
      ...details,
    });
  };

  let currentInput = initialInput;
  let currentStateName = startStateName;
  const maxDepth = 100;

  stateLoop: for (let depth = 0; depth < maxDepth; depth++) {
    const state = definition.States[currentStateName];
    if (state === undefined) {
      addEvent("ExecutionFailed", {
        executionFailedEventDetails: {
          error: "States.Runtime",
          cause: `State '${currentStateName}' not found`,
        },
      });
      return {
        status: "FAILED",
        output: "{}",
        error: "States.Runtime",
        cause: `State '${currentStateName}' not found`,
        events,
      };
    }

    const stateName = currentStateName;
    const stateInput = JSON.stringify(currentInput);

    if (state.Type === "Pass") {
      addEvent("PassStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      const rawInput = currentInput;
      const effectiveInput =
        state.Parameters !== undefined
          ? applyParameters(state.Parameters, rawInput)
          : rawInput;
      const result = state.Result !== undefined ? state.Result : effectiveInput;
      let stateOutput: unknown;
      if (state.ResultPath === null) {
        stateOutput = rawInput;
      } else if (state.ResultPath !== undefined) {
        stateOutput = jsonPathSet(rawInput, state.ResultPath, result);
      } else {
        stateOutput = result;
      }
      let output: unknown;
      if (state.OutputPath === null) {
        output = {};
      } else if (state.OutputPath !== undefined) {
        output = jsonPathGet(stateOutput, state.OutputPath);
      } else {
        output = stateOutput;
      }
      addEvent("PassStateExited", {
        stateExitedEventDetails: {
          name: stateName,
          output: JSON.stringify(output),
        },
      });
      if (state.End === true) {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: { output: JSON.stringify(output) },
        });
        return { status: "SUCCEEDED", output: JSON.stringify(output), events };
      }
      currentInput = output;
      currentStateName = state.Next!;
    } else if (state.Type === "Choice") {
      addEvent("ChoiceStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      const choices = state.Choices ?? [];
      let nextState: string | undefined;
      for (const choice of choices) {
        if (evaluateCondition(choice, currentInput)) {
          nextState = choice.Next;
          break;
        }
      }
      if (nextState === undefined) nextState = state.Default;
      if (nextState === undefined) {
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: {
            error: "States.NoChoiceMatched",
            cause: "No choice matched and no default state",
          },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: "States.NoChoiceMatched",
          cause: "No choice matched and no default state",
          events,
        };
      }
      addEvent("ChoiceStateExited", {
        stateExitedEventDetails: { name: stateName, output: stateInput },
      });
      currentStateName = nextState;
    } else if (state.Type === "Succeed") {
      addEvent("SucceedStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      addEvent("ExecutionSucceeded", {
        executionSucceededEventDetails: {
          output: JSON.stringify(currentInput),
        },
      });
      return {
        status: "SUCCEEDED",
        output: JSON.stringify(currentInput),
        events,
      };
    } else if (state.Type === "Fail") {
      addEvent("FailStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      addEvent("ExecutionFailed", {
        executionFailedEventDetails: { error: state.Error, cause: state.Cause },
      });
      return {
        status: "FAILED",
        output: "{}",
        error: state.Error,
        cause: state.Cause,
        events,
      };
    } else if (state.Type === "Wait") {
      addEvent("WaitStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      addEvent("WaitStateExited", {
        stateExitedEventDetails: { name: stateName, output: stateInput },
      });
      if (state.End === true) {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: {
            output: JSON.stringify(currentInput),
          },
        });
        return {
          status: "SUCCEEDED",
          output: JSON.stringify(currentInput),
          events,
        };
      }
      currentStateName = state.Next!;
    } else if (state.Type === "Task") {
      addEvent("TaskStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      const rawInput = currentInput;
      const effectiveInput =
        state.Parameters !== undefined
          ? applyParameters(state.Parameters, rawInput)
          : rawInput;
      const resource = state.Resource ?? "";
      const parsedResource = parseArn(resource);
      const isActivityResource =
        parsedResource?.service === "states" &&
        parsedResource.resource.startsWith("activity:");
      const isWaitForToken =
        !isActivityResource && resource.endsWith(".waitForTaskToken");

      if (isActivityResource || isWaitForToken) {
        const activityArn = isActivityResource
          ? resource
          : resource.slice(0, -".waitForTaskToken".length);
        const token = crypto.randomUUID();
        const effectiveInputStr = JSON.stringify(effectiveInput);

        addEvent("TaskScheduled", {
          taskScheduledEventDetails: {
            resourceType: "activity",
            resource: activityArn,
            region: ctx.region,
            parameters: effectiveInputStr,
          },
        });

        const resume = async (
          taskOutputStr: string,
        ): Promise<AslExecutionResult> => {
          addEvent("TaskSucceeded", {
            taskSucceededEventDetails: {
              resourceType: "activity",
              resource: activityArn,
              output: taskOutputStr,
            },
          });
          let taskOutput: unknown;
          try {
            taskOutput = JSON.parse(taskOutputStr);
          } catch {
            taskOutput = taskOutputStr;
          }
          const selectedResult =
            state.ResultSelector !== undefined
              ? applyParameters(state.ResultSelector, taskOutput)
              : taskOutput;
          let stateOutput: unknown;
          if (state.ResultPath === null) {
            stateOutput = rawInput;
          } else if (state.ResultPath !== undefined) {
            stateOutput = jsonPathSet(
              rawInput,
              state.ResultPath,
              selectedResult,
            );
          } else {
            stateOutput = selectedResult;
          }
          let output: unknown;
          if (state.OutputPath === null) {
            output = {};
          } else if (state.OutputPath !== undefined) {
            output = jsonPathGet(stateOutput, state.OutputPath);
          } else {
            output = stateOutput;
          }
          addEvent("TaskStateExited", {
            stateExitedEventDetails: {
              name: stateName,
              output: JSON.stringify(output),
            },
          });
          if (state.End === true) {
            addEvent("ExecutionSucceeded", {
              executionSucceededEventDetails: {
                output: JSON.stringify(output),
              },
            });
            return {
              status: "SUCCEEDED",
              output: JSON.stringify(output),
              events,
            };
          }
          return runAslStates(
            definition,
            output,
            state.Next!,
            events,
            idRef,
            ctx,
            executionArn,
          );
        };

        const fail = (
          error: string | undefined,
          cause: string | undefined,
        ): AslExecutionResult => {
          addEvent("TaskFailed", {
            taskFailedEventDetails: {
              resourceType: "activity",
              resource: activityArn,
              error,
              cause,
            },
          });
          addEvent("ExecutionFailed", {
            executionFailedEventDetails: { error, cause },
          });
          return { status: "FAILED", output: "{}", error, cause, events };
        };

        pendingTasks.set(token, {
          activityArn,
          input: effectiveInputStr,
          executionArn,
          resume,
          fail,
        });
        const queue = activityQueues.get(activityArn) ?? [];
        queue.push(token);
        activityQueues.set(activityArn, queue);

        return { status: "RUNNING", output: "{}", events, pendingToken: token };
      }

      let functionArn: string;
      let lambdaPayload: unknown;
      let isOptimistic: boolean;
      if (resource === "arn:aws:states:::lambda:invoke") {
        const params = effectiveInput as Record<string, unknown>;
        const fn = params.FunctionName;
        if (typeof fn !== "string") {
          addEvent("ExecutionFailed", {
            executionFailedEventDetails: {
              error: "States.Runtime",
              cause:
                "FunctionName required in Parameters for optimistic Lambda integration",
            },
          });
          return {
            status: "FAILED",
            output: "{}",
            error: "States.Runtime",
            cause:
              "FunctionName required in Parameters for optimistic Lambda integration",
            events,
          };
        }
        functionArn = fn;
        lambdaPayload = params.Payload ?? {};
        isOptimistic = true;
      } else if (parsedResource?.service === "lambda") {
        functionArn = resource;
        lambdaPayload = effectiveInput;
        isOptimistic = false;
      } else {
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: {
            error: "States.Runtime",
            cause: `Unsupported Task resource: ${resource}`,
          },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: "States.Runtime",
          cause: `Unsupported Task resource: ${resource}`,
          events,
        };
      }
      const retries = state.Retry ?? [];
      const catches = state.Catch ?? [];
      const retryCount: number[] = retries.map(() => 0);

      addEvent("TaskScheduled", {
        taskScheduledEventDetails: {
          resourceType: "lambda",
          resource: "invoke",
          region: ctx.region,
          parameters: JSON.stringify(lambdaPayload),
        },
      });

      let taskOk = false;
      let taskError: string | undefined;
      let taskCause: string | undefined;
      let taskRawResult: unknown;

      taskRetry: while (true) {
        const result = await invokeTaskResource(
          ctx,
          functionArn,
          lambdaPayload,
        );
        if (result.ok) {
          taskOk = true;
          taskRawResult = isOptimistic
            ? { StatusCode: 200, Payload: result.result }
            : result.result;
          break;
        }
        taskError = result.error;
        taskCause = result.cause;
        let shouldRetry = false;
        for (let ri = 0; ri < retries.length; ri++) {
          if (matchesError(retries[ri].ErrorEquals, result.error)) {
            const max = retries[ri].MaxAttempts ?? 3;
            if (retryCount[ri] < max) {
              retryCount[ri]++;
              shouldRetry = true;
              break;
            }
          }
        }
        if (shouldRetry) continue taskRetry;
        break;
      }

      if (!taskOk) {
        addEvent("TaskFailed", {
          taskFailedEventDetails: {
            resourceType: "lambda",
            resource: "invoke",
            error: taskError,
            cause: taskCause,
          },
        });
        for (const catcher of catches) {
          if (matchesError(catcher.ErrorEquals, taskError)) {
            const errorInfo = { Error: taskError, Cause: taskCause };
            let catchInput: unknown;
            if (catcher.ResultPath === null) {
              catchInput = rawInput;
            } else if (catcher.ResultPath !== undefined) {
              catchInput = jsonPathSet(rawInput, catcher.ResultPath, errorInfo);
            } else {
              catchInput = errorInfo;
            }
            addEvent("TaskStateExited", {
              stateExitedEventDetails: {
                name: stateName,
                output: JSON.stringify(catchInput),
              },
            });
            currentInput = catchInput;
            currentStateName = catcher.Next;
            continue stateLoop;
          }
        }
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: {
            error: taskError,
            cause: taskCause,
          },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: taskError,
          cause: taskCause,
          events,
        };
      }

      const rawResult = taskRawResult;
      addEvent("TaskSucceeded", {
        taskSucceededEventDetails: {
          resourceType: "lambda",
          resource: "invoke",
          output: JSON.stringify(rawResult),
        },
      });
      const selectedResult =
        state.ResultSelector !== undefined
          ? applyParameters(state.ResultSelector, rawResult)
          : rawResult;
      let stateOutput: unknown;
      if (state.ResultPath === null) {
        stateOutput = rawInput;
      } else if (state.ResultPath !== undefined) {
        stateOutput = jsonPathSet(rawInput, state.ResultPath, selectedResult);
      } else {
        stateOutput = selectedResult;
      }
      let output: unknown;
      if (state.OutputPath === null) {
        output = {};
      } else if (state.OutputPath !== undefined) {
        output = jsonPathGet(stateOutput, state.OutputPath);
      } else {
        output = stateOutput;
      }
      addEvent("TaskStateExited", {
        stateExitedEventDetails: {
          name: stateName,
          output: JSON.stringify(output),
        },
      });
      if (state.End === true) {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: { output: JSON.stringify(output) },
        });
        return { status: "SUCCEEDED", output: JSON.stringify(output), events };
      }
      currentInput = output;
      currentStateName = state.Next!;
    } else if (state.Type === "Map") {
      addEvent("MapStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      const rawInput = currentInput;
      const effectiveInput =
        state.Parameters !== undefined
          ? applyParameters(state.Parameters, rawInput)
          : rawInput;
      const itemsPath = state.ItemsPath ?? "$";
      const items = jsonPathGet(effectiveInput, itemsPath);
      if (!Array.isArray(items)) {
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: {
            error: "States.Runtime",
            cause: "ItemsPath does not reference an array",
          },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: "States.Runtime",
          cause: "ItemsPath does not reference an array",
          events,
        };
      }
      const iterDef = state.Iterator ?? state.ItemProcessor;
      if (iterDef === undefined) {
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: {
            error: "States.Runtime",
            cause: "Map state requires Iterator or ItemProcessor",
          },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: "States.Runtime",
          cause: "Map state requires Iterator or ItemProcessor",
          events,
        };
      }
      const mapResults: unknown[] = [];
      let mapError: string | undefined;
      let mapCause: string | undefined;
      for (let i = 0; i < items.length; i++) {
        addEvent("MapIterationStarted", {
          mapIterationStartedEventDetails: { name: stateName, index: i },
        });
        const subIdRef = { n: 1 };
        const iterResult = await runAslStates(
          iterDef,
          items[i],
          iterDef.StartAt,
          [],
          subIdRef,
          ctx,
          executionArn,
        );
        if (iterResult.status !== "SUCCEEDED") {
          mapError = iterResult.error;
          mapCause = iterResult.cause;
          addEvent("MapIterationFailed", {
            mapIterationFailedEventDetails: { name: stateName, index: i },
          });
          break;
        }
        addEvent("MapIterationSucceeded", {
          mapIterationSucceededEventDetails: { name: stateName, index: i },
        });
        mapResults.push(JSON.parse(iterResult.output));
      }
      if (mapError !== undefined) {
        const catches = state.Catch ?? [];
        for (const catcher of catches) {
          if (matchesError(catcher.ErrorEquals, mapError)) {
            const errorInfo = { Error: mapError, Cause: mapCause };
            let catchInput: unknown;
            if (catcher.ResultPath === null) {
              catchInput = rawInput;
            } else if (catcher.ResultPath !== undefined) {
              catchInput = jsonPathSet(rawInput, catcher.ResultPath, errorInfo);
            } else {
              catchInput = errorInfo;
            }
            addEvent("MapStateExited", {
              stateExitedEventDetails: {
                name: stateName,
                output: JSON.stringify(catchInput),
              },
            });
            currentInput = catchInput;
            currentStateName = catcher.Next;
            continue stateLoop;
          }
        }
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: { error: mapError, cause: mapCause },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: mapError,
          cause: mapCause,
          events,
        };
      }
      const mapSelectedResult =
        state.ResultSelector !== undefined
          ? applyParameters(state.ResultSelector, mapResults)
          : mapResults;
      let mapStateOutput: unknown;
      if (state.ResultPath === null) {
        mapStateOutput = rawInput;
      } else if (state.ResultPath !== undefined) {
        mapStateOutput = jsonPathSet(
          rawInput,
          state.ResultPath,
          mapSelectedResult,
        );
      } else {
        mapStateOutput = mapSelectedResult;
      }
      let mapOutput: unknown;
      if (state.OutputPath === null) {
        mapOutput = {};
      } else if (state.OutputPath !== undefined) {
        mapOutput = jsonPathGet(mapStateOutput, state.OutputPath);
      } else {
        mapOutput = mapStateOutput;
      }
      addEvent("MapStateExited", {
        stateExitedEventDetails: {
          name: stateName,
          output: JSON.stringify(mapOutput),
        },
      });
      if (state.End === true) {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: { output: JSON.stringify(mapOutput) },
        });
        return {
          status: "SUCCEEDED",
          output: JSON.stringify(mapOutput),
          events,
        };
      }
      currentInput = mapOutput;
      currentStateName = state.Next!;
    } else if (state.Type === "Parallel") {
      addEvent("ParallelStateEntered", {
        stateEnteredEventDetails: { name: stateName, input: stateInput },
      });
      const rawInput = currentInput;
      const effectiveInput =
        state.Parameters !== undefined
          ? applyParameters(state.Parameters, rawInput)
          : rawInput;
      const branches = state.Branches ?? [];
      const parallelResults: unknown[] = [];
      let parallelError: string | undefined;
      let parallelCause: string | undefined;
      for (const branchDef of branches) {
        const subIdRef = { n: 1 };
        const branchResult = await runAslStates(
          branchDef,
          effectiveInput,
          branchDef.StartAt,
          [],
          subIdRef,
          ctx,
          executionArn,
        );
        if (branchResult.status !== "SUCCEEDED") {
          parallelError = branchResult.error;
          parallelCause = branchResult.cause;
          break;
        }
        parallelResults.push(JSON.parse(branchResult.output));
      }
      if (parallelError !== undefined) {
        const catches = state.Catch ?? [];
        for (const catcher of catches) {
          if (matchesError(catcher.ErrorEquals, parallelError)) {
            const errorInfo = { Error: parallelError, Cause: parallelCause };
            let catchInput: unknown;
            if (catcher.ResultPath === null) {
              catchInput = rawInput;
            } else if (catcher.ResultPath !== undefined) {
              catchInput = jsonPathSet(rawInput, catcher.ResultPath, errorInfo);
            } else {
              catchInput = errorInfo;
            }
            addEvent("ParallelStateExited", {
              stateExitedEventDetails: {
                name: stateName,
                output: JSON.stringify(catchInput),
              },
            });
            currentInput = catchInput;
            currentStateName = catcher.Next;
            continue stateLoop;
          }
        }
        addEvent("ExecutionFailed", {
          executionFailedEventDetails: {
            error: parallelError,
            cause: parallelCause,
          },
        });
        return {
          status: "FAILED",
          output: "{}",
          error: parallelError,
          cause: parallelCause,
          events,
        };
      }
      const parallelSelectedResult =
        state.ResultSelector !== undefined
          ? applyParameters(state.ResultSelector, parallelResults)
          : parallelResults;
      let parallelStateOutput: unknown;
      if (state.ResultPath === null) {
        parallelStateOutput = rawInput;
      } else if (state.ResultPath !== undefined) {
        parallelStateOutput = jsonPathSet(
          rawInput,
          state.ResultPath,
          parallelSelectedResult,
        );
      } else {
        parallelStateOutput = parallelSelectedResult;
      }
      let parallelOutput: unknown;
      if (state.OutputPath === null) {
        parallelOutput = {};
      } else if (state.OutputPath !== undefined) {
        parallelOutput = jsonPathGet(parallelStateOutput, state.OutputPath);
      } else {
        parallelOutput = parallelStateOutput;
      }
      addEvent("ParallelStateExited", {
        stateExitedEventDetails: {
          name: stateName,
          output: JSON.stringify(parallelOutput),
        },
      });
      if (state.End === true) {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: {
            output: JSON.stringify(parallelOutput),
          },
        });
        return {
          status: "SUCCEEDED",
          output: JSON.stringify(parallelOutput),
          events,
        };
      }
      currentInput = parallelOutput;
      currentStateName = state.Next!;
    } else {
      if (state.End === true) {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: {
            output: JSON.stringify(currentInput),
          },
        });
        return {
          status: "SUCCEEDED",
          output: JSON.stringify(currentInput),
          events,
        };
      }
      if (state.Next !== undefined) {
        currentStateName = state.Next;
      } else {
        addEvent("ExecutionSucceeded", {
          executionSucceededEventDetails: {
            output: JSON.stringify(currentInput),
          },
        });
        return {
          status: "SUCCEEDED",
          output: JSON.stringify(currentInput),
          events,
        };
      }
    }
  }

  addEvent("ExecutionFailed", {
    executionFailedEventDetails: {
      error: "States.Runtime",
      cause: "State machine execution exceeded maximum depth",
    },
  });
  return {
    status: "FAILED",
    output: "{}",
    error: "States.Runtime",
    cause: "State machine execution exceeded maximum depth",
    events,
  };
};

const interpretAsl = async (
  definitionStr: string,
  inputStr: string,
  ctx: ServiceContext,
  executionArn: string,
): Promise<AslExecutionResult> => {
  let definition: AslDefinition;
  let currentInput: unknown;
  try {
    definition = JSON.parse(definitionStr) as AslDefinition;
    currentInput = JSON.parse(inputStr);
  } catch {
    return {
      status: "FAILED",
      output: "{}",
      error: "States.Runtime",
      cause: "Invalid definition or input",
      events: [],
    };
  }

  const events: HistoryEvent[] = [];
  const idRef = { n: 1 };
  const addInitEvent = (
    type: string,
    details: Omit<
      HistoryEvent,
      "timestamp" | "type" | "id" | "previousEventId"
    > = {},
  ): void => {
    const id = idRef.n++;
    events.push({
      timestamp: Math.floor(Date.now() / 1000),
      type,
      id,
      previousEventId: id - 1,
      ...details,
    });
  };

  addInitEvent("ExecutionStarted", {
    executionStartedEventDetails: { input: inputStr },
  });

  return runAslStates(
    definition,
    currentInput,
    definition.StartAt,
    events,
    idRef,
    ctx,
    executionArn,
  );
};

const stringOrUndefined = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

const requireString = (
  input: Record<string, unknown>,
  field: string,
): string => {
  const value = input[field];
  if (typeof value === "string" && value !== "") return value;
  throw awsError("ValidationException", `${field} is a required field.`, 400);
};

type StoredActivity = {
  activityArn: string;
  name: string;
  creationDate: number;
};

type StoredTags = {
  resourceArn: string;
  tags: Record<string, string>;
};

type StoredStateMachineVersion = {
  stateMachineVersionArn: string;
  stateMachineArn: string;
  definition: string;
  roleArn: string;
  description: string | undefined;
  creationDate: number;
};

type StoredStateMachineAlias = {
  stateMachineAliasArn: string;
  stateMachineArn: string;
  name: string;
  description: string | undefined;
  routingConfiguration: { stateMachineVersionArn: string; weight: number }[];
  creationDate: number;
  updateDate: number;
};

type StoredMapRun = {
  mapRunArn: string;
  executionArn: string;
  stateMachineArn: string;
  status: string;
  startDate: number;
  stopDate: number | undefined;
  maxConcurrency: number;
  toleratedFailurePercentage: number;
  toleratedFailureCount: number;
};

const stateMachineKey = (arn: string): string => `stateMachine#${arn}`;

const executionKey = (arn: string): string => `execution#${arn}`;

const activityKey = (arn: string): string => `activity#${arn}`;

const tagsKey = (arn: string): string => `tags#${arn}`;

const versionKey = (arn: string): string => `version#${arn}`;

const aliasKey = (arn: string): string => `alias#${arn}`;

const mapRunKey = (arn: string): string => `mapRun#${arn}`;

const versionCounterKey = (machineArn: string): string =>
  `versionCounter#${machineArn}`;

const activityArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:states:${ctx.region}:${ctx.account}:activity:${name}`;

const stateMachineArnOf = (ctx: ServiceContext, name: string): string =>
  `arn:aws:states:${ctx.region}:${ctx.account}:stateMachine:${name}`;

const executionArnOf = (
  ctx: ServiceContext,
  machineName: string,
  executionName: string,
): string =>
  `arn:aws:states:${ctx.region}:${ctx.account}:execution:${machineName}:${executionName}`;

const requireStateMachine = (
  ctx: ServiceContext,
  arn: string,
): StoredStateMachine => {
  const machine = ctx.store.get<StoredStateMachine>(stateMachineKey(arn));
  if (machine === undefined) {
    throw awsError(
      "StateMachineDoesNotExist",
      `State Machine Does Not Exist: '${arn}'`,
      400,
    );
  }
  return machine;
};

const requireExecution = (
  ctx: ServiceContext,
  arn: string,
): StoredExecution => {
  const execution = ctx.store.get<StoredExecution>(executionKey(arn));
  if (execution === undefined) {
    throw awsError(
      "ExecutionDoesNotExist",
      `Execution Does Not Exist: '${arn}'`,
      400,
    );
  }
  return execution;
};

const machineNameFromArn = (arn: string): string => {
  const parts = arn.split(":");
  return parts[parts.length - 1] ?? arn;
};

const normalizeMachineArn = (arn: string): string => {
  const idx = arn.lastIndexOf(":");
  if (idx < 0) return arn;
  const suffix = arn.slice(idx + 1);
  return /^\d+$/.test(suffix) ? arn.slice(0, idx) : arn;
};

const requireStateMachineAlias = (
  ctx: ServiceContext,
  arn: string,
): StoredStateMachineAlias => {
  const alias = ctx.store.get<StoredStateMachineAlias>(aliasKey(arn));
  if (alias === undefined) {
    throw awsError(
      "ResourceNotFound",
      `State Machine Alias Does Not Exist: '${arn}'`,
      400,
    );
  }
  return alias;
};

const requireMapRun = (ctx: ServiceContext, arn: string): StoredMapRun => {
  const mr = ctx.store.get<StoredMapRun>(mapRunKey(arn));
  if (mr === undefined) {
    throw awsError("ResourceNotFound", `Map Run Does Not Exist: '${arn}'`, 400);
  }
  return mr;
};

const CreateStateMachine: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const definition = requireString(input, "definition");
  const roleArn = requireString(input, "roleArn");
  const type = stringOrUndefined(input["type"]) ?? "STANDARD";
  const arn = stateMachineArnOf(ctx, name);
  const existing = ctx.store.get<StoredStateMachine>(stateMachineKey(arn));
  if (existing !== undefined) {
    if (
      existing.definition === definition &&
      existing.roleArn === roleArn &&
      existing.type === type
    ) {
      return { stateMachineArn: arn, creationDate: existing.creationDate };
    }
    throw awsError(
      "StateMachineAlreadyExists",
      `State Machine Already Exists: '${arn}'`,
      400,
    );
  }
  const creationDate = nowSeconds();
  const machine: StoredStateMachine = {
    stateMachineArn: arn,
    name,
    definition,
    roleArn,
    type,
    status: "ACTIVE",
    creationDate,
  };
  ctx.store.set(stateMachineKey(arn), machine);
  const tags = tagListToRecord(input["tags"]);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(arn), { resourceArn: arn, tags });
  }
  return { stateMachineArn: arn, creationDate };
};

const DeleteStateMachine: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineArn");
  ctx.store.delete(stateMachineKey(arn));
  return {};
};

const ListStateMachines: OperationHandler = (_input, ctx) => {
  const stateMachines = ctx.store
    .list<StoredStateMachine | StoredExecution>()
    .map((entry) => entry.value)
    .filter(
      (value): value is StoredStateMachine =>
        (value as StoredStateMachine).definition !== undefined,
    )
    .map((machine) => ({
      stateMachineArn: machine.stateMachineArn,
      name: machine.name,
      type: machine.type,
      creationDate: machine.creationDate,
    }));
  return { stateMachines };
};

const DescribeStateMachine: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, arn);
  return {
    stateMachineArn: machine.stateMachineArn,
    name: machine.name,
    status: machine.status,
    definition: machine.definition,
    roleArn: machine.roleArn,
    type: machine.type,
    creationDate: machine.creationDate,
  };
};

const StartExecution: OperationHandler = async (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, machineArn);
  const executionName = stringOrUndefined(input["name"]) ?? crypto.randomUUID();
  const machineName = machineNameFromArn(machine.stateMachineArn);
  const arn = executionArnOf(ctx, machineName, executionName);
  const inputData = stringOrUndefined(input["input"]) ?? "{}";
  const existing = ctx.store.get<StoredExecution>(executionKey(arn));
  if (existing !== undefined) {
    if (existing.input === inputData) {
      return { executionArn: arn, startDate: existing.startDate };
    }
    throw awsError(
      "ExecutionAlreadyExists",
      `Execution Already Exists: '${arn}'`,
      400,
    );
  }
  const startDate = nowSeconds();
  const result = await interpretAsl(machine.definition, inputData, ctx, arn);
  const execution: StoredExecution = {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    status: result.status,
    startDate,
    stopDate: result.status !== "RUNNING" ? startDate : undefined,
    input: inputData,
    output: result.status === "SUCCEEDED" ? result.output : undefined,
    error: result.status === "FAILED" ? result.error : undefined,
    cause: result.status === "FAILED" ? result.cause : undefined,
    events: result.events,
  };
  ctx.store.set(executionKey(arn), execution);
  return { executionArn: arn, startDate };
};

const DescribeExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  return {
    executionArn: execution.executionArn,
    stateMachineArn: execution.stateMachineArn,
    name: execution.name,
    status: execution.status,
    startDate: execution.startDate,
    stopDate: execution.stopDate,
    input: execution.input,
    output: execution.output,
    error: execution.error,
    cause: execution.cause,
  };
};

const ListExecutions: OperationHandler = (input, ctx) => {
  const machineArn = stringOrUndefined(input["stateMachineArn"]);
  const statusFilter = stringOrUndefined(input["statusFilter"]);
  const executions = ctx.store
    .list<StoredStateMachine | StoredExecution>()
    .map((entry) => entry.value)
    .filter(
      (value): value is StoredExecution =>
        (value as StoredExecution).executionArn !== undefined,
    )
    .filter(
      (execution) =>
        machineArn === undefined || execution.stateMachineArn === machineArn,
    )
    .filter(
      (execution) =>
        statusFilter === undefined || execution.status === statusFilter,
    )
    .map((execution) => ({
      executionArn: execution.executionArn,
      stateMachineArn: execution.stateMachineArn,
      name: execution.name,
      status: execution.status,
      startDate: execution.startDate,
      stopDate: execution.stopDate,
    }));
  return { executions };
};

const TERMINAL_STATUSES = new Set([
  "SUCCEEDED",
  "FAILED",
  "ABORTED",
  "TIMED_OUT",
]);

const StopExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  if (TERMINAL_STATUSES.has(execution.status)) {
    throw awsError(
      "InvalidParameter",
      `Execution '${arn}' is already in a terminal state.`,
      400,
    );
  }
  const stopDate = nowSeconds();
  const error = stringOrUndefined(input["error"]);
  const cause = stringOrUndefined(input["cause"]);
  const prevId = (execution.events ?? []).length;
  execution.status = "ABORTED";
  execution.stopDate = stopDate;
  execution.error = error;
  execution.cause = cause;
  execution.events = [
    ...(execution.events ?? []),
    {
      timestamp: stopDate,
      type: "ExecutionAborted",
      id: prevId + 1,
      previousEventId: prevId,
      executionAbortedEventDetails: { error, cause },
    },
  ];
  ctx.store.set(executionKey(arn), execution);
  return { stopDate };
};

const requireActivity = (ctx: ServiceContext, arn: string): StoredActivity => {
  const activity = ctx.store.get<StoredActivity>(activityKey(arn));
  if (activity === undefined) {
    throw awsError(
      "ActivityDoesNotExist",
      `Activity Does Not Exist: '${arn}'`,
      400,
    );
  }
  return activity;
};

const tagListToRecord = (value: unknown): Record<string, string> => {
  const record: Record<string, string> = {};
  if (!Array.isArray(value)) return record;
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const key = (entry as Record<string, unknown>)["key"];
    const tagValue = (entry as Record<string, unknown>)["value"];
    if (typeof key === "string" && key !== "") {
      record[key] = typeof tagValue === "string" ? tagValue : "";
    }
  }
  return record;
};

const recordToTagList = (
  record: Record<string, string>,
): { key: string; value: string }[] =>
  Object.entries(record).map(([key, value]) => ({ key, value }));

const CreateActivity: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const arn = activityArnOf(ctx, name);
  const existing = ctx.store.get<StoredActivity>(activityKey(arn));
  if (existing !== undefined) {
    return { activityArn: arn, creationDate: existing.creationDate };
  }
  const creationDate = nowSeconds();
  const activity: StoredActivity = { activityArn: arn, name, creationDate };
  ctx.store.set(activityKey(arn), activity);
  const tags = tagListToRecord(input["tags"]);
  if (Object.keys(tags).length > 0) {
    ctx.store.set(tagsKey(arn), { resourceArn: arn, tags });
  }
  return { activityArn: arn, creationDate };
};

const DescribeActivity: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "activityArn");
  const activity = requireActivity(ctx, arn);
  return {
    activityArn: activity.activityArn,
    name: activity.name,
    creationDate: activity.creationDate,
  };
};

const ListActivities: OperationHandler = (_input, ctx) => {
  const activities = ctx.store
    .list<StoredActivity>()
    .filter((entry) => entry.key.startsWith("activity#"))
    .map((entry) => entry.value)
    .map((activity) => ({
      activityArn: activity.activityArn,
      name: activity.name,
      creationDate: activity.creationDate,
    }));
  return { activities };
};

const DeleteActivity: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "activityArn");
  ctx.store.delete(activityKey(arn));
  ctx.store.delete(tagsKey(arn));
  return {};
};

const TagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const incoming = tagListToRecord(input["tags"]);
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  const tags = { ...(existing?.tags ?? {}), ...incoming };
  ctx.store.set(tagsKey(resourceArn), { resourceArn, tags });
  return {};
};

const UntagResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  if (existing === undefined) return {};
  const keys = input["tagKeys"];
  const tags = { ...existing.tags };
  if (Array.isArray(keys)) {
    for (const key of keys) {
      if (typeof key === "string") delete tags[key];
    }
  }
  ctx.store.set(tagsKey(resourceArn), { resourceArn, tags });
  return {};
};

const ListTagsForResource: OperationHandler = (input, ctx) => {
  const resourceArn = requireString(input, "resourceArn");
  const existing = ctx.store.get<StoredTags>(tagsKey(resourceArn));
  return { tags: recordToTagList(existing?.tags ?? {}) };
};

const UpdateStateMachine: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, arn);
  if (typeof input["definition"] === "string" && input["definition"] !== "") {
    machine.definition = input["definition"] as string;
  }
  if (typeof input["roleArn"] === "string" && input["roleArn"] !== "") {
    machine.roleArn = input["roleArn"] as string;
  }
  const updateDate = nowSeconds();
  ctx.store.set(stateMachineKey(arn), machine);
  let stateMachineVersionArn: string | undefined;
  if (input["publish"] === true) {
    const counter = (ctx.store.get<number>(versionCounterKey(arn)) ?? 0) + 1;
    ctx.store.set(versionCounterKey(arn), counter);
    stateMachineVersionArn = `${arn}:${counter}`;
    const version: StoredStateMachineVersion = {
      stateMachineVersionArn,
      stateMachineArn: arn,
      definition: machine.definition,
      roleArn: machine.roleArn,
      description: stringOrUndefined(input["versionDescription"]),
      creationDate: updateDate,
    };
    ctx.store.set(versionKey(stateMachineVersionArn), version);
  }
  return { updateDate, stateMachineVersionArn };
};

const DescribeStateMachineForExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  const machine = requireStateMachine(ctx, execution.stateMachineArn);
  return {
    stateMachineArn: machine.stateMachineArn,
    name: machine.name,
    definition: machine.definition,
    roleArn: machine.roleArn,
    updateDate: machine.creationDate,
  };
};

const ValidateStateMachineDefinition: OperationHandler = (input, _ctx) => {
  requireString(input, "definition");
  return { result: "OK", diagnostics: [] };
};

const TestState: OperationHandler = (_input, _ctx) => {
  return { status: "SUCCEEDED" };
};

const PublishStateMachineVersion: OperationHandler = (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, machineArn);
  const counter =
    (ctx.store.get<number>(versionCounterKey(machineArn)) ?? 0) + 1;
  ctx.store.set(versionCounterKey(machineArn), counter);
  const stateMachineVersionArn = `${machineArn}:${counter}`;
  const creationDate = nowSeconds();
  const version: StoredStateMachineVersion = {
    stateMachineVersionArn,
    stateMachineArn: machineArn,
    definition: machine.definition,
    roleArn: machine.roleArn,
    description: stringOrUndefined(input["description"]),
    creationDate,
  };
  ctx.store.set(versionKey(stateMachineVersionArn), version);
  return { creationDate, stateMachineVersionArn };
};

const ListStateMachineVersions: OperationHandler = (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  requireStateMachine(ctx, machineArn);
  const stateMachineVersions = ctx.store
    .list<StoredStateMachineVersion>()
    .filter((entry) => entry.key.startsWith("version#"))
    .map((entry) => entry.value)
    .filter((v) => v.stateMachineArn === machineArn)
    .map((v) => ({
      stateMachineVersionArn: v.stateMachineVersionArn,
      creationDate: v.creationDate,
    }));
  return { stateMachineVersions };
};

const DeleteStateMachineVersion: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineVersionArn");
  ctx.store.delete(versionKey(arn));
  return {};
};

const CreateStateMachineAlias: OperationHandler = (input, ctx) => {
  const name = requireString(input, "name");
  const routingConfiguration = input["routingConfiguration"];
  if (
    !Array.isArray(routingConfiguration) ||
    routingConfiguration.length === 0
  ) {
    throw awsError(
      "ValidationException",
      "routingConfiguration is a required field.",
      400,
    );
  }
  const firstItem = routingConfiguration[0] as Record<string, unknown>;
  const firstVersionArn = firstItem["stateMachineVersionArn"];
  if (typeof firstVersionArn !== "string" || firstVersionArn === "") {
    throw awsError(
      "ValidationException",
      "stateMachineVersionArn is a required field.",
      400,
    );
  }
  const machineArn = normalizeMachineArn(firstVersionArn);
  const aliasArn = `${machineArn}:${name}`;
  const description = stringOrUndefined(input["description"]);
  const routingConf = (routingConfiguration as Record<string, unknown>[]).map(
    (item) => ({
      stateMachineVersionArn: String(item["stateMachineVersionArn"] ?? ""),
      weight:
        typeof item["weight"] === "number" ? (item["weight"] as number) : 100,
    }),
  );
  const existing = ctx.store.get<StoredStateMachineAlias>(aliasKey(aliasArn));
  if (existing !== undefined) {
    if (
      existing.description === description &&
      JSON.stringify(existing.routingConfiguration) ===
        JSON.stringify(routingConf)
    ) {
      return {
        stateMachineAliasArn: aliasArn,
        creationDate: existing.creationDate,
      };
    }
    throw awsError(
      "StateMachineAlreadyExists",
      `Alias Already Exists: '${aliasArn}'`,
      400,
    );
  }
  const creationDate = nowSeconds();
  const alias: StoredStateMachineAlias = {
    stateMachineAliasArn: aliasArn,
    stateMachineArn: machineArn,
    name,
    description,
    routingConfiguration: routingConf,
    creationDate,
    updateDate: creationDate,
  };
  ctx.store.set(aliasKey(aliasArn), alias);
  return { stateMachineAliasArn: aliasArn, creationDate };
};

const DescribeStateMachineAlias: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineAliasArn");
  const alias = requireStateMachineAlias(ctx, arn);
  return {
    stateMachineAliasArn: alias.stateMachineAliasArn,
    name: alias.name,
    description: alias.description,
    routingConfiguration: alias.routingConfiguration,
    creationDate: alias.creationDate,
    updateDate: alias.updateDate,
  };
};

const UpdateStateMachineAlias: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineAliasArn");
  const alias = requireStateMachineAlias(ctx, arn);
  if (typeof input["description"] === "string") {
    alias.description = input["description"] as string;
  }
  if (Array.isArray(input["routingConfiguration"])) {
    alias.routingConfiguration = (
      input["routingConfiguration"] as Record<string, unknown>[]
    ).map((item) => ({
      stateMachineVersionArn: String(item["stateMachineVersionArn"] ?? ""),
      weight:
        typeof item["weight"] === "number" ? (item["weight"] as number) : 100,
    }));
  }
  const updateDate = nowSeconds();
  alias.updateDate = updateDate;
  ctx.store.set(aliasKey(arn), alias);
  return { updateDate };
};

const DeleteStateMachineAlias: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "stateMachineAliasArn");
  ctx.store.delete(aliasKey(arn));
  return {};
};

const ListStateMachineAliases: OperationHandler = (input, ctx) => {
  const inputArn = requireString(input, "stateMachineArn");
  const normalizedArn = normalizeMachineArn(inputArn);
  requireStateMachine(ctx, normalizedArn);
  const stateMachineAliases = ctx.store
    .list<StoredStateMachineAlias>()
    .filter((entry) => entry.key.startsWith("alias#"))
    .map((entry) => entry.value)
    .filter((a) => a.stateMachineArn === normalizedArn)
    .map((a) => ({
      stateMachineAliasArn: a.stateMachineAliasArn,
      creationDate: a.creationDate,
    }));
  return { stateMachineAliases };
};

const StartSyncExecution: OperationHandler = async (input, ctx) => {
  const machineArn = requireString(input, "stateMachineArn");
  const machine = requireStateMachine(ctx, machineArn);
  if (machine.type !== "EXPRESS") {
    throw awsError(
      "StateMachineTypeNotSupported",
      `This operation is not supported for ${machine.type} state machines.`,
      400,
    );
  }
  const executionName = stringOrUndefined(input["name"]) ?? crypto.randomUUID();
  const machineName = machineNameFromArn(machine.stateMachineArn);
  const arn = executionArnOf(ctx, machineName, executionName);
  const startDate = nowSeconds();
  const stopDate = startDate;
  const inputData = stringOrUndefined(input["input"]) ?? "{}";
  const result = await interpretAsl(machine.definition, inputData, ctx, arn);
  const execution: StoredExecution = {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    status: result.status,
    startDate,
    stopDate,
    input: inputData,
    output: result.status === "SUCCEEDED" ? result.output : undefined,
    error: result.status === "FAILED" ? result.error : undefined,
    cause: result.status === "FAILED" ? result.cause : undefined,
    events: result.events,
  };
  ctx.store.set(executionKey(arn), execution);
  return {
    executionArn: arn,
    stateMachineArn: machine.stateMachineArn,
    name: executionName,
    startDate,
    stopDate,
    status: result.status,
    input: inputData,
    output: result.status === "SUCCEEDED" ? result.output : undefined,
    error: result.status === "FAILED" ? result.error : undefined,
    cause: result.status === "FAILED" ? result.cause : undefined,
  };
};

const RedriveExecution: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  requireExecution(ctx, arn);
  return { redriveDate: nowSeconds() };
};

const GetExecutionHistory: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "executionArn");
  const execution = requireExecution(ctx, arn);
  const reverseOrder = input["reverseOrder"] === true;
  const events = reverseOrder
    ? [...(execution.events ?? [])].reverse()
    : (execution.events ?? []);
  return { events };
};

const GetActivityTask: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "activityArn");
  requireActivity(ctx, arn);
  const queue = activityQueues.get(arn);
  const token = queue?.shift();
  if (token === undefined) return {};
  const task = pendingTasks.get(token);
  if (task === undefined) return {};
  return { taskToken: token, input: task.input };
};

const SendTaskSuccess: OperationHandler = async (input, ctx) => {
  const token = requireString(input, "taskToken");
  const output = requireString(input, "output");
  const task = pendingTasks.get(token);
  if (task === undefined) {
    throw awsError("TaskDoesNotExist", `Task does not exist: '${token}'`, 400);
  }
  pendingTasks.delete(token);
  const result = await task.resume(output);
  const execution = ctx.store.get<StoredExecution>(
    executionKey(task.executionArn),
  );
  if (execution !== undefined) {
    execution.status = result.status;
    if (result.status !== "RUNNING") {
      execution.stopDate = nowSeconds();
      execution.output =
        result.status === "SUCCEEDED" ? result.output : undefined;
      execution.error = result.status === "FAILED" ? result.error : undefined;
      execution.cause = result.status === "FAILED" ? result.cause : undefined;
    }
    execution.events = result.events;
    ctx.store.set(executionKey(task.executionArn), execution);
  }
  return {};
};

const SendTaskFailure: OperationHandler = (input, ctx) => {
  const token = requireString(input, "taskToken");
  const task = pendingTasks.get(token);
  if (task === undefined) {
    throw awsError("TaskDoesNotExist", `Task does not exist: '${token}'`, 400);
  }
  pendingTasks.delete(token);
  const error = stringOrUndefined(input["error"]);
  const cause = stringOrUndefined(input["cause"]);
  const result = task.fail(error, cause);
  const execution = ctx.store.get<StoredExecution>(
    executionKey(task.executionArn),
  );
  if (execution !== undefined) {
    execution.status = "FAILED";
    execution.stopDate = nowSeconds();
    execution.error = error;
    execution.cause = cause;
    execution.events = result.events;
    ctx.store.set(executionKey(task.executionArn), execution);
  }
  return {};
};

const SendTaskHeartbeat: OperationHandler = (input, _ctx) => {
  const token = requireString(input, "taskToken");
  if (!pendingTasks.has(token)) {
    throw awsError("TaskDoesNotExist", `Task does not exist: '${token}'`, 400);
  }
  return {};
};

const emptyCounters = () => ({
  pending: 0,
  running: 0,
  succeeded: 0,
  failed: 0,
  timedOut: 0,
  aborted: 0,
  total: 0,
  resultsWritten: 0,
});

const DescribeMapRun: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "mapRunArn");
  const mr = requireMapRun(ctx, arn);
  return {
    mapRunArn: mr.mapRunArn,
    executionArn: mr.executionArn,
    status: mr.status,
    startDate: mr.startDate,
    stopDate: mr.stopDate,
    maxConcurrency: mr.maxConcurrency,
    toleratedFailurePercentage: mr.toleratedFailurePercentage,
    toleratedFailureCount: mr.toleratedFailureCount,
    itemCounts: emptyCounters(),
    executionCounts: emptyCounters(),
  };
};

const ListMapRuns: OperationHandler = (input, ctx) => {
  const executionArn = requireString(input, "executionArn");
  requireExecution(ctx, executionArn);
  const mapRuns = ctx.store
    .list<StoredMapRun>()
    .filter((entry) => entry.key.startsWith("mapRun#"))
    .map((entry) => entry.value)
    .filter((mr) => mr.executionArn === executionArn)
    .map((mr) => ({
      executionArn: mr.executionArn,
      mapRunArn: mr.mapRunArn,
      stateMachineArn: mr.stateMachineArn,
      startDate: mr.startDate,
      stopDate: mr.stopDate,
    }));
  return { mapRuns };
};

const UpdateMapRun: OperationHandler = (input, ctx) => {
  const arn = requireString(input, "mapRunArn");
  const mr = requireMapRun(ctx, arn);
  if (typeof input["maxConcurrency"] === "number") {
    mr.maxConcurrency = input["maxConcurrency"] as number;
  }
  if (typeof input["toleratedFailurePercentage"] === "number") {
    mr.toleratedFailurePercentage = input[
      "toleratedFailurePercentage"
    ] as number;
  }
  if (typeof input["toleratedFailureCount"] === "number") {
    mr.toleratedFailureCount = input["toleratedFailureCount"] as number;
  }
  ctx.store.set(mapRunKey(arn), mr);
  return {};
};

const stepFunctions: ServiceDefinition = {
  name: "states",
  protocol: "json",
  operations: {
    CreateStateMachine,
    DeleteStateMachine,
    ListStateMachines,
    DescribeStateMachine,
    UpdateStateMachine,
    DescribeStateMachineForExecution,
    ValidateStateMachineDefinition,
    TestState,
    StartExecution,
    StartSyncExecution,
    DescribeExecution,
    ListExecutions,
    StopExecution,
    RedriveExecution,
    GetExecutionHistory,
    PublishStateMachineVersion,
    ListStateMachineVersions,
    DeleteStateMachineVersion,
    CreateStateMachineAlias,
    DescribeStateMachineAlias,
    UpdateStateMachineAlias,
    DeleteStateMachineAlias,
    ListStateMachineAliases,
    CreateActivity,
    DescribeActivity,
    ListActivities,
    DeleteActivity,
    GetActivityTask,
    SendTaskSuccess,
    SendTaskFailure,
    SendTaskHeartbeat,
    DescribeMapRun,
    ListMapRuns,
    UpdateMapRun,
    TagResource,
    UntagResource,
    ListTagsForResource,
  },
  model,
} as const;

export default stepFunctions;
