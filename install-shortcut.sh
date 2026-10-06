#!/usr/bin/env bash
# ينشئ أيقونة "Daily Control" على سطح المكتب وفي قائمة التطبيقات
DIR="$(cd "$(dirname "$(readlink -f "$0")")" && pwd)"
chmod +x "$DIR/launch.sh"
DESK="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
mkdir -p "$DESK" "$HOME/.local/share/applications"
for T in "$DESK" "$HOME/.local/share/applications"; do
cat > "$T/daily-control.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Daily Control
Comment=افتح Daily Control في المتصفح
Exec=bash "$DIR/launch.sh"
Icon=utilities-terminal
Terminal=false
Categories=Utility;
Actions=stop;

[Desktop Action stop]
Name=إيقاف
Exec=bash "$DIR/launch.sh" stop
EOF
chmod +x "$T/daily-control.desktop"
gio set "$T/daily-control.desktop" metadata::trusted true 2>/dev/null
done
echo "تم. اضغط على أيقونة Daily Control على سطح المكتب."
