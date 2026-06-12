import { createBunsaiApp } from "../../apps/server/src/server.ts";

type SerializedHttpRequest = {
  method: string;
  protocol: string;
  hostname: string;
  port?: number;
  path: string;
  query?: Record<string, string | string[] | null>;
  headers: Record<string, string>;
  body?: RequestInit["body"];
};

export type TestApp = {
  endpoint: string;
  requestHandler: {
    handle(request: SerializedHttpRequest): Promise<{
      response: {
        statusCode: number;
        headers: Record<string, string>;
        body: ReadableStream;
      };
    }>;
    updateHttpClientConfig(): void;
    httpHandlerConfigs(): Record<string, never>;
  };
  uiFetch(path: string, init?: RequestInit): Promise<Response>;
  gwFetch(url: string, init?: RequestInit): Promise<Response>;
};

export function startApp(options?: { gatewayPort?: number }): TestApp {
  const app = createBunsaiApp({ gatewayPort: options?.gatewayPort });
  const origin = "http://bunsai.test";

  return {
    endpoint: origin,
    requestHandler: {
      async handle(request) {
        const search = new URLSearchParams();
        for (const [key, value] of Object.entries(request.query ?? {})) {
          if (Array.isArray(value)) {
            for (const v of value) search.append(key, v);
          } else if (value !== null) {
            search.append(key, value);
          }
        }
        const qs = search.size ? `?${search}` : "";
        const headers = { ...request.headers, host: request.hostname };
        const res = await app.gatewayFetch(
          new Request(`${origin}${request.path}${qs}`, {
            method: request.method,
            headers,
            body: request.body,
          }),
        );
        return {
          response: {
            statusCode: res.status,
            headers: Object.fromEntries(res.headers),
            body:
              res.body ??
              new ReadableStream({
                start(controller) {
                  controller.close();
                },
              }),
          },
        };
      },
      updateHttpClientConfig() {},
      httpHandlerConfigs() {
        return {};
      },
    },
    uiFetch(path, init) {
      return Promise.resolve(
        app.managementFetch(new Request(`${origin}${path}`, init)),
      );
    },
    gwFetch(url, init) {
      return app.gatewayFetch(new Request(url, init));
    },
  };
}
