import http from "node:http";

const PORT = Number(process.env.BFF_PORT || 3001);
const BACKEND_URL = process.env.AURA_BACKEND_URL || "http://127.0.0.1:8000";

function sendJson(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  response.end(body);
}

async function proxyJson(path, options = {}) {
  const target = new URL(path, BACKEND_URL);
  const response = await fetch(target, options);
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = payload.error || "Backend Aura indisponivel.";
    throw new Error(message);
  }

  return payload;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  try {
    if (request.method === "GET" && request.url === "/api/health") {
      const detector = await proxyJson("/health");
      sendJson(response, 200, { ok: true, bff: "aura-bff", detector });
      return;
    }

    if (request.method === "GET" && request.url === "/api/count") {
      const count = await proxyJson("/count");
      sendJson(response, 200, {
        ...count,
        source: "camera-local",
        privacy: "camera-hidden",
      });
      return;
    }

    if (request.method === "POST" && request.url === "/api/config") {
      const body = await readBody(request);
      const count = await proxyJson("/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body || "{}",
      });
      sendJson(response, 200, count);
      return;
    }

    sendJson(response, 404, { error: "Rota nao encontrada." });
  } catch (error) {
    sendJson(response, 503, {
      error: error.message,
      peopleCount: 0,
      status: "SEM SINAL",
      cameraOnline: false,
    });
  }
});

server.listen(PORT, () => {
  console.log(`Aura BFF rodando em http://127.0.0.1:${PORT}`);
});
