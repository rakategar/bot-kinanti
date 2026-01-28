// routes/broadcast.js
const express = require("express");
const { MessageMedia } = require("whatsapp-web.js");
const { safeSendMessage } = require("../src/utils/waHelper");

function broadcastRouteFactory(waClient) {
  const router = express.Router();

  // (Opsional) autentikasi sederhana via BOT_SECRET
  router.use((req, res, next) => {
    const needAuth = !!process.env.BOT_SECRET;
    if (!needAuth) return next();
    const hdr = req.headers.authorization || "";
    if (hdr === "Bearer " + process.env.BOT_SECRET) return next();
    return res.status(401).json({ error: "Unauthorized" });
  });

  // === Endpoint utama ===
  router.post("/", async (req, res) => {
    try {
      const { kode, kelas, siswa, judul, deadline, pdfUrl } = req.body || {};
      if (!Array.isArray(siswa) || siswa.length === 0)
        return res.status(400).json({ error: "Daftar siswa kosong." });
      if (!kode || !kelas)
        return res.status(400).json({ error: "Kode & kelas wajib diisi." });

      console.log(
        "[Broadcast] " + kelas + " | " + kode + " → " + siswa.length + " siswa",
      );

      const deadlineStr = deadline
        ? new Date(deadline).toLocaleString("id-ID", {
            timeZone: "Asia/Jakarta",
          })
        : "Belum diatur";

      const header =
        "📢 *Tugas Baru!*\n" +
        "🔖 *Kode:* " +
        kode +
        "\n" +
        "📚 *Judul:* " +
        (judul || "-") +
        "\n" +
        "🗓️ *Deadline:* " +
        deadlineStr +
        "\n" +
        "📎 *Lampiran PDF guru:* " +
        (pdfUrl || "-") +
        "\n" +
        "\n🧭 *Cara mengumpulkan:*\n" +
        "1) Balas chat ini dengan: *pilih menu 3, lalu pilih tugas " +
        kode +
        "*\n" +
        "2) (Jika diminta) lampirkan *PDF* tugasmu\n" +
        "3) Tekan kirim dan tunggu konfirmasi ✅";

      let sentCount = 0;
      let failedCount = 0;

      for (const s of siswa) {
        const number = String(s.phone || "").replace(/\D/g, "");
        const jid = number + "@c.us";

        try {
          // safeSendMessage sekarang akan mencari LID yang benar secara otomatis
          await safeSendMessage(waClient, jid, header);
          sentCount++;

          // Send PDF attachment if exists
          if (pdfUrl) {
            try {
              const media = await MessageMedia.fromUrl(pdfUrl);
              await waClient.sendMessage(jid, media, {
                caption: "📎 Lampiran: " + (judul || "Tugas"),
              });
            } catch (mediaErr) {
              if (
                !mediaErr ||
                !mediaErr.message ||
                !mediaErr.message.includes("markedUnread")
              ) {
                console.error(
                  "⚠️ [Broadcast] Gagal kirim media ke",
                  number,
                  mediaErr.message,
                );
              }
            }
          }
        } catch (e) {
          failedCount++;
          if (!e || !e.message || !e.message.includes("markedUnread")) {
            console.error("❌ [Broadcast] Gagal kirim ke", number, e.message);
          }
        }
      }

      console.log(
        "[Broadcast] Done: " + sentCount + " sent, " + failedCount + " failed",
      );

      return res.json({
        ok: true,
        sent: sentCount,
        failed: failedCount,
        total: siswa.length,
        sample: siswa.slice(0, 3).map((s) => s.phone),
      });
    } catch (err) {
      console.error("Broadcast error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}

module.exports = broadcastRouteFactory;
