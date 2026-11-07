import "dotenv/config";
import "../src/lib/dbEnv.js";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ExcelJS from "exceljs";
import { prisma } from "../src/lib/prisma.js";
import { normalizePhone } from "../src/lib/registrations.js";

const args = process.argv.slice(2);
const apply = args.includes("--apply");
const guess = !args.includes("--no-guess");
const inputs = args.filter((a) => !a.startsWith("--"));
if (!inputs.length) {
  console.error("Укажите файлы или папку с выгрузкой: npm run db:import-old-forms -w server -- ~/clients [--apply]");
  process.exit(1);
}

type Row = Record<string, string>;
type Table = { file: string; rows: Row[] };

function decode(buf: Buffer) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8").replace(/^\uFEFF/, "");
  const utf8 = buf.toString("utf8");
  return utf8.includes("�") ? new TextDecoder("windows-1251").decode(buf) : utf8;
}

const headerLine = /^\uFEFF?"?Form_name"?([;,\t])/;

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/);
  const declared = lines.map((l) => l.match(headerLine)).find(Boolean);
  const delim = declared ? declared[1]! : [";", "\t", ","].sort((a, b) => lines[0]!.split(b).length - lines[0]!.split(a).length)[0]!;
  const out: string[][] = [];
  let chunk: string[] = [];
  const flush = () => {
    if (chunk.length) out.push(...parseRows(chunk.join("\n"), delim));
    chunk = [];
  };
  for (const line of lines) {
    if (headerLine.test(line)) {
      flush();
      out.push(line.replace(/^\uFEFF/, "").split(delim).map((h) => h.replace(/^"|"$/g, "").replace(/""/g, '"')));
    } else chunk.push(line);
  }
  flush();
  return out;
}

function parseRows(text: string, delim: string) {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === delim) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); out.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.filter((r) => r.some((v) => v.trim()));
}

const key = (h: string) => h.replace(/\s+/g, " ").replace(/:\s*$/, "").trim();

function toTables(file: string, grid: string[][]): Table[] {
  const tables: Table[] = [];
  let header: string[] | null = null;
  for (const r of grid) {
    if (key(r[0] ?? "") === "Form_name") {
      header = r.map(key);
      tables.push({ file, rows: [] });
      continue;
    }
    if (!header) continue;
    const row: Row = {};
    header.forEach((h, i) => { if (h) row[h] = (r[i] ?? "").trim(); });
    tables[tables.length - 1]!.rows.push(row);
  }
  return tables;
}

async function readFile(file: string): Promise<Table[]> {
  if (/\.xlsx$/i.test(file)) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const tables: Table[] = [];
    wb.eachSheet((s) => {
      const grid: string[][] = [];
      s.eachRow((r) => grid.push((r.values as unknown[]).slice(1).map((v) => (v == null ? "" : v instanceof Date ? v.toISOString() : typeof v === "object" && v && "text" in v ? String((v as { text: unknown }).text) : String(v)))));
      tables.push(...toTables(file, grid));
    });
    return tables;
  }
  const text = decode(readFileSync(file));
  const tables = toTables(file, parseCsv(text));
  if (!tables.length) console.warn(`${file}: не найдена строка заголовков Form_name. Начало файла: ${JSON.stringify(text.slice(0, 80))}`);
  return tables;
}

function listFiles(p: string): string[] {
  if (!existsSync(p)) throw new Error(`Нет файла или папки: ${p}`);
  if (statSync(p).isDirectory()) return readdirSync(p).filter((f) => /\.(csv|txt|xlsx)$/i.test(f)).sort().map((f) => path.join(p, f));
  return [p];
}

function pick(row: Row, ...patterns: RegExp[]) {
  for (const re of patterns) for (const [k, v] of Object.entries(row)) if (re.test(k) && v) return v;
  return "";
}

function parseDate(v: string) {
  const m = v.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const [, d, mo, y, h = "0", mi = "0", s = "0"] = m;
    return new Date(`${y}-${mo!.padStart(2, "0")}-${d!.padStart(2, "0")}T${h.padStart(2, "0")}:${mi}:${s.padStart(2, "0")}+05:00`);
  }
  const t = Date.parse(v);
  return Number.isNaN(t) ? new Date() : new Date(t);
}

