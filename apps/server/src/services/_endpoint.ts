export const serviceBaseUrl = (): string =>
  `http://localhost:${Bun.env.BUNSAI_PORT ?? "4566"}`;
