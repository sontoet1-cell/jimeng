const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function isTikTokUrl(value) {
  try {
    const parsed = new URL(value);
    return /(^|\.)tiktok\.com$/.test(parsed.hostname) || /(^|\.)vt\.tiktok\.com$/.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function resolveTikTokVideo(url) {
  const body = new URLSearchParams({
    url,
    hd: "1"
  });

  const response = await fetch("https://www.tikwm.com/api/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0"
    },
    body: body.toString()
  });

  if (!response.ok) {
    throw new Error(`TikWM responded with ${response.status}`);
  }

  const payload = await response.json();
  const data = payload && payload.data ? payload.data : null;

  if (!data || (!data.play && !data.hdplay)) {
    throw new Error(payload && payload.msg ? payload.msg : "Could not resolve the video");
  }

  return {
    author: data.author?.nickname || data.author?.unique_id || "TikTok",
    title: data.title || "TikTok video",
    cover: data.cover || data.origin_cover || "",
    music: data.music || "",
    play: data.play || "",
    hdplay: data.hdplay || "",
    size: data.size || null
  };
}

function serveStaticFile(req, res) {
  const requestedPath = req.url === "/" ? "/index.html" : req.url;
  const safePath = path.normalize(requestedPath).replace(/^(\.\.[\\/])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(500);
      res.end("Internal server error");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;

      if (raw.length > 1024 * 1024) {
        reject(new Error("Payload too large"));
        req.destroy();
      }
    });

    req.on("end", () => {
      resolve(raw);
    });

    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/resolve") {
    try {
      const rawBody = await readRequestBody(req);
      const body = rawBody ? JSON.parse(rawBody) : {};
      const url = typeof body.url === "string" ? body.url.trim() : "";

      if (!url) {
        sendJson(res, 400, { error: "Vui long nhap link TikTok." });
        return;
      }

      if (!isTikTokUrl(url)) {
        sendJson(res, 400, { error: "Link khong phai TikTok hop le." });
        return;
      }

      const result = await resolveTikTokVideo(url);
      sendJson(res, 200, result);
    } catch (error) {
      const message = error instanceof SyntaxError
        ? "Request JSON khong hop le."
        : error.message || "Khong the lay video luc nay.";

      sendJson(res, 500, { error: message });
    }
    return;
  }

  if (req.method === "GET") {
    serveStaticFile(req, res);
    return;
  }

  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
