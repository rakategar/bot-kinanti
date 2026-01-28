#!/bin/bash
# ============================================
# start.sh - Start Bot Kinanti + Cloudflare Tunnel
# ============================================
# Script ini membuka 2 terminal:
# 1. Terminal untuk menjalankan bot (node server.js)
# 2. Terminal untuk menjalankan cloudflare tunnel
# ============================================
# Mendukung: Raspberry Pi, Linux Desktop, tmux, screen
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
LOG_DIR="$BOT_DIR/logs"

# Buat folder logs jika belum ada
mkdir -p "$LOG_DIR"

echo -e "${BLUE}============================================${NC}"
echo -e "${GREEN}   🤖 Bot Kinanti Starter${NC}"
echo -e "${BLUE}============================================${NC}"
echo ""

# Cek apakah terminal emulator tersedia (termasuk lxterminal untuk Raspberry Pi)
detect_terminal() {
    if command -v lxterminal &> /dev/null; then
        echo "lxterminal"  # Raspberry Pi OS Desktop
    elif command -v gnome-terminal &> /dev/null; then
        echo "gnome-terminal"
    elif command -v konsole &> /dev/null; then
        echo "konsole"
    elif command -v xfce4-terminal &> /dev/null; then
        echo "xfce4-terminal"
    elif command -v mate-terminal &> /dev/null; then
        echo "mate-terminal"
    elif command -v xterm &> /dev/null; then
        echo "xterm"
    elif command -v tmux &> /dev/null; then
        echo "tmux"  # Fallback ke tmux
    elif command -v screen &> /dev/null; then
        echo "screen"  # Fallback ke screen
    else
        echo "none"
    fi
}

TERMINAL=$(detect_terminal)

if [ "$TERMINAL" = "none" ]; then
    echo -e "${RED}❌ Error: Tidak ada terminal emulator yang ditemukan!${NC}"
    echo ""
    echo -e "${YELLOW}Pilih salah satu opsi:${NC}"
    echo "1. Install terminal emulator:"
    echo "   - Raspberry Pi: sudo apt install lxterminal"
    echo "   - Ubuntu/Debian: sudo apt install xterm"
    echo ""
    echo "2. Install tmux (recommended untuk server/headless):"
    echo "   sudo apt install tmux"
    echo ""
    echo "3. Gunakan background mode:"
    echo "   ./start-bg.sh"
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
        lxterminal)
            lxterminal --title="$title" --working-directory="$BOT_DIR" -e bash -c "$cmd; exec bash" &
            ;;
        gnome-terminal)
            gnome-terminal --title="$title" -- bash -c "$cmd; exec bash"
            ;;
        konsole)
            konsole --new-tab -p tabtitle="$title" -e bash -c "$cmd; exec bash"
            ;;
        xfce4-terminal)
            xfce4-terminal --title="$title" -e "bash -c '$cmd; exec bash'"
            ;;
        mate-terminal)
            mate-terminal --title="$title" -e "bash -c '$cmd; exec bash'" &
            ;;
        xterm)
            xterm -T "$title" -e "bash -c '$cmd; exec bash'" &
            ;;
    esac
    
    # Tunggu sebentar agar terminal terbuka
    sleep 1
}

