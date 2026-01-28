#!/bin/bash
# ============================================
# start.sh - Start Bot Kinanti + Cloudflare Tunnel
# ============================================
# Script ini membuka 2 terminal:
# 1. Terminal untuk menjalankan bot (node server.js)
# 2. Terminal untuk menjalankan cloudflare tunnel
# ============================================

# Warna untuk output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Direktori bot
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="$BOT_DIR/cloudflared/config.yml"

echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   🤖 Bot Kinanti Starter${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Cek apakah gnome-terminal atau terminal emulator lain tersedia
detect_terminal() {
    if command -v gnome-terminal &> /dev/null; then
        echo "gnome-terminal"
    elif command -v konsole &> /dev/null; then
        echo "konsole"
    elif command -v xfce4-terminal &> /dev/null; then
        echo "xfce4-terminal"
    elif command -v xterm &> /dev/null; then
        echo "xterm"
    else
        echo "none"
    fi
}

TERMINAL=$(detect_terminal)

if [ "$TERMINAL" = "none" ]; then
    echo -e "${RED}❌ Error: Tidak ada terminal emulator yang ditemukan!${NC}"
    echo "Install salah satu: gnome-terminal, konsole, xfce4-terminal, atau xterm"
    exit 1
fi

echo -e "${YELLOW}📦 Terminal yang digunakan: $TERMINAL${NC}"
echo ""

# Cek apakah cloudflared terinstall
if ! command -v cloudflared &> /dev/null; then
    echo -e "${RED}❌ Error: cloudflared tidak terinstall!${NC}"
    echo "Install dengan: sudo snap install cloudflared"
    exit 1
fi

# Cek apakah node terinstall
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Error: Node.js tidak terinstall!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Semua dependencies tersedia${NC}"
echo ""

# Fungsi untuk membuka terminal dengan command
open_terminal() {
    local title="$1"
    local cmd="$2"
    
    case $TERMINAL in
        gnome-terminal)
            gnome-terminal --title="$title" -- bash -c "$cmd; exec bash"
            ;;
        konsole)
            konsole --new-tab -p tabtitle="$title" -e bash -c "$cmd; exec bash"
            ;;
        xfce4-terminal)
            xfce4-terminal --title="$title" -e "bash -c '$cmd; exec bash'"
            ;;
        xterm)
            xterm -T "$title" -e "bash -c '$cmd; exec bash'" &
            ;;
    esac
}

echo -e "${BLUE}🚀 Memulai Bot Kinanti...${NC}"
echo ""

# Terminal 1: Jalankan Bot
echo -e "${YELLOW}[1/2] Membuka terminal untuk Bot...${NC}"
open_terminal "🤖 Bot Kinanti" "cd '$BOT_DIR' && echo '🤖 Bot Kinanti' && echo '==================' && node server.js"

sleep 2

# Terminal 2: Jalankan Cloudflare Tunnel
echo -e "${YELLOW}[2/2] Membuka terminal untuk Cloudflare Tunnel...${NC}"
open_terminal "🌐 Cloudflare Tunnel" "echo '🌐 Cloudflare Tunnel' && echo '==================' && echo 'Endpoint: https://bot.kinantiku.com' && echo '' && cloudflared tunnel --config '$CONFIG_FILE' run"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Bot Kinanti berhasil dijalankan!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "📍 Bot berjalan di: ${BLUE}http://localhost:4000${NC}"
echo -e "🌐 Public URL: ${BLUE}https://bot.kinantiku.com${NC}"
echo ""
echo -e "${YELLOW}Tips:${NC}"
echo -e "  - Untuk stop, tutup kedua terminal yang terbuka"
echo -e "  - Atau gunakan: ${BLUE}./stop.sh${NC}"
echo ""
