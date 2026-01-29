const { Client, LocalAuth, NoAuth } = require("whatsapp-web.js");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Fungsi untuk mendeteksi path browser yang tersedia
function getBrowserPath() {
  const envOverride =
    process.env.CHROME_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    process.env.GOOGLE_CHROME_BIN;

  if (envOverride && fs.existsSync(envOverride)) {
    try {
      execSync(`"${envOverride}" --version`, { stdio: "pipe" });
      console.log(`🌐 Browser ditemukan (env): ${envOverride}`);
      return envOverride;
    } catch (e) {
      console.warn(`⚠️ Browser env tidak bisa dipakai: ${envOverride}`);
    }
  }

  const browsers = [
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",    // Raspberry Pi OS / Ubuntu (snap wrapper)
    "/snap/bin/chromium",           // Snap
  ];

  for (const browser of browsers) {
    try {
      execSync(`test -f ${browser}`);
      execSync(`"${browser}" --version`, { stdio: "pipe" });
      console.log(`🌐 Browser ditemukan: ${browser}`);
      return browser;
    } catch (e) {
      // Browser tidak ditemukan, coba yang lain
    }
  }

  // Coba deteksi dengan which
  try {
    const chromiumPath = execSync(
      "which google-chrome-stable || which google-chrome || which chromium || which chromium-browser",
      { encoding: "utf-8" },
    ).trim();
    if (chromiumPath) {
      try {
        execSync(`"${chromiumPath}" --version`, { stdio: "pipe" });
        console.log(`🌐 Browser ditemukan: ${chromiumPath}`);
        return chromiumPath;
      } catch (e) {
        // Tidak bisa dipakai (mis. snap-confine)
      }
    }
  } catch (e) {
    // Tidak ditemukan
  }

  console.error("❌ Tidak ada browser yang bisa dipakai! Install browser non-snap:");
  console.error("   sudo apt install google-chrome-stable");
  console.error("   atau set CHROME_PATH ke path chrome yang valid");
  return null;
}

const browserPath = getBrowserPath();

const headlessEnv = process.env.PUPPETEER_HEADLESS;
const isHeadless =
  headlessEnv === undefined
    ? true
    : !["0", "false", "no"].includes(String(headlessEnv).toLowerCase());

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
  puppeteer: {
    headless: isHeadless,
    executablePath: browserPath,
    timeout: 120000,
    dumpio: process.env.PUPPETEER_DUMPIO === "1",
    protocolTimeout: 120000,
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
      "--disable-features=TranslateUI",
      "--disable-ipc-flooding-protection",
      "--disable-renderer-backgrounding",
      "--disable-backgrounding-occluded-windows",
      "--disable-component-update",
      "--disable-domain-reliability",
    ],
  },
  // Disable web version cache untuk menghindari error
  webVersionCache: {
    type: "none",
  },
  restartOnAuthFail: true,
});

module.exports = { client };
