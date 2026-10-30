const env = process.env;

function find(suffix: string) {
  const key = Object.keys(env).find((k) => k.endsWith(suffix) && !k.startsWith("SHADOW") && env[k]);
  return key ? env[key] : undefined;
}

const url = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL || find("_DATABASE_URL") || find("_POSTGRES_URL");
const direct = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || find("_DATABASE_URL_UNPOOLED") || find("_POSTGRES_URL_NON_POOLING");
if (url) env.DATABASE_URL = url;
if (direct) env.DATABASE_URL_UNPOOLED = direct;

export function checkDeployEnv() {
  const missing = [
    !env.DATABASE_URL && "база данных: Storage → Neon → Connect Project",
    !env.BLOB_READ_WRITE_TOKEN && "хранилище файлов: Storage → Blob (Public) → Connect Project",
    !env.SEED_ADMIN_PASSWORD && "SEED_ADMIN_PASSWORD в Settings → Environment Variables",
  ].filter(Boolean);
  if (!missing.length) return;
  console.error(`\nНе хватает настроек Vercel:\n${missing.map((m) => `  • ${m}`).join("\n")}\nПодключите их и запустите Redeploy.\n`);
  process.exit(1);
}
