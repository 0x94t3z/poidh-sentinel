import { createServer } from "node:http";
import { handleDecision, handleExplain, handleFollowUp, handleNeynarWebhook } from "./relayHandlers.js";
import { relayPort } from "./relayState.js";

export function startRelay() {
  const port = relayPort();
  const server = createServer((request, response) => {
    if (!request.url) {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(`${JSON.stringify({ ok: false, error: "Missing URL." }, null, 2)}\n`);
      return;
    }

    if (request.method === "POST" && request.url === "/decision") {
      void handleDecision(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/follow-up") {
      void handleFollowUp(request, response);
      return;
    }

    if (request.method === "POST" && request.url === "/webhooks/neynar") {
      void handleNeynarWebhook(request, response);
      return;
    }

    if (request.method === "GET" && request.url === "/explain") {
      void handleExplain(response);
      return;
    }

    if (request.method === "GET" && request.url === "/health") {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(`${JSON.stringify({ ok: true }, null, 2)}\n`);
      return;
    }

    response.writeHead(404, { "content-type": "application/json" });
    response.end(`${JSON.stringify({ ok: false, error: "Not found." }, null, 2)}\n`);
  });

  server.listen(port, () => {
    console.log(`poidh relay listening on http://127.0.0.1:${port}`);
    console.log(`POST decisions to http://127.0.0.1:${port}/decision`);
  });
}