const months = ["январ", "феврал", "март", "апрел", "ма", "июн", "июл", "август", "сентябр", "октябр", "ноябр", "декабр"];
const words = (s: string) => new Set(s.toLowerCase().replace(/ё/g, "е").match(/[а-яa-z0-9]{4,}/g) ?? []);

const events = await prisma.event.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, title: true, subtitle: true, startDate: true, endDate: true, attendanceMode: true, directions: { select: { name: true } } } });

function matchEvent(text: string) {
  if (!text) return null;
  const dm = text.toLowerCase().match(/(\d{1,2})(?:\s*[-–]\s*\d{1,2})?\s+([а-яё]+)\s+(\d{4})/);
  if (dm) {
    const mi = months.findIndex((m) => dm[2]!.startsWith(m === "ма" ? "ма" : m));
    if (mi >= 0) {
      const iso = `${dm[3]}-${String(mi + 1).padStart(2, "0")}-${dm[1]!.padStart(2, "0")}`;
      const byDate = events.filter((e) => e.startDate.toISOString().slice(0, 10) === iso);
      if (byDate.length === 1) return byDate[0]!;
    }
  }
  const w = words(text);
  let best: (typeof events)[number] | null = null;
  let score = 0;
  for (const e of events) {
    const ew = words(`${e.title} ${e.subtitle ?? ""}`);
    let hit = 0;
    for (const x of ew) if (w.has(x)) hit++;
    const s = ew.size ? hit / ew.size : 0;
    const yearOk = text.includes(String(e.startDate.getUTCFullYear()));
    const total = s + (yearOk ? 0.2 : 0);
    if (total > score) { score = total; best = e; }
  }
  return score >= 0.55 ? best : null;
}

const mapFile = inputs.map((p) => (existsSync(p) && statSync(p).isDirectory() ? path.join(p, "events-map.json") : path.join(path.dirname(p), "events-map.json"))).find((p) => existsSync(p));
const manualMap: Record<string, string> = mapFile ? JSON.parse(readFileSync(mapFile, "utf8")) : {};

const legacyData = JSON.parse(readFileSync(path.join(import.meta.dirname, "legacy", "data.json"), "utf8")) as { events: { slug: string; oldPrefix?: string }[] };
const oldPrefixes = legacyData.events.filter((e) => e.oldPrefix).map((e) => ({ prefix: e.oldPrefix!, slug: e.slug })).sort((a, b) => b.prefix.length - a.prefix.length);
const redirects = new Map((await prisma.redirect.findMany({ select: { fromPath: true, toPath: true } })).map((r) => [r.fromPath, r.toPath]));

