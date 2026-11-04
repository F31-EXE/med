#!/usr/bin/env bash
set -euo pipefail
cd /home/med/app
git pull --ff-only
cd admin
npm ci
npm run build
npm run db:deploy -w server
sudo systemctl restart med-expo
echo "Готово: $(git log --oneline -1)"