# Fungsi untuk menjalankan dengan tmux
run_with_tmux() {
    local session_name="bot-kinanti"
    
    # Cek apakah session sudah ada
    if tmux has-session -t "$session_name" 2>/dev/null; then
        echo -e "${YELLOW}⚠️  Session tmux '$session_name' sudah ada${NC}"
        echo "Gunakan: tmux attach -t $session_name"
        echo "Atau stop dulu: tmux kill-session -t $session_name"
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Memulai Bot Kinanti dengan tmux...${NC}"
    echo ""
    
    # Buat session baru dengan window pertama untuk bot
    tmux new-session -d -s "$session_name" -n "bot" "cd '$BOT_DIR' && echo '🤖 Bot Kinanti' && echo '==================' && node server.js; exec bash"
    
    sleep 1
    
    # Buat window kedua untuk cloudflare
    tmux new-window -t "$session_name" -n "cloudflare" "echo '🌐 Cloudflare Tunnel' && echo '==================' && echo 'Endpoint: https://bot.kinantiku.com' && echo '' && cloudflared tunnel --config '$CONFIG_FILE' run; exec bash"
    
    # Kembali ke window pertama
    tmux select-window -t "$session_name:bot"
    
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}✅ Bot Kinanti berjalan di tmux!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  Attach ke session: ${BLUE}tmux attach -t $session_name${NC}"
    echo -e "  Detach dari tmux: ${BLUE}Ctrl+B lalu D${NC}"
    echo -e "  Pindah window: ${BLUE}Ctrl+B lalu 0/1${NC}"
    echo -e "  Stop session: ${BLUE}tmux kill-session -t $session_name${NC}"
    echo ""
    
    # Tanya apakah mau langsung attach
    read -p "Attach ke tmux sekarang? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        tmux attach -t "$session_name"
    fi
}

# Fungsi untuk menjalankan dengan screen
run_with_screen() {
    local session_name="bot-kinanti"
    
    # Cek apakah session sudah ada
    if screen -list | grep -q "$session_name"; then
        echo -e "${YELLOW}⚠️  Session screen '$session_name' sudah ada${NC}"
        echo "Gunakan: screen -r $session_name"
        echo "Atau stop dulu: screen -X -S $session_name quit"
        exit 1
    fi
    
    echo -e "${BLUE}🚀 Memulai Bot Kinanti dengan screen...${NC}"
    echo ""
    
    # Jalankan bot di screen
    screen -dmS "$session_name" bash -c "cd '$BOT_DIR' && node server.js"
    
    sleep 1
    
    # Jalankan cloudflare di screen terpisah
    screen -dmS "${session_name}-cf" bash -c "cloudflared tunnel --config '$CONFIG_FILE' run"
    
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN}✅ Bot Kinanti berjalan di screen!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    echo -e "${YELLOW}Commands:${NC}"
    echo -e "  Lihat bot: ${BLUE}screen -r $session_name${NC}"
    echo -e "  Lihat cloudflare: ${BLUE}screen -r ${session_name}-cf${NC}"
    echo -e "  Detach dari screen: ${BLUE}Ctrl+A lalu D${NC}"
    echo -e "  Stop semua: ${BLUE}./stop.sh${NC}"
    echo ""
}

echo -e "${BLUE}🚀 Memulai Bot Kinanti...${NC}"
echo ""

# Gunakan tmux atau screen jika tidak ada GUI terminal
if [ "$TERMINAL" = "tmux" ]; then
    run_with_tmux
    exit 0
elif [ "$TERMINAL" = "screen" ]; then
    run_with_screen
    exit 0
fi

# Terminal 1: Jalankan Bot
echo -e "${YELLOW}[1/2] Membuka terminal untuk Bot...${NC}"
open_terminal "Bot-Kinanti" "cd $BOT_DIR && echo '🤖 Bot Kinanti' && echo '==================' && node server.js"

sleep 3

# Terminal 2: Jalankan Cloudflare Tunnel
echo -e "${YELLOW}[2/2] Membuka terminal untuk Cloudflare Tunnel...${NC}"
open_terminal "Cloudflare-Tunnel" "echo '🌐 Cloudflare Tunnel' && echo '==================' && echo 'Endpoint: https://bot.kinantiku.com' && echo '' && cloudflared tunnel --config $CONFIG_FILE run"

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}✅ Bot Kinanti berhasil dijalankan!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo -e "📍 Bot: ${BLUE}http://localhost:4000${NC}"
echo -e "🌐 Public: ${BLUE}https://bot.kinantiku.com${NC}"
echo ""
echo -e "${YELLOW}Gunakan ./stop.sh untuk menghentikan bot${NC}"
echo -e "  - Atau gunakan: ${BLUE}./stop.sh${NC}"
echo ""
