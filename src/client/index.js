const { Client, LocalAuth } = require("whatsapp-web.js");
const { execSync } = require("child_process");

// Fungsi untuk mendeteksi path browser yang tersedia
function getBrowserPath() {
  const browsers = [
    "/usr/bin/chromium-browser",    // Raspberry Pi OS
    "/usr/bin/chromium",            // Debian/Ubuntu
    "/usr/bin/google-chrome",       // Google Chrome
    "/usr/bin/google-chrome-stable",
    "/snap/bin/chromium",           // Snap
  ];

  for (const browser of browsers) {
    try {
      execSync(`test -f ${browser}`);
      console.log(`🌐 Browser ditemukan: ${browser}`);
      return browser;
    } catch (e) {
      // Browser tidak ditemukan, coba yang lain
    }
  }

  // Coba deteksi dengan which
  try {
    const chromiumPath = execSync("which chromium-browser || which chromium || which google-chrome", { encoding: "utf-8" }).trim();
    if (chromiumPath) {
      console.log(`🌐 Browser ditemukan: ${chromiumPath}`);
      return chromiumPath;
    }
  } catch (e) {
    // Tidak ditemukan
  }

  console.error("❌ Tidak ada browser yang ditemukan! Install chromium-browser:");
  console.error("   sudo apt install chromium-browser");
  return null;
}

const browserPath = getBrowserPath();

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: true,
    executablePath: browserPath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--disable-translate",
      "--hide-scrollbars",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-default-browser-check",
      "--safebrowsing-disable-auto-update",
      "--ignore-certificate-errors",
      "--ignore-ssl-errors",
      "--ignore-certificate-errors-spki-list",
    ],
  },
  webVersionCache: {
    type: "remote",
    remotePath:
      "https://raw.githubusercontent.com/AKASHAorg/webwhatsapp-versions/main/canary.json",
  },
  restartOnAuthFail: true,
});

module.exports = { client };