function refPath(v: string) {
  const m = v.match(/https?:\/\/[^\s"']+/);
  if (!m) return "";
  try {
    const u = new URL(m[0]);
    return decodeURI(u.pathname + u.search).replace(/\/+$/, "") || "/";
  } catch {
    return "";
  }
}

function eventByRef(ref: string) {
  const target = redirects.get(ref) ?? redirects.get(ref.split("?")[0]!) ?? ref;
  const slug = target.match(/^\/events\/([^/?#]+)/)?.[1];
  if (slug) return events.find((e) => e.slug === slug) ?? null;
  const tail = ref.match(/\/post\/([^/?#]+)/)?.[1];
  const legacy = tail ? oldPrefixes.find((p) => tail.startsWith(p.prefix)) : undefined;
  return legacy ? events.find((e) => e.slug === legacy.slug) ?? null : null;
}

const unmatchedMonths = new Map<string, number>();
const guessed = new Map<string, number>();

const specialtyHints: [RegExp, RegExp][] = [
  [/травм|ортопед|вертебр|хирург|реабилит|протез/i, /травм|ортопед/i],
  [/акушер|гинеколог|перинат|родиль|женск|роддом/i, /акушер|гинеколог|репродукт/i],
  [/неонат|новорожд/i, /неонат/i],
  [/анестез|реаним/i, /анестез|реаним/i],
  [/педиатр|детск/i, /педиатр|неонат/i],
  [/репродукт|эко\b|врт|бесплод/i, /репродукт|акушер/i],
];

function guessEvent(at: Date, text: string) {
  const from = at.getTime() - 3 * 86400000;
  const to = at.getTime() + 120 * 86400000;
  const candidates = events.filter((e) => e.startDate.getTime() >= from && e.startDate.getTime() <= to).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
  if (!candidates.length) return null;
  const wanted = specialtyHints.filter(([row]) => row.test(text)).map(([, dir]) => dir);
  if (wanted.length) {
    const fit = candidates.find((e) => e.directions.some((d) => wanted.some((re) => re.test(d.name))));
    if (fit) return fit;
  }
  return candidates[0]!;
}
const tables = (await Promise.all(inputs.flatMap(listFiles).map(readFile))).flat();
const today = new Date();

const stats = { regNew: 0, regDup: 0, regNoEmail: 0, regNoEvent: 0, reqNew: 0, reqDup: 0 };
const eventChoices = new Map<string, { slug: string | null; count: number }>();
const forms = new Map<string, number>();
const excelPhones = new Set<string>();
const seenReg = new Set<string>();

for (const t of tables) {
  for (const row of t.rows) {
    const form = row["Form_name"] || "Без названия";
    forms.set(form, (forms.get(form) ?? 0) + 1);
    const at = parseDate(row["Date"] ?? "");
    const phoneRaw = pick(row, /^телефон$/i, /^номер телефона$/i, /^(?!.*e-?mail).*телефон/i);
    if (/e\+/i.test(phoneRaw)) excelPhones.add(t.file);
    const phone = normalizePhone(phoneRaw) ?? (phoneRaw || null);
    const isRegistration = Object.keys(row).some((k) => /фамили/i.test(k));

    if (isRegistration) {
      const choice = pick(row, /выпадающ/i, /мероприят/i);
      const ref = refPath(row["Referer"] ?? "");
      const month = at.toISOString().slice(0, 7);
      const manual = manualMap[choice] ?? (ref ? manualMap[ref] : undefined) ?? (!choice ? manualMap[month] : undefined);
      let ev = manual ? events.find((e) => e.slug === manual) ?? null : (choice ? matchEvent(choice) : null) ?? (ref ? eventByRef(ref) : null);
      let auto = false;
      if (!ev && !choice && guess) {
        ev = guessEvent(at, `${pick(row, /должност/i)} ${pick(row, /организац/i)}`);
        auto = !!ev;
        if (ev) guessed.set(ev.slug, (guessed.get(ev.slug) ?? 0) + 1);
      }
      const label = choice || `(пусто) страница: ${ref || "не указана"}`;
      if (!auto) {
        const ch = eventChoices.get(label) ?? { slug: ev?.slug ?? null, count: 0 };
        ch.count++;
        eventChoices.set(label, ch);
      }
      if (!ev) {
        stats.regNoEvent++;
        unmatchedMonths.set(month, (unmatchedMonths.get(month) ?? 0) + 1);
        continue;
      }
      const email = pick(row, /e-?mail|почт/i).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { stats.regNoEmail++; continue; }
      const dupKey = `${ev.id}|${email}`;
      const exists = seenReg.has(dupKey) || (await prisma.registration.findUnique({ where: { eventId_email: { eventId: ev.id, email } }, select: { id: true } }));
      seenReg.add(dupKey);
      if (exists) { stats.regDup++; continue; }
      const participation = pick(row, /форма участия/i);
      stats.regNew++;
      if (apply) {
        await prisma.registration.create({
          data: {
            eventId: ev.id,
            lastName: pick(row, /фамили/i) || "—",
            firstName: pick(row, /^ваше имя$/i, /имя/i) || "—",
            middleName: pick(row, /отчеств/i) || null,
            email,
            phone: phone ?? "",
            specialtyName: "Не указана",
            workplace: pick(row, /организац/i) || null,
            position: pick(row, /должност/i) || null,
            city: pick(row, /город/i) || "Не указан",
            format: ev.attendanceMode === "ONLINE" ? "ONLINE" : "OFFLINE",
            consentPersonalData: true,
            consentAt: at,
            status: ev.endDate < today ? "CONFIRMED" : "NEW",
            source: "MANUAL",
            managerComment: ["Перенесено со старого сайта med-expo.org", auto && "мероприятие не было выбрано в форме, определено по дате заявки и должности — проверьте", participation && `Форма участия: ${participation}`].filter(Boolean).join(". "),
            createdAt: at,
          },
        });
      }
      continue;
    }

    const contact = pick(row, /e-?mail или телефон/i);
    const email = pick(row, /^e-?mail$/i, /почт/i) || (contact.includes("@") ? contact : "");
    const phone2 = phone ?? (contact && !contact.includes("@") ? normalizePhone(contact) ?? contact : null);
    const name = pick(row, /^ваше имя/i, /имя/i) || "Без имени";
    const skip = /^(form_name|date|referer|галочка)$|выражаю|согласи|^ваше имя|телефон|e-?mail|почт|организац/i;
    const comment = Object.entries(row)
      .filter(([k, v]) => v && !skip.test(k) && !/^я выражаю/i.test(v))
      .map(([k, v]) => (/область ввода|текст|сообщени|вопрос/i.test(k) ? v : `${k}: ${v}`))
      .join("\n");
    const source = `Старый сайт: ${form}`;
    const exists = await prisma.contactRequest.findFirst({ where: { source, createdAt: at, name }, select: { id: true } });
    if (exists) { stats.reqDup++; continue; }
    stats.reqNew++;
    if (apply) {
      await prisma.contactRequest.create({
        data: {
          name: name.slice(0, 200),
          organization: pick(row, /организац/i) || null,
          phone: phone2,
          email: email || null,
          comment: comment || null,
          source,
          consentAt: at,
          status: "PROCESSED",
          processedAt: at,
          createdAt: at,
        },
      });
    }
  }
}

console.log(apply ? "ИМПОРТ ВЫПОЛНЕН" : "ПРОБНЫЙ ЗАПУСК — в базу ничего не записано (добавьте --apply)");
console.log("\nФормы в выгрузке:");
for (const [f, n] of forms) console.log(`  ${f}: ${n}`);
console.log("\nМероприятия в регистрациях («Выпадающий список» → мероприятие на новом сайте):");
for (const [c, v] of [...eventChoices].sort((a, b) => b[1].count - a[1].count)) console.log(`  [${v.count}] ${c.slice(0, 110) || "(пусто)"}\n      → ${v.slug ?? "НЕ НАЙДЕНО"}`);
if (guessed.size) {
  console.log(`\nМероприятие не выбрано в форме — определено по дате заявки и должности (${[...guessed.values()].reduce((a, b) => a + b, 0)}; отключить: --no-guess):`);
  for (const [slug, n] of [...guessed].sort((a, b) => b[1] - a[1])) console.log(`  [${n}] → ${slug}`);
}
if (unmatchedMonths.size) console.log(`\nРегистрации без мероприятия по месяцам: ${[...unmatchedMonths].sort().map(([m, n]) => `${m}: ${n}`).join(", ")}`);
console.log(`\nРегистрации: новых ${stats.regNew}, уже были ${stats.regDup}, без e-mail ${stats.regNoEmail}, без мероприятия ${stats.regNoEvent}`);
console.log(`Обращения: новых ${stats.reqNew}, уже были ${stats.reqDup}`);
if (stats.regNoEvent) console.log(`\nЧтобы привязать «НЕ НАЙДЕНО» вручную, создайте рядом с выгрузкой events-map.json: {"текст из выпадающего списка, адрес страницы или месяц ГГГГ-ММ": "адрес-мероприятия"}`);
if (excelPhones.size) console.log(`\nВНИМАНИЕ: телефоны вида 8,91E+10 в ${[...excelPhones].join(", ")} — файл пересохранён в Excel. Возьмите исходный файл из архива.`);
await prisma.$disconnect();
