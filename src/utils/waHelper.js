// src/utils/waHelper.js
// Helper untuk mengatasi bug markedUnread di whatsapp-web.js

// Import getJidByPhone untuk lookup LID mapping
const { getJidByPhone } = require("../services/state");

/**
 * Safe reply - mengirim pesan dengan penanganan error markedUnread
 * @param {Object} message - WhatsApp message object
 * @param {string} text - Text to reply
 * @param {Object} clientOrOptions - Optional: WhatsApp client or reply options
 */
async function safeReply(message, text, clientOrOptions = {}) {
  const chatId = message.from;

  // Determine if third param is a client or options object
  let client = message.client || message._client;
  let options = {};

  if (clientOrOptions) {
    // Check if it's a WhatsApp client (has pupPage property)
    if (clientOrOptions.pupPage || clientOrOptions.initialize) {
      client = clientOrOptions;
    } else {
      options = clientOrOptions;
    }
  }

  try {
    // Coba kirim menggunakan pupPage.evaluate (bypass sendSeen yang bermasalah)
    if (client && client.pupPage) {
      try {
        const result = await client.pupPage.evaluate(
          async (chatId, content) => {
            try {
              // Find chat using Store.Chat
              let chat =
                window.Store &&
                window.Store.Chat &&
                window.Store.Chat.get(chatId);

              if (!chat) {
                // Try to find using WidFactory as fallback
                const wid =
                  window.Store &&
                  window.Store.WidFactory &&
                  window.Store.WidFactory.createWid(chatId);
                if (wid) {
                  chat = await window.Store.Chat.find(wid);
                }
              }

              if (chat) {
                // Send message using WWebJS.sendMessage
                const msgResult = await window.WWebJS.sendMessage(
                  chat,
                  content,
                  {},
                  {},
                );
                return {
                  success: true,
                  id:
                    (msgResult && msgResult.id && msgResult.id._serialized) ||
                    "sent",
                };
              }

              return { success: false, error: "Chat not found" };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
          chatId,
          text,
        );

        if (result.success) {
          console.log("✅ [safeReply] Sent via pupPage to " + chatId);
          return result;
        }

        // Jika pupPage gagal, lanjut ke fallback
        console.log(
          "⚠️ [safeReply] pupPage failed: " +
            result.error +
            ", trying fallback",
        );
      } catch (pupErr) {
        console.log(
          "⚠️ [safeReply] pupPage error: " +
            pupErr.message +
            ", trying fallback",
        );
      }
    }

    // Fallback ke message.reply dengan try-catch
    return await message.reply(text, undefined, options);
  } catch (error) {
    const errorMsg = error && error.message ? error.message : String(error);

    // Jika error markedUnread, pesan kemungkinan sudah terkirim
    if (errorMsg.includes("markedUnread")) {
      console.log(
        "⚠️ [safeReply] markedUnread error (ignored, pesan mungkin terkirim)",
      );
      return { success: true, warning: "markedUnread" };
    }

    console.error("❌ [safeReply] Error: " + errorMsg);
    throw error;
  }
}

/**
 * Safe send message menggunakan client
 * @param {Object} client - WhatsApp client
 * @param {string} to - Recipient JID (62xxx@c.us) or phone number
 * @param {string} text - Text to send
 * @param {Object} options - Optional send options
 */
async function safeSendMessage(client, to, text, options = {}) {
  // Extract phone number from input
  var phoneNumber = to.replace(/@.*$/, "").replace(/\D/g, "");

  // ========== CHECK MAPPING FIRST ==========
  // Cek apakah ada mapping phone → JID yang sudah disimpan (untuk handle @lid)
  var mappedJid = getJidByPhone(phoneNumber);
  var targetJid = mappedJid || phoneNumber + "@c.us";

  if (mappedJid && mappedJid !== phoneNumber + "@c.us") {
    console.log(
      "�� [safeSendMessage] Using mapped JID: " +
        phoneNumber +
        " → " +
        mappedJid,
    );
  }

  try {
    // Coba kirim menggunakan pupPage.evaluate dengan targetJid yang sudah di-resolve
    if (client && client.pupPage) {
      try {
        var result = await client.pupPage.evaluate(
          async (jid, content) => {
            try {
              // Langsung gunakan JID yang sudah di-resolve (bisa @c.us atau @lid)
              var targetChat =
                window.Store && window.Store.Chat && window.Store.Chat.get(jid);

              if (!targetChat) {
                var wid =
                  window.Store &&
                  window.Store.WidFactory &&
                  window.Store.WidFactory.createWid(jid);
                if (wid) {
                  targetChat = await window.Store.Chat.find(wid);
                }
              }

              if (targetChat) {
                var msgResult = await window.WWebJS.sendMessage(
                  targetChat,
                  content,
                  {},
                  {},
                );
                return {
                  success: true,
                  id:
                    (msgResult && msgResult.id && msgResult.id._serialized) ||
                    "sent",
                  jid: jid,
                };
              }

              return { success: false, error: "Chat not found for " + jid };
            } catch (e) {
              return { success: false, error: e.message };
            }
          },
          targetJid,
          text,
        );

        if (result.success) {
          console.log("✅ [safeSendMessage] Sent to " + targetJid);
          return result;
        }

        // pupPage gagal, coba fallback
        console.log(
          "⚠️ [safeSendMessage] pupPage failed: " +
            result.error +
            ", trying fallback",
        );
      } catch (pupErr) {
        console.log(
          "⚠️ [safeSendMessage] pupPage error: " +
            pupErr.message +
            ", trying fallback",
        );
      }
    }

    // Fallback ke client.sendMessage - wrap dalam try-catch khusus markedUnread
    try {
      var msg = await client.sendMessage(targetJid, text, options);
      console.log("✅ [safeSendMessage] Sent to " + targetJid);
      return msg;
    } catch (fallbackErr) {
      var errMsg =
        fallbackErr && fallbackErr.message
          ? fallbackErr.message
          : String(fallbackErr);
      if (errMsg.includes("markedUnread")) {
        // markedUnread error tapi pesan SUDAH TERKIRIM - anggap sukses
        console.log(
          "✅ [safeSendMessage] Sent to " +
            targetJid +
            " (markedUnread ignored)",
        );
        return { success: true, to: targetJid };
      }
      throw fallbackErr;
    }
  } catch (error) {
    var errorMsg = error && error.message ? error.message : String(error);

    // Jika error markedUnread, pesan kemungkinan sudah terkirim
    if (errorMsg.includes("markedUnread")) {
      console.log(
        "⚠️ [safeSendMessage] markedUnread error ke " +
          targetJid +
          " (ignored)",
      );
      return { success: true, warning: "markedUnread", to: targetJid };
    }

    console.error(
      "❌ [safeSendMessage] Error ke " + targetJid + ": " + errorMsg,
    );
    throw error;
  }
}

module.exports = { safeReply, safeSendMessage };
