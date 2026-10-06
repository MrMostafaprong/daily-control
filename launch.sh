#!/usr/bin/env bash
# تشغيل Daily Control وفتحه في المتصفح بضغطة واحدة
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
cd "$DIR" || exit 1
LOG="${TMPDIR:-/tmp}/daily-control.log"
PIDF="${TMPDIR:-/tmp}/daily-control.pid"
note() { command -v notify-send >/dev/null && notify-send "Daily Control" "$1"; echo "$1" >> "$LOG"; }

if [ "$1" = "stop" ]; then
  [ -f "$PIDF" ] && kill "$(cat "$PIDF")" 2>/dev/null && rm -f "$PIDF" && note "تم الإيقاف"
  exit 0
fi

command -v node >/dev/null || { note "Node.js غير مثبت (مطلوب 18+)"; exit 1; }

# 1) ملف البيئة + المفتاح
if [ ! -f backend/.env ]; then cp backend/.env.example backend/.env; fi
if ! grep -qE '^MASTER_KEY=.+' backend/.env; then
  KEY="$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")"
  if grep -q '^MASTER_KEY=' backend/.env; then sed -i "s|^MASTER_KEY=.*|MASTER_KEY=$KEY|" backend/.env
  else echo "MASTER_KEY=$KEY" >> backend/.env; fi
fi
PORT="$(grep -E '^PORT=' backend/.env | head -1 | cut -d= -f2)"; PORT="${PORT:-5000}"
URL="http://127.0.0.1:$PORT"

# 2) تثبيت/بناء أول مرة فقط
if [ ! -d backend/node_modules ]; then note "أول تشغيل: تثبيت الباك إند..."; (cd backend && npm install --omit=dev >>"$LOG" 2>&1) || { note "فشل تثبيت الباك إند (راجع $LOG)"; exit 1; }; fi
if [ ! -f frontend/dist/index.html ]; then
  note "أول تشغيل: بناء الواجهة..."
  (cd frontend && npm install >>"$LOG" 2>&1 && npm run build >>"$LOG" 2>&1) || { note "فشل بناء الواجهة (راجع $LOG)"; exit 1; }
fi

# 3) شغّل السيرفر لو مش شغال
if ! curl -fs "$URL/api/health" >/dev/null 2>&1; then
  (cd backend; nohup node server.js >>"$LOG" 2>&1 & echo $! > "$PIDF")
  for _ in $(seq 1 40); do curl -fs "$URL/api/health" >/dev/null 2>&1 && break; sleep 0.5; done
fi
curl -fs "$URL/api/health" >/dev/null 2>&1 || { note "السيرفر لم يبدأ (راجع $LOG)"; exit 1; }

# 4) افتح المتصفح
xdg-open "$URL" >/dev/null 2>&1 || sensible-browser "$URL" >/dev/null 2>&1
