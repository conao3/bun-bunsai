import index from "../index.html";

const server = Bun.serve({
  port: Number(Bun.env.BUNSAI_UI_PORT ?? 5666),
  development: { hmr: true },
  routes: {
    "/*": index,
  },
});

console.log(`bunsai dashboard listening on ${server.url}`);
