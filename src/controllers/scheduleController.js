// src/controllers/scheduleController.js
const cron = require("node-cron");
const { client } = require("../client");
const { safeSendMessage } = require("../utils/waHelper");

// ===== Prisma import yang robust (default/named) =====
const prismaMod = require("../config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;

// ================== KONFIGURASI ==================
const LOCALE_TZ = "Asia/Jakarta"; // hanya untuk format tampilan via Intl

// ================== ANTI-SPAM CONFIG ==================
// Delay antar pesan untuk menghindari rate-limit & ban
const WA_DELAY_MIN_MS = 3000; // Minimum 3 detik
const WA_DELAY_MAX_MS = 7000; // Maximum 7 detik (random delay)
const BATCH_SIZE = 20; // Kirim per batch 20 penerima
const BATCH_DELAY_MS = 60000; // Jeda 1 menit antar batch
const MAX_MESSAGES_PER_HOUR = 100; // Limit maksimal pesan per jam

// Legacy (untuk backward compatibility)
const WA_DELAY_MS = WA_DELAY_MIN_MS;

// ================== WAKTU (WIB, TANPA LIB) ==================
// Catatan: kita definisikan WIB = UTC+7, tanpa DST
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

// Ambil objek Date "sekarang" di WIB (untuk tampilan/logika lokal)
function nowWIB() {
  const now = new Date();
  const nowUtcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(nowUtcMs + WIB_OFFSET_MS);
}

// Format tanggal ke string WIB yang rapi (pakai Intl, aman tanpa lib eksternal)
function fmtWIB(dateLike) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: LOCALE_TZ,
      weekday: "short",
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateLike));
  } catch {
    return String(dateLike ?? "-");
  }
}

// Hitung rentang start/end hari WIB tertentu → hasilkan Date UTC untuk query Prisma
function startEndOfWIBDayUtc(dateLikeUTCOrNow = new Date()) {
  const baseUtc = new Date(dateLikeUTCOrNow);
  const baseUtcMs = baseUtc.getTime();

  // Konversi momen UTC ke "jam WIB" dengan menambah +7 jam
  const asWib = new Date(baseUtcMs + WIB_OFFSET_MS);

  // Buat "midnight WIB" & "akhir hari WIB" lalu kembalikan ke UTC (kurangi 7 jam)
  const startWibMidnightUtcMs =
    Date.UTC(
      asWib.getUTCFullYear(),
      asWib.getUTCMonth(),
      asWib.getUTCDate(),
      0,
      0,
      0,
      0,
    ) - WIB_OFFSET_MS;
  const endWibUtcMs =
    Date.UTC(
      asWib.getUTCFullYear(),
      asWib.getUTCMonth(),
      asWib.getUTCDate(),
      23,
      59,
      59,
      999,
    ) - WIB_OFFSET_MS;

  return {
    startUtc: new Date(startWibMidnightUtcMs),
    endUtc: new Date(endWibUtcMs),
  };
}

function todayRangeUtc() {
  return startEndOfWIBDayUtc(new Date());
}
function tomorrowRangeUtc() {
  // Ambil "hari ini" di WIB, tambahkan 1 hari (di WIB), lalu hitung rentangnya
  const todayWib = nowWIB();
  const tomorrowWib = new Date(
    Date.UTC(
      todayWib.getUTCFullYear(),
      todayWib.getUTCMonth(),
      todayWib.getUTCDate() + 1,
      12,
    ),
  );
  // titik jam 12 WIB hanya sebagai anchor; startEndOfWIBDayUtc akan mengunci ke 00:00/23:59 WIB
  return startEndOfWIBDayUtc(tomorrowWib);
}

// ================== UTILITAS LAIN ==================
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Random delay untuk anti-spam (lebih human-like)
const randomDelay = () => {
  const delay = Math.floor(
    Math.random() * (WA_DELAY_MAX_MS - WA_DELAY_MIN_MS) + WA_DELAY_MIN_MS,
  );
  return sleep(delay);
};

