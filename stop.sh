#!/bin/bash
# ============================================
# stop.sh - Stop Bot Kinanti + Cloudflare Tunnel
# ============================================
# Mendukung: process langsung, tmux, screen
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Menghentikan Bot Kinanti...${NC}"
echo ""

# Stop tmux session jika ada
if command -v tmux &> /dev/null; then
    if tmux has-session -t "bot-kinanti" 2>/dev/null; then
        echo -e "${YELLOW}Menghentikan tmux session 'bot-kinanti'...${NC}"
        tmux kill-session -t "bot-kinanti"
        echo -e "${GREEN}✅ Tmux session dihentikan${NC}"
    fi
fi

# Stop screen session jika ada
if command -v screen &> /dev/null; then
    if screen -list | grep -q "bot-kinanti"; then
        echo -e "${YELLOW}Menghentikan screen session 'bot-kinanti'...${NC}"
        screen -X -S "bot-kinanti" quit 2>/dev/null
        screen -X -S "bot-kinanti-cf" quit 2>/dev/null
        echo -e "${GREEN}✅ Screen session dihentikan${NC}"
    fi
fi

# Kill node server.js processes
NODE_PIDS=$(pgrep -f "node server.js" 2>/dev/null)
if [ -n "$NODE_PIDS" ]; then
    echo -e "${YELLOW}Menghentikan bot (PID: $NODE_PIDS)...${NC}"
    pkill -f "node server.js"
    echo -e "${GREEN}✅ Bot dihentikan${NC}"
else
    echo -e "${YELLOW}Bot tidak berjalan${NC}"
fi

# Kill cloudflared tunnel processes
CF_PIDS=$(pgrep -f "cloudflared tunnel" 2>/dev/null)
if [ -n "$CF_PIDS" ]; then
    echo -e "${YELLOW}Menghentikan Cloudflare tunnel (PID: $CF_PIDS)...${NC}"
    pkill -f "cloudflared tunnel"
    echo -e "${GREEN}✅ Cloudflare tunnel dihentikan${NC}"
else
    echo -e "${YELLOW}Cloudflare tunnel tidak berjalan${NC}"
fi

# Hapus PID file jika ada
BOT_DIR="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$BOT_DIR/logs/pids.txt"
if [ -f "$PID_FILE" ]; then
    rm -f "$PID_FILE"
fi

echo ""
echo -e "${GREEN}🛑 Semua proses dihentikan${NC}"
