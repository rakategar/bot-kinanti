// src/services/whatsappService.js
const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

let ready = false;
let initPromise = null;
let pageDebugAttached = false;

const envHeadless = String(process.env.WA_HEADLESS || "").toLowerCase();
const headless =
  envHeadless === "false" ? false : envHeadless === "true" ? "new" : "new";
const webVersion = process.env.WA_WEB_VERSION || "";
const webRemotePath =
  process.env.WA_REMOTE_PATH ||
  "https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/{version}.html";
const useRemoteVersion =
  String(process.env.WA_USE_REMOTE_VERSION || "").toLowerCase() === "true" ||
  String(process.env.WA_USE_REMOTE_VERSION || "") === "1";

function attachPageDebug() {
  if (pageDebugAttached) return;
  const page = client.pupPage;
  if (!page) {
    console.log("[wa] pupPage belum tersedia untuk debug");
    return;
  }

  pageDebugAttached = true;
  console.log("[wa] pupPage debug attached");

  page.on("console", (msg) => {
    try {
      console.log("[wa][page][console]", msg.type(), msg.text());
    } catch (e) {
      console.log("[wa][page][console] (failed to read msg)", e?.message);
    }
  });

  page.on("pageerror", (err) => {
    console.error("[wa][page][pageerror]", err);
  });

  page.on("error", (err) => {
    console.error("[wa][page][error]", err);
  });

  page.on("requestfailed", (req) => {
    try {
      console.warn(
        "[wa][page][requestfailed]",
        req.url(),
        req.failure()?.errorText,
      );
    } catch (_e) {
      console.warn("[wa][page][requestfailed] (failed to read request)");
    }
  });

  page.on("response", (res) => {
    try {
      if (res.status() >= 400) {
        console.warn("[wa][page][response]", res.status(), res.url());
      }
    } catch (_e) {
      console.warn("[wa][page][response] (failed to read response)");
    }
  });
}

// Client dibuat SEKALI saja
const clientConfig = {
  authStrategy: new LocalAuth({
    dataPath: "./.wwebjs_auth",
  }),

  puppeteer: {
    headless,

    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  },

  restartOnAuthFail: true,
};

if (useRemoteVersion) {
  clientConfig.webVersionCache = { type: "remote", remotePath: webRemotePath };
}
if (webVersion) {
  clientConfig.webVersion = webVersion;
}

const client = new Client(clientConfig);

// Pasang event listener SEKALI
client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
  console.log("Scan QR di WhatsApp!");
});

client.on("authenticated", () => {
  console.log("Authenticated! Menunggu WhatsApp ready...");
  attachPageDebug();
});

client.on("ready", () => {
  ready = true;
  console.log("WhatsApp client is ready!");
});

client.on("change_state", (state) => {
  console.log("[wa] change_state:", state);
});

client.on("loading_screen", (percent, message) => {
  console.log("[wa] loading_screen:", percent, message);
});

client.on("auth_failure", (m) => {
  ready = false;
  console.error("Auth failure:", m);
});

client.on("disconnected", (r) => {
  ready = false;
  console.error("Disconnected:", r);
});

function initialize() {
  // Biar initialize() idempotent (dipanggil berkali-kali aman)
  if (initPromise) return initPromise;

  initPromise = new Promise((resolve, reject) => {
    console.log("[wa] initialize() start");
    console.log("[wa] headless:", headless);
    console.log("[wa] webVersion:", webVersion || "(default)");
    console.log(
      "[wa] webVersionCache:",
      useRemoteVersion ? `remote (${webRemotePath})` : "(none)",
    );
    let settled = false;

    let cleanup = () => {
      client.removeListener("ready", onReady);
      client.removeListener("auth_failure", onFail);
      client.removeListener("disconnected", onDisc);
    };

    const onReady = () => {
      if (settled) return;
      settled = true;
      ready = true;
      cleanup();
      resolve(client);
    };

    const onFail = (m) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error(`Auth failure: ${m}`));
    };

    const onDisc = (r) => {
      if (settled) return;
      // jangan langsung reject, tapi log dulu
      console.error("Disconnected before ready:", r);
    };

    client.on("ready", onReady);
    client.on("auth_failure", onFail);
    client.on("disconnected", onDisc);

    // Fallback: kalau authenticated tapi "ready" tidak muncul terlalu lama,
    // kita tetap resolve supaya bot tidak stuck (bisa kamu adjust 15-30 detik)
    const FALLBACK_MS = Number(process.env.WA_READY_TIMEOUT_MS || 20000);
    console.log("[wa] ready timeout (ms):", FALLBACK_MS);
    const fallbackTimer = setTimeout(() => {
      if (settled) return;
      console.log(
        "⚠️ Ready tidak terpanggil dalam waktu lama, lanjut paksa...",
      );
      settled = true;
      cleanup();
      resolve(client);
    }, FALLBACK_MS);

    // Pastikan timer dibersihkan
    const originalCleanup = cleanup;
    const cleanupWithTimer = () => {
      clearTimeout(fallbackTimer);
      originalCleanup();
    };

    // override cleanup references
    cleanup = cleanupWithTimer;

    // Start client
    client.initialize().catch((err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    });

    // Poll for pupPage availability if not yet ready
    const pollTimer = setInterval(() => {
      if (pageDebugAttached) {
        clearInterval(pollTimer);
        return;
      }
      if (client.pupPage) {
        attachPageDebug();
        clearInterval(pollTimer);
      }
    }, 1000);
  });

  return initPromise;
}

function isReady() {
  return ready;
}

async function sendNotification(data) {
  if (!ready) throw new Error("WhatsApp not ready");
  // contoh:
  // await client.sendMessage(`${data.phone}@c.us`, data.message);
}

module.exports = { initialize, isReady, sendNotification };