// Kirim pesan dengan batching untuk menghindari spam detection
async function sendMessagesInBatches(messageQueue, logPrefix = "📨") {
  const totalMessages = messageQueue.length;
  let sent = 0;
  let failed = 0;

  console.log(
    `${logPrefix} Memulai pengiriman ${totalMessages} pesan dalam batch...`,
  );

  for (let i = 0; i < messageQueue.length; i += BATCH_SIZE) {
    const batch = messageQueue.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(totalMessages / BATCH_SIZE);

    console.log(
      `${logPrefix} Batch ${batchNum}/${totalBatches} (${batch.length} pesan)`,
    );

    for (const { jid, body, nama } of batch) {
      try {
        await safeSendMessage(client, jid, body);
        sent++;
        console.log(`  ✅ Terkirim ke ${nama || jid}`);
      } catch (error) {
        failed++;
        console.error(`  ❌ Gagal kirim ke ${nama || jid}:`, error.message);
      }
      // Random delay antar pesan (3-7 detik)
      await randomDelay();
    }

    // Jika masih ada batch berikutnya, tunggu 1 menit
    if (i + BATCH_SIZE < messageQueue.length) {
      console.log(
        `${logPrefix} Jeda ${BATCH_DELAY_MS / 1000} detik sebelum batch berikutnya...`,
      );
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log(
    `${logPrefix} Selesai: ${sent} terkirim, ${failed} gagal dari ${totalMessages} total`,
  );
  return { sent, failed, total: totalMessages };
}

const toJid = (phone) => {
  const p = String(phone || "").replace(/[^\d]/g, "");
  if (!p) return null;
  const normalized = p.startsWith("0") ? "62" + p.slice(1) : p; // 08xx → 628xx
  return `${normalized}@c.us`;
};

function renderList(items, cap = 10) {
  const lines = [];
  const cut = Math.min(items.length, cap);
  for (let i = 0; i < cut; i++) {
    const it = items[i] || {};
    const kodeAtauJudul = it.kode || it.judul || "-";
    lines.push(
      `${i + 1}. *${kodeAtauJudul}* — ${
        it.deadline ? fmtWIB(it.deadline) : "-"
      }`,
    );
  }
  if (items.length > cap)
    lines.push(`…dan ${items.length - cap} tugas lainnya`);
  return lines.join("\n");
}

// Semangat random
const SEMANGAT = [
  "Tetap semangat menggapai impianmu! 🚀",
  "Hari baru, kesempatan baru! 💪",
  "Jangan takut gagal, takutlah untuk tidak mencoba. ✨",
  "Setiap langkah kecil hari ini membawa dampak besar besok! 🌱",
  "Belajar adalah investasi terbaik untuk masa depanmu. 📚",
  "Tantangan hari ini adalah kekuatanmu besok! 🔥",
  "Sukses adalah akumulasi usaha kecil setiap hari. 🏆",
  "Berani bermimpi, berani bertindak! 🎯",
  "Hari ini penuh peluang, jangan sia-siakan! 🌟",
];
const pickSemangat = () =>
  SEMANGAT[Math.floor(Math.random() * SEMANGAT.length)];

// ================== AKSES DATA (sesuai schema) ==================
// Ambil semua AssignmentStatus yang BELUM_SELESAI, include relasi siswa & tugas
async function fetchOpenStatuses() {
  if (!prisma?.assignmentStatus?.findMany) {
    throw new Error("Prisma tidak siap (assignmentStatus delegate undefined)");
  }
  const rows = await prisma.assignmentStatus.findMany({
    where: { status: "BELUM_SELESAI" },
    include: {
      siswa: true,
      tugas: true,
    },
  });
  // filter yang relasinya lengkap
  return rows.filter((r) => r?.siswa?.id && r?.tugas?.id);
}

// Group by siswa (tugas diurutkan deadline ASC; null di akhir)
function groupBySiswa(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.siswa.id))
      map.set(r.siswa.id, { siswa: r.siswa, tugas: [] });
    map.get(r.siswa.id).tugas.push(r.tugas);
  }
  for (const v of map.values()) {
    v.tugas.sort((a, b) => {
      const da = a?.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b?.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da - db;
    });
  }
  return [...map.values()];
}

