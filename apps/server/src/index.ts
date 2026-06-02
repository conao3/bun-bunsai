const awsServer = Bun.serve({
  port: Number(Bun.env.BUNSAI_PORT ?? 4566),
  fetch() {
    return new Response("bunsai: aws gateway not yet implemented\n", {
      status: 501,
    });
  },
});

console.log(`bunsai aws gateway listening on ${awsServer.url}`);
