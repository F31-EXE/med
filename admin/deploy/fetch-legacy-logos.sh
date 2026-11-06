#!/usr/bin/env bash
set -uo pipefail
OLD_IP=${1:-80.78.248.92}
LEGACY="$(cd "$(dirname "$0")/../server/prisma/legacy" && pwd)"
OUT="$LEGACY/files/event-logos"
mkdir -p "$OUT"
FILES=$(node -e "console.log([...new Set(Object.values(require(process.argv[1])))].join('\n'))" "$LEGACY/event-logos.json")
ok=0; fail=0
for f in $FILES; do
  if curl -fsS --max-time 30 --resolve "med-expo.org:443:$OLD_IP" -o "$OUT/$f" "https://med-expo.org/d/$f" \
    || curl -fsSk --max-time 30 --resolve "med-expo.org:443:$OLD_IP" -o "$OUT/$f" "https://med-expo.org/d/$f" \
    || curl -fsS --max-time 30 --resolve "med-expo.org:80:$OLD_IP" -o "$OUT/$f" "http://med-expo.org/d/$f"; then
    echo "скачан  $f"; ok=$((ok+1))
  else
    rm -f "$OUT/$f"; echo "НЕ УДАЛОСЬ  $f"; fail=$((fail+1))
  fi
done
echo "Готово: скачано $ok, не удалось $fail. Файлы: $OUT"