// Klasifikasikan tugas relatif ke "hari ini/besok" WIB
function classifyTasks(tugasList) {
  const now = new Date(); // UTC
  const { startUtc: startTodayUtc, endUtc: endTodayUtc } = todayRangeUtc();
  const { startUtc: startTmrUtc, endUtc: endTmrUtc } = tomorrowRangeUtc();

  const overdue = [];
  const dueToday = [];
  const dueTomorrow = [];
  const others = [];

  for (const t of tugasList) {
    const d = t?.deadline ? new Date(t.deadline) : null;
    if (!d) {
      others.push(t);
      continue;
    }
    if (d < now) {
      overdue.push(t);
    } else if (d >= startTodayUtc && d <= endTodayUtc) {
      dueToday.push(t);
    } else if (d >= startTmrUtc && d <= endTmrUtc) {
      dueTomorrow.push(t);
    } else {
      others.push(t);
    }
  }
  return { overdue, dueToday, dueTomorrow, others };
}

// ================== BROADCASTS ==================
async function broadcastPagi() {
  try {
    const openStatuses = await fetchOpenStatuses();
    const grouped = groupBySiswa(openStatuses);

    // Ambil siswa tanpa tugas supaya tetap dapat sapaan
    const allSiswa = await prisma.user.findMany({ where: { role: "siswa" } });
    const withSet = new Set(grouped.map((g) => g.siswa.id));
    const siswaTanpaTugas = allSiswa.filter((s) => !withSet.has(s.id));

    const headerTanggal = new Intl.DateTimeFormat("id-ID", {
      timeZone: LOCALE_TZ,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(nowWIB());

    // Siapkan antrian pesan (message queue)
    const messageQueue = [];

    // Siapkan pesan untuk yang punya tugas
    for (const g of grouped) {
      const jid = toJid(g.siswa.phone);
      if (!jid) continue;

      const { overdue, dueToday, dueTomorrow, others } = classifyTasks(g.tugas);

      let body = `🌅 *Selamat Pagi ${g.siswa.nama || "Siswa"}!*\n\n`;
      body += `📅 *Hari ini:* ${headerTanggal}\n`;
      body += `💬 _"${pickSemangat()}"_\n\n`;

      if (!g.tugas.length) {
        body += "✅ Tidak ada tugas yang belum diselesaikan.\n";
      } else {
        if (overdue.length)
          body += `⚠️ *Terlambat:*\n${renderList(overdue)}\n\n`;
        if (dueToday.length)
          body += `🟡 *Jatuh Tempo Hari Ini:*\n${renderList(dueToday)}\n\n`;
        if (dueTomorrow.length)
          body += `🔔 *Jatuh Tempo Besok:*\n${renderList(dueTomorrow)}\n\n`;
        if (others.length)
          body += `📝 *Tugas Lainnya:*\n${renderList(others)}\n`;
      }

      messageQueue.push({ jid, body, nama: g.siswa.nama });
    }

    // Siapkan pesan untuk siswa tanpa tugas
    for (const s of siswaTanpaTugas) {
      const jid = toJid(s.phone);
      if (!jid) continue;
      const body =
        `🌅 *Selamat Pagi ${s.nama || "Siswa"}!*\n\n` +
        `📅 *Hari ini:* ${headerTanggal}\n` +
        `💬 _"${pickSemangat()}"_\n\n` +
        `✅ Tidak ada tugas yang perlu dikerjakan. Have a nice day! 🌟`;

      messageQueue.push({ jid, body, nama: s.nama });
    }

    // Kirim dengan batching (anti-spam)
    await sendMessagesInBatches(messageQueue, "🌅 [Broadcast Pagi]");
  } catch (error) {
    console.error("❌ Error broadcast pagi:", error);
  }
}

async function broadcastSore() {
  try {
    const openStatuses = await fetchOpenStatuses();
    const grouped = groupBySiswa(openStatuses);
    if (!grouped.length) {
      console.log(
        "✅ Tidak ada siswa dengan tugas BELUM_SELESAI untuk sore ini.",
      );
      return;
    }

    const headerTanggal = new Intl.DateTimeFormat("id-ID", {
      timeZone: LOCALE_TZ,
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(nowWIB());

    // Siapkan antrian pesan
    const messageQueue = [];

    for (const g of grouped) {
      const jid = toJid(g.siswa.phone);
      if (!jid) continue;

      const { overdue, dueToday, dueTomorrow, others } = classifyTasks(g.tugas);
      if (
        !(
          overdue.length ||
          dueToday.length ||
          dueTomorrow.length ||
          others.length
        )
      )
        continue;

      let body = `🌇 *Selamat Sore ${g.siswa.nama || "Siswa"}!*\n\n`;
      body += `📅 *Hari ini:* ${headerTanggal}\n\n`;
      body += `📝 *Reminder Tugas Anda:*\n`;

      const blocks = [];
      if (overdue.length)
        blocks.push(`⚠️ *Terlambat:*\n${renderList(overdue)}`);
      if (dueToday.length)
        blocks.push(`🟡 *Jatuh Tempo Hari Ini:*\n${renderList(dueToday)}`);
      if (dueTomorrow.length)
        blocks.push(`🔔 *Jatuh Tempo Besok:*\n${renderList(dueTomorrow)}`);
      if (others.length)
        blocks.push(`📝 *Tugas Lainnya:*\n${renderList(others)}`);

      body += blocks.join("\n\n");
      body += `\n\n💬 Selesaikan sebelum deadline ya. Semangat! 🚀`;

      messageQueue.push({ jid, body, nama: g.siswa.nama });
    }

    // Kirim dengan batching (anti-spam)
    await sendMessagesInBatches(messageQueue, "🌇 [Broadcast Sore]");
  } catch (error) {
    console.error("❌ Error broadcast sore:", error);
  }
}

async function reminderDeadlineBesok() {
  try {
    const { startUtc, endUtc } = tomorrowRangeUtc();

    const rows = await prisma.assignmentStatus.findMany({
      where: {
        status: "BELUM_SELESAI",
        tugas: {
          deadline: {
            gte: startUtc,
            lte: endUtc,
          },
        },
      },
      include: {
        siswa: true,
        tugas: true,
      },
    });

    const map = new Map();
    for (const r of rows) {
      if (!r?.siswa?.id || !r?.tugas?.id) continue;
      if (!map.has(r.siswa.id))
        map.set(r.siswa.id, { siswa: r.siswa, tugas: [] });
      map.get(r.siswa.id).tugas.push(r.tugas);
    }

    const groups = [...map.values()];
    if (!groups.length) {
      console.log("✅ Tidak ada tugas yang jatuh tempo besok.");
      return;
    }

    // Siapkan antrian pesan
    const messageQueue = [];

    for (const g of groups) {
      const jid = toJid(g.siswa.phone);
      if (!jid) continue;

      g.tugas.sort((a, b) => {
        const da = a?.deadline ? new Date(a.deadline).getTime() : Infinity;
        const db = b?.deadline ? new Date(b.deadline).getTime() : Infinity;
        return da - db;
      });

      const body =
        `🔔 *Reminder Tugas — Deadline Besok!*\n\n` +
        `Hai ${g.siswa.nama || "Siswa"} 👋,\n` +
        `Besok adalah deadline tugas berikut:\n\n` +
        `${renderList(g.tugas)}\n\n` +
        `💬 Segera selesaikan tugasmu ya biar tidak terlambat! Semangat! 🚀`;

      messageQueue.push({ jid, body, nama: g.siswa.nama });
    }

    // Kirim dengan batching (anti-spam)
    await sendMessagesInBatches(messageQueue, "� [Reminder Deadline Besok]");
  } catch (error) {
    console.error("❌ Error reminder deadline besok:", error);
  }
}

// ================== PENJADWALAN (CRON) ==================
let __SCHEDULED = global.__KINANTI_SCHEDULED || false;
function setupSchedules() {
  if (__SCHEDULED) {
    console.log("⏰ Schedules already set, skipping re-register.");
    return;
  }

  // Contoh: atur sesuai kebutuhanmu
  cron.schedule(
    "0 7 * * *", // 07:00 WIB
    async () => {
      console.log("⏰ Broadcast pagi");
      await broadcastPagi();
    },
    { timezone: LOCALE_TZ },
  );

  cron.schedule(
    "0 17 * * *", // 17:00 WIB
    async () => {
      console.log("⏰ Broadcast sore + reminder deadline besok");
      await broadcastSore();
      await reminderDeadlineBesok();
    },
    { timezone: LOCALE_TZ },
  );

  global.__KINANTI_SCHEDULED = true;
  __SCHEDULED = true;
  console.log("✅ Schedules registered.");
}

module.exports = {
  setupSchedules,
  broadcastPagi,
  broadcastSore,
  reminderDeadlineBesok,
};
