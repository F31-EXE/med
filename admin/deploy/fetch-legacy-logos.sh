#!/usr/bin/env bash
set -uo pipefail
OLD_BASE=${OLD_BASE:-https://2527244.21.oml.ru}
OLD_IP=${1:-}
LEGACY="$(cd "$(dirname "$0")/../server/prisma/legacy" && pwd)"
OUT="$LEGACY/files/event-logos"
mkdir -p "$OUT"
FILES=$(node -e "console.log([...new Set(Object.values(require(process.argv[1])))].join('\n'))" "$LEGACY/event-logos.json")

is_image() { [ -s "$1" ] && file -b --mime-type "$1" | grep -q '^image/'; }

get() {
  curl -fsSL --max-time 60 "$@" -o "$TMP" && is_image "$TMP"
}

ok=0; fail=0
for f in $FILES; do
  TMP="$OUT/.$f.part"
  thumb=$(node -e "console.log(require(process.argv[1])[process.argv[2]] || '')" "$LEGACY/event-logo-thumbs.json" "$f")
  src=""
  if get -k "$OLD_BASE/d/$f" || { [ -n "$thumb" ] && get -k "$OLD_BASE$thumb" && echo "  (только превью)"; }; then
    src="старый сайт $OLD_BASE"
  elif [ -n "$OLD_IP" ] && { get --resolve "med-expo.org:80:$OLD_IP" "http://med-expo.org/d/$f" || get -k --resolve "med-expo.org:443:$OLD_IP" "https://med-expo.org/d/$f"; }; then
    src="старый хостинг"
  elif get "https://web.archive.org/web/2020id_/http://med-expo.org/d/$f" || get "https://web.archive.org/web/2020id_/https://med-expo.org/d/$f"; then
    src="веб-архив, полный размер"
  elif [ -n "$thumb" ] && { get "https://web.archive.org/web/2020id_/http://med-expo.org$thumb" || get "https://web.archive.org/web/2020id_/https://med-expo.org$thumb"; }; then
    src="веб-архив, превью"
  fi
  if [ -n "$src" ]; then
    mv "$TMP" "$OUT/$f"; echo "скачан  $f ($src)"; ok=$((ok+1))
  else
    rm -f "$TMP"; echo "НЕ НАЙДЕН  $f"; fail=$((fail+1))
  fi
done
echo "Готово: скачано $ok, не найдено $fail. Файлы: $OUT"
echo "Поставить обложками: cd ~/app/admin && npm run db:legacy-logos -w server"
