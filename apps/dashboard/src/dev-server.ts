import index from "../index.html";

const server = Bun.serve({
  port: Number(Bun.env.BUNSAI_PORT ?? 4566),
  development: { hmr: true },
  routes: {
    "/*": index,
  },
});

console.log(`bunsai dashboard listening on ${server.url}`);
