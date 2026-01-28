#!/bin/bash
# ============================================
# stop.sh - Stop Bot Kinanti + Cloudflare Tunnel
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🛑 Menghentikan Bot Kinanti...${NC}"
echo ""

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

echo ""
echo -e "${GREEN}🛑 Semua proses dihentikan${NC}"
