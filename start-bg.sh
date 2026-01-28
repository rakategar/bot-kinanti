#!/bin/bash
# ============================================
# start-bg.sh - Start Bot Kinanti di Background
# ============================================
# Script ini menjalankan bot dan cloudflare di background
# Output disimpan ke file log
# ============================================

BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$BOT_DIR/cloudflared/config.yml"
LOG_DIR="$BOT_DIR/logs"
BOT_LOG="$LOG_DIR/bot.log"
CF_LOG="$LOG_DIR/cloudflare.log"
PID_FILE="$LOG_DIR/pids.txt"

# Buat folder logs jika belum ada
mkdir -p "$LOG_DIR"

# Warna
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   🤖 Bot Kinanti (Background Mode)${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Cek apakah sudah berjalan
if [ -f "$PID_FILE" ]; then
    OLD_BOT_PID=$(grep "bot=" "$PID_FILE" | cut -d'=' -f2)
    OLD_CF_PID=$(grep "cloudflare=" "$PID_FILE" | cut -d'=' -f2)
    
    if [ -n "$OLD_BOT_PID" ] && kill -0 "$OLD_BOT_PID" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Bot sudah berjalan (PID: $OLD_BOT_PID)${NC}"
        echo "Gunakan ./stop.sh untuk menghentikan terlebih dahulu"
        exit 1
    fi
fi

# Load nvm jika ada (untuk Raspberry Pi dengan nvm)
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

# Jalankan Bot di background
echo -e "${YELLOW}[1/2] Menjalankan Bot...${NC}"
cd "$BOT_DIR"
nohup node server.js > "$BOT_LOG" 2>&1 &
BOT_PID=$!
echo -e "${GREEN}✅ Bot berjalan (PID: $BOT_PID)${NC}"

sleep 2

# Jalankan Cloudflare Tunnel di background
echo -e "${YELLOW}[2/2] Menjalankan Cloudflare Tunnel...${NC}"
nohup cloudflared tunnel --config "$CONFIG_FILE" run > "$CF_LOG" 2>&1 &
CF_PID=$!
echo -e "${GREEN}✅ Cloudflare Tunnel berjalan (PID: $CF_PID)${NC}"

# Simpan PID ke file
echo "bot=$BOT_PID" > "$PID_FILE"
echo "cloudflare=$CF_PID" >> "$PID_FILE"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Bot Kinanti berhasil dijalankan di background!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "📍 Bot: ${BLUE}http://localhost:4000${NC}"
echo -e "🌐 Public: ${BLUE}https://bot.kinantiku.com${NC}"
echo ""
echo -e "${YELLOW}Logs:${NC}"
echo -e "  Bot: ${BLUE}$BOT_LOG${NC}"
echo -e "  Cloudflare: ${BLUE}$CF_LOG${NC}"
echo ""
echo -e "${YELLOW}Commands:${NC}"
echo -e "  Lihat log bot: ${BLUE}tail -f $BOT_LOG${NC}"
echo -e "  Stop semua: ${BLUE}./stop.sh${NC}"
echo ""
