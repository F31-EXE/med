import "dotenv/config";
import "../src/lib/dbEnv.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { LOGO_DIR, loadEventLogos, logoCover, logoFile } from "./legacyLogos.js";

const force = process.argv.includes("--force");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const logos = await loadEventLogos();
let done = 0;
const missingFiles: string[] = [];
const missingEvents: string[] = [];
const skipped: string[] = [];

for (const [slug, file] of Object.entries(logos)) {
  const src = logoFile(file);
  if (!src) {
    missingFiles.push(`${file} (${slug})`);
    continue;
  }
  const event = await prisma.event.findUnique({ where: { slug }, select: { id: true, coverUrl: true } });
  if (!event) {
    missingEvents.push(slug);
    continue;
  }
  if (event.coverUrl && !force) {
    skipped.push(slug);
    continue;
  }
  const cover = await logoCover(src);
  await prisma.event.update({ where: { id: event.id }, data: { coverUrl: cover.url, coverThumbUrl: cover.thumbUrl } });
  done++;
}

console.log(`Логотипы поставлены обложками: ${done} из ${Object.keys(logos).length}`);
if (skipped.length) console.log(`Уже есть обложка (пропущено, --force чтобы заменить): ${skipped.join(", ")}`);
if (missingEvents.length) console.log(`Нет мероприятий: ${missingEvents.join(", ")}`);
if (missingFiles.length) console.log(`Нет файлов в ${LOGO_DIR}:\n  ${missingFiles.join("\n  ")}`);
await prisma.$disconnect();
