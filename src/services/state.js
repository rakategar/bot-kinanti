// src/services/state.js
// Simple in-memory state management untuk dialog flow

const prismaMod = require("../config/prisma");
const prisma = prismaMod?.prisma ?? prismaMod?.default ?? prismaMod;

const userStates = new Map();

// In-memory cache for phone → JID mapping (untuk performa)
const phoneToJidCache = new Map();

/**
 * Get user state
 * @param {string} userPhone - User's phone number
 * @returns {Promise<Object|null>} - User state object or null
 */
async function getState(userPhone) {
  return userStates.get(userPhone) || null;
}

/**
 * Set user state
 * @param {string} userPhone - User's phone number
 * @param {Object} state - State object to save
 * @returns {Promise<void>}
 */
async function setState(userPhone, state) {
  userStates.set(userPhone, state);
}

/**
 * Clear user state
 * @param {string} userPhone - User's phone number
 * @returns {Promise<void>}
 */
async function clearState(userPhone) {
  userStates.delete(userPhone);
}

/**
 * Save mapping from phone number to actual JID
 * This is used to handle @lid (Linked ID) cases
 * Saves to both in-memory cache and database
 * @param {string} phone - Phone number (62xxx)
 * @param {string} jid - Actual JID (xxx@c.us or xxx@lid)
 */
async function setPhoneJid(phone, jid) {
  if (!phone || !jid) return;

  // Update cache
  const existingJid = phoneToJidCache.get(phone);
  if (existingJid === jid) return; // Skip if same

  phoneToJidCache.set(phone, jid);
  console.log("📱 [JID Map] " + phone + " → " + jid);

  // Save to database (upsert)
  try {
    await prisma.phoneJidMapping.upsert({
      where: { phone: phone },
      update: { jid: jid },
      create: { phone: phone, jid: jid },
    });
  } catch (err) {
    console.error("❌ [JID Map] Failed to save to DB:", err.message);
  }
}

/**
 * Get actual JID for a phone number
 * First checks cache, then database
 * @param {string} phone - Phone number (62xxx)
 * @returns {string|null} - Actual JID or null if not found
 */
function getJidByPhone(phone) {
  if (!phone) return null;

  // Check cache first
  const cached = phoneToJidCache.get(phone);
  if (cached) return cached;

  // If not in cache, will be loaded from DB on next call
  // (async load happens in background)
  loadJidFromDb(phone);

  return null;
}

/**
 * Load JID from database and update cache
 * @param {string} phone - Phone number
 */
async function loadJidFromDb(phone) {
  try {
    const mapping = await prisma.phoneJidMapping.findUnique({
      where: { phone: phone },
    });
    if (mapping) {
      phoneToJidCache.set(phone, mapping.jid);
      console.log(
        "📱 [JID Map] Loaded from DB: " + phone + " → " + mapping.jid,
      );
    }
  } catch (err) {
    // Ignore errors
  }
}

/**
 * Load all JID mappings from database to cache on startup
 */
async function loadAllJidMappings() {
  try {
    const mappings = await prisma.phoneJidMapping.findMany();
    for (const m of mappings) {
      phoneToJidCache.set(m.phone, m.jid);
    }
    console.log("📱 [JID Map] Loaded " + mappings.length + " mappings from DB");
  } catch (err) {
    console.error("❌ [JID Map] Failed to load from DB:", err.message);
  }
}

/**
 * Get all phone to JID mappings from cache
 * @returns {Map} - Map of phone → JID
 */
function getAllPhoneJidMappings() {
  return phoneToJidCache;
}

// Load mappings on startup
loadAllJidMappings();

module.exports = {
  getState,
  setState,
  clearState,
  setPhoneJid,
  getJidByPhone,
  getAllPhoneJidMappings,
  loadAllJidMappings,
};
