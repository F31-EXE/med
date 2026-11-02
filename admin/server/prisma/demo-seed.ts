import "dotenv/config";
import "../src/lib/dbEnv.js";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type EventFormat } from "../src/generated/prisma/client.js";
import { saveFile } from "../src/lib/storage.js";
import { storeDocument } from "../src/lib/documents.js";

if (process.env.NODE_ENV === "production") {
  console.error("Демо-наполнение нельзя запускать в production");
  process.exit(1);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DAY = 864e5;
function dateOnly(offsetDays: number) {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) + offsetDays * DAY);
  return d;
}

const palettes: Record<EventFormat, [string, string, string]> = {
  CONGRESS: ["#E6F7F1", "#CFE4F8", "#2FA38A"],
  CONFERENCE: ["#EEF6FD", "#BFDDF5", "#0B5ED7"],
  SEMINAR: ["#FFF2EB", "#FFE0D1", "#FF9670"],
  EXHIBITION: ["#F2F0FC", "#DCD6F8", "#9585E6"],
  ONLINE_SYMPOSIUM: ["#E6F7F1", "#EEF6FD", "#2FA38A"],
};

function coverSvg(format: EventFormat, seed: number) {
  const [a, b, c] = palettes[format];
  const r = (n: number) => ((seed * 9301 + n * 49297) % 233280) / 233280;
  const circles = Array.from({ length: 6 }, (_, i) => {
    const cx = Math.round(r(i) * 1920);
    const cy = Math.round(r(i + 10) * 1080);
    const rad = Math.round(120 + r(i + 20) * 320);
    return `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${i % 2 ? c : "#ffffff"}" opacity="${i % 2 ? 0.16 : 0.5}"/>`;
  }).join("");
  const people = `<g transform="translate(760 330) scale(4)" fill="${c}"><circle cx="48" cy="30" r="12"/><path d="M26 74c0-14 10-24 22-24s22 10 22 24z"/><g opacity=".55"><circle cx="20" cy="40" r="8"/><path d="M6 76c0-10 6-17 14-17s14 7 14 17z"/><circle cx="76" cy="40" r="8"/><path d="M62 76c0-10 6-17 14-17s14 7 14 17z"/></g></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="1920" height="1080" fill="url(#g)"/>${circles}${people}</svg>`;
}

function logoSvg(name: string, color: string, shape: number) {
  const mark =
    shape === 0
      ? `<circle cx="60" cy="60" r="34" fill="none" stroke="${color}" stroke-width="12"/>`
      : shape === 1
        ? `<rect x="28" y="28" width="64" height="64" rx="18" fill="${color}"/><path d="M60 42v36M42 60h36" stroke="#fff" stroke-width="10" stroke-linecap="round"/>`
        : shape === 2
          ? `<path d="M60 22l38 66H22z" fill="${color}"/>`
          : `<path d="M30 60c0-20 14-34 30-34s30 14 30 34-14 34-30 34" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="120">${mark}<text x="116" y="78" font-family="DejaVu Sans, Arial, sans-serif" font-size="44" font-weight="700" fill="#33475B">${name}</text></svg>`;
}

async function saveImage(svg: string, preset: "cover" | "logo" | "gallery") {
  const sizes = {
    cover: { full: { width: 1920, height: 1080, fit: "inside" as const }, thumb: { width: 640, height: 360, fit: "cover" as const } },
    gallery: { full: { width: 1920, height: 1920, fit: "inside" as const }, thumb: { width: 480, height: 360, fit: "cover" as const } },
    logo: { full: { width: 800, height: 400, fit: "inside" as const }, thumb: { width: 320, height: 160, fit: "inside" as const } },
  }[preset];
  const name = randomBytes(9).toString("base64url");
  const src = sharp(Buffer.from(svg), { density: 96 });
  const [full, thumb] = await Promise.all([src.clone().resize(sizes.full).webp({ quality: 82 }).toBuffer(), src.clone().resize(sizes.thumb).webp({ quality: 80 }).toBuffer()]);
  const [url, thumbUrl] = await Promise.all([
    saveFile(`images/demo/${name}.webp`, full, "image/webp"),
    saveFile(`images/demo/${name}-thumb.webp`, thumb, "image/webp"),
  ]);
  return { url, thumbUrl };
}

function pdf(title: string) {
  const text = title.replace(/[^\x20-\x7e]/g, "?");
  const content = `BT /F1 18 Tf 72 760 Td (${text}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, "latin1");
}

async function saveDoc(title: string, extra: { eventId?: string; eventSection?: "MAIN" | "RESULTS"; eventSortOrder?: number; svedenSection?: string; sectionSortOrder?: number; description?: string }) {
  const buf = pdf(title);
  const rel = await storeDocument(buf, "pdf");
  return prisma.document.create({
    data: {
      publicId: randomBytes(9).toString("base64url"),
      title,
      description: extra.description ?? null,
      fileKey: rel,
      originalName: `${title}.pdf`,
      extension: "pdf",
      mimeType: "application/pdf",
      size: buf.length,
      eventId: extra.eventId,
      eventSection: extra.eventSection ?? "MAIN",
      eventSortOrder: extra.eventSortOrder ?? 0,
      svedenSection: extra.svedenSection,
      sectionSortOrder: extra.sectionSortOrder ?? 0,
    },
  });
}

console.log("Очищаю контент (пользователи остаются)…");
await prisma.$transaction([
  prisma.registration.deleteMany(),
  prisma.contactRequest.deleteMany(),
  prisma.newsImage.deleteMany(),
  prisma.news.deleteMany(),
  prisma.document.deleteMany(),
  prisma.eventPartner.deleteMany(),
  prisma.eventImage.deleteMany(),
  prisma.sessionSpeaker.deleteMany(),
  prisma.programSession.deleteMany(),
  prisma.programDay.deleteMany(),
  prisma.hall.deleteMany(),
  prisma.eventSpeaker.deleteMany(),
  prisma.eventTariff.deleteMany(),
  prisma.event.deleteMany(),
  prisma.speaker.deleteMany(),
  prisma.partner.deleteMany(),
  prisma.page.deleteMany(),
  prisma.siteSetting.deleteMany(),
  prisma.direction.deleteMany(),
  prisma.city.deleteMany(),
  prisma.specialty.deleteMany(),
]);

const dirNames = ["Кардиология", "Неврология", "Педиатрия", "Эндокринология", "Онкология", "Терапия", "Функциональная диагностика"];
const directions = Object.fromEntries(await Promise.all(dirNames.map(async (name) => [name, (await prisma.direction.create({ data: { name } })).id])));
const cityNames = ["Екатеринбург", "Челябинск", "Тюмень", "Пермь", "Москва"];
const cities = Object.fromEntries(await Promise.all(cityNames.map(async (name) => [name, (await prisma.city.create({ data: { name } })).id])));
const specialtyNames = ["Кардиология", "Неврология", "Педиатрия", "Эндокринология", "Онкология", "Терапия", "Общая врачебная практика", "Функциональная диагностика", "Ультразвуковая диагностика", "Сестринское дело", "Организация здравоохранения", "Ординатор", "Другая специальность"];
const specialties = await Promise.all(specialtyNames.map((name) => prisma.specialty.create({ data: { name } })));

const speakerData = [
  ["Савельев", "Игорь", "Петрович", "д.м.н., профессор", "Президент региональной ассоциации кардиологов", "Екатеринбург"],
  ["Морозова", "Елена", "Викторовна", "д.м.н., профессор", "Заведующая кафедрой терапии", "Екатеринбург"],
  ["Ким", "Андрей", "Сергеевич", "д.м.н.", "Руководитель отдела артериальной гипертензии", "Москва"],
  ["Белова", "Наталья", "Андреевна", "к.м.н., доцент", "Кафедра неврологии", "Челябинск"],
  ["Волков", "Сергей", "Олегович", "к.м.н.", "Главный врач областной детской больницы", "Тюмень"],
  ["Смирнова", "Ольга", "Игоревна", "к.м.н.", "Врач функциональной диагностики", "Пермь"],
  ["Орлов", "Дмитрий", "Александрович", "д.м.н.", "Руководитель центра эндокринологии", "Екатеринбург"],
  ["Лебедева", "Мария", "Константиновна", "к.м.н.", "Онколог-химиотерапевт", "Екатеринбург"],
  ["Гусев", "Артём", "Валерьевич", null, "Врач-кардиолог, специалист по ЭхоКГ", "Екатеринбург"],
  ["Никитина", "Анна", "Юрьевна", "д.м.н., профессор", "Кафедра педиатрии", "Пермь"],
] as const;
const sp = await Promise.all(
  speakerData.map(([lastName, firstName, middleName, degree, position, city]) =>
    prisma.speaker.create({ data: { lastName, firstName, middleName, degree, position, city, bio: `${degree ?? "Врач"}, ${position.toLowerCase()}.` } }),
  ),
);

const partnerData = [
  ["UralMed", "#2FA38A", 1, true],
  ["NovaPharm", "#0B5ED7", 0, true],
  ["CliniQ", "#9585E6", 2, true],
  ["Helix Bio", "#FF9670", 3, true],
  ["VitaLab", "#2FA38A", 0, true],
  ["MedTech Pro", "#0B5ED7", 1, true],
  ["Doctor Today", "#5B6E83", 3, false],
  ["Remedium", "#5B6E83", 2, false],
] as const;
const partners = [];
for (const [i, [name, color, shape, home]] of partnerData.entries()) {
  const logo = await saveImage(logoSvg(name, color, shape), "logo");
  partners.push(await prisma.partner.create({ data: { name, url: null, logoUrl: logo.url, logoThumbUrl: logo.thumbUrl, showOnHome: home, homeSortOrder: i } }));
}

type EventSeed = {
  title: string;
  slug: string;
  subtitle: string;
  format: EventFormat;
  mode: "OFFLINE" | "ONLINE" | "HYBRID";
  start: number;
  days: number;
  city: string | null;
  dirs: string[];
  nmo: number | null;
  expected: number | null;
  venue?: { name: string; address: string; how?: string; parking?: string; accommodation?: string; lat?: number; lng?: number };
  limit?: number;
  taken?: number;
};

const eventSeeds: EventSeed[] = [
  {
    title: "XII Уральский конгресс кардиологов",
    slug: "uralskiy-kongress-kardiologov-2026",
    subtitle: "Профилактика и лечение сердечно-сосудистых заболеваний: от доказательной медицины к клинической практике",
    format: "CONGRESS",
    mode: "HYBRID",
    start: 21,
    days: 3,
    city: "Екатеринбург",
    dirs: ["Кардиология", "Функциональная диагностика"],
    nmo: 12,
    expected: 1200,
    venue: {
      name: "Конгресс-центр «Екатеринбург-ЭКСПО»",
      address: "Экспо-бульвар, 2",
      how: "От метро «Ботаническая» — бесплатный шаттл каждые 15 минут.\nОт аэропорта Кольцово — 20 минут на такси.",
      parking: "Бесплатная парковка для участников, 2 000 мест",
      accommodation: "Спецтарифы в трёх гостиницах рядом с площадкой — ссылки придут в письме после регистрации",
      lat: 56.7414,
      lng: 60.7973,
    },
    limit: 1500,
    taken: 46,
  },
  {
    title: "Научно-практическая конференция «Неврология сегодня»",
    slug: "nevrologiya-segodnya-2026",
    subtitle: "Инсульт, когнитивные нарушения и реабилитация",
    format: "CONFERENCE",
    mode: "OFFLINE",
    start: 36,
    days: 1,
    city: "Челябинск",
    dirs: ["Неврология"],
    nmo: 6,
    expected: 350,
    venue: { name: "Конференц-зал отеля «Малахит»", address: "ул. Труда, 153" },
    taken: 12,
  },
  {
    title: "Школа ультразвуковой диагностики",
    slug: "shkola-uzi-2026",
    subtitle: "Практический курс на симуляторах для врачей первичного звена",
    format: "SEMINAR",
    mode: "OFFLINE",
    start: 48,
    days: 2,
    city: "Екатеринбург",
    dirs: ["Функциональная диагностика"],
    nmo: 8,
    expected: 40,
    venue: { name: "Симуляционный центр", address: "ул. Репина, 3" },
    limit: 40,
    taken: 31,
  },
  {
    title: "Онлайн-симпозиум «Сахарный диабет 2 типа: новые подходы»",
    slug: "simpozium-diabet-2026",
    subtitle: "Трансляция из студии с интерактивом и контролем присутствия",
    format: "ONLINE_SYMPOSIUM",
    mode: "ONLINE",
    start: 64,
    days: 1,
    city: null,
    dirs: ["Эндокринология", "Терапия"],
    nmo: 4,
    expected: 2000,
  },
  {
    title: "Выставка «МедТехЭкспо Урал»",
    slug: "medtechexpo-ural-2027",
    subtitle: "Медицинское оборудование, расходные материалы и цифровые решения для клиник",
    format: "EXHIBITION",
    mode: "OFFLINE",
    start: 98,
    days: 3,
    city: "Екатеринбург",
    dirs: ["Терапия"],
    nmo: null,
    expected: 5000,
    venue: { name: "МВЦ «Екатеринбург-ЭКСПО»", address: "Экспо-бульвар, 2" },
  },
  {
    title: "Конференция педиатров Урала",
    slug: "konferenciya-pediatrov-2027",
    subtitle: "Актуальные вопросы педиатрии и детской неврологии",
    format: "CONFERENCE",
    mode: "HYBRID",
    start: 125,
    days: 2,
    city: "Пермь",
    dirs: ["Педиатрия", "Неврология"],
    nmo: 10,
    expected: 600,
    venue: { name: "Конгресс-холл «Пермь»", address: "ул. Ленина, 58" },
  },
  {
    title: "Онкологический форум «Новые горизонты»",
    slug: "onkoforum-2026",
    subtitle: "Междисциплинарный подход в лечении онкологических заболеваний",
    format: "CONGRESS",
    mode: "HYBRID",
    start: -40,
    days: 2,
    city: "Екатеринбург",
    dirs: ["Онкология"],
    nmo: 12,
    expected: 800,
    venue: { name: "Конгресс-центр «Атриум»", address: "ул. Куйбышева, 44" },
  },
  {
    title: "Школа детской кардиологии",
    slug: "shkola-detskoy-kardiologii-2026",
    subtitle: "Разбор клинических случаев",
    format: "SEMINAR",
    mode: "OFFLINE",
    start: -95,
    days: 1,
    city: "Тюмень",
    dirs: ["Педиатрия", "Кардиология"],
    nmo: 6,
    expected: 60,
  },
  {
    title: "Симпозиум «Артериальная гипертензия в практике терапевта»",
    slug: "simpozium-ag-2026",
    subtitle: "Онлайн-трансляция и запись докладов",
    format: "ONLINE_SYMPOSIUM",
    mode: "ONLINE",
    start: -160,
    days: 1,
    city: null,
    dirs: ["Кардиология", "Терапия"],
    nmo: 4,
    expected: 3200,
  },
];

const events: Record<string, { id: string; start: Date }> = {};
for (const [i, e] of eventSeeds.entries()) {
  const cover = await saveImage(coverSvg(e.format, i + 3), "cover");
  const startDate = dateOnly(e.start);
  const endDate = dateOnly(e.start + e.days - 1);
  const isFlagship = i === 0;
  const created = await prisma.event.create({
    data: {
      title: e.title,
      slug: e.slug,
      subtitle: e.subtitle,
      format: e.format,
      attendanceMode: e.mode,
      status: "PUBLISHED",
      publishedAt: new Date(),
      startDate,
      endDate,
      cityId: e.city ? cities[e.city] : null,
      directions: { connect: e.dirs.map((d) => ({ id: directions[d]! })) },
      nmoPoints: e.nmo,
      expectedParticipants: e.expected,
      description: `${e.subtitle}.\n\nМероприятие объединяет практикующих врачей, исследователей и организаторов здравоохранения. В программе — пленарные доклады, клинические разборы, дискуссии и мастер-классы.\n\nМероприятие подано на аккредитацию в Координационный совет по развитию непрерывного медицинского образования.`,
      keyFacts: isFlagship
        ? [
            { value: "36", label: "Научных сессий" },
            { value: "3", label: "Параллельных зала" },
            { value: "60", label: "Стендов на выставке" },
          ]
        : [],
      organizers: isFlagship ? "Региональная ассоциация кардиологов\nМинистерство здравоохранения области" : "Media Expo Group",
      venueName: e.venue?.name ?? null,
      venueAddress: e.venue?.address ?? null,
      venueHowToGet: e.venue?.how ?? null,
      venueParking: e.venue?.parking ?? null,
      venueAccommodation: e.venue?.accommodation ?? null,
      venueLat: e.venue?.lat ?? null,
      venueLng: e.venue?.lng ?? null,
      registrationEnabled: e.format !== "EXHIBITION",
      maxParticipants: e.limit ?? null,
      showRegistrationCount: !!e.limit,
      registrationFormats: e.mode === "ONLINE" ? ["ONLINE"] : e.mode === "HYBRID" ? ["OFFLINE", "ONLINE"] : ["OFFLINE"],
      registrationFields: { middleName: true, workplace: true, position: true, mailingConsent: true },
      confirmationText: "Ждём вас! За день до начала пришлём напоминание и ссылку на программу.",
      coverUrl: cover.url,
      coverThumbUrl: cover.thumbUrl,
      archivedAt: e.start < 0 ? new Date() : null,
      tariffs: {
        create: isFlagship
          ? [
              { sortOrder: 0, name: "Онлайн-участник", audience: "Врачи и ординаторы из любого города", price: 0, includes: "Трансляция всех залов\nБаллы НМО при контроле присутствия\nЗаписи докладов на 30 дней" },
              { sortOrder: 1, name: "Очный делегат", audience: "Врачи, ординаторы, медсёстры", price: 0, includes: "Все залы и секции\n12 баллов НМО\nПортфель делегата и сертификат\nПосещение выставки" },
              { sortOrder: 2, name: "Экспонент", audience: "Фармкомпании и производители медтехники", price: 180000, includes: "Стенд от 6 м²\nСателлитный симпозиум\nЛоготип на сайте и в программе\nОтчёт по посетителям" },
            ]
          : e.format === "SEMINAR"
            ? [{ sortOrder: 0, name: "Участник курса", audience: "Врачи первичного звена", price: 15000, includes: "Два дня практики на симуляторах\nМетодические материалы\nСертификат и баллы НМО" }]
            : [],
      },
    },
  });
  events[e.slug] = { id: created.id, start: startDate };

  const taken = e.taken ?? 0;
  for (let n = 0; n < taken; n++) {
    await prisma.registration.create({
      data: {
        eventId: created.id,
        lastName: ["Иванова", "Петров", "Сидорова", "Кузнецов", "Попова", "Соколов"][n % 6]!,
        firstName: ["Анна", "Иван", "Мария", "Олег", "Елена", "Павел"][n % 6]!,
        email: `demo${n}.${i}@example.com`,
        phone: `+7900${String(1000000 + n * 37 + i).slice(-7)}`,
        specialtyId: specialties[n % specialties.length]!.id,
        specialtyName: specialties[n % specialties.length]!.name,
        city: cityNames[n % cityNames.length]!,
        format: e.mode === "ONLINE" ? "ONLINE" : n % 3 ? "OFFLINE" : e.mode === "HYBRID" ? "ONLINE" : "OFFLINE",
        consentPersonalData: true,
        consentAt: new Date(),
        status: n % 5 === 0 ? "CONFIRMED" : "NEW",
      },
    });
  }
}

const flagship = events["uralskiy-kongress-kardiologov-2026"]!;
const halls = await Promise.all(["Пленарный зал", "Зал А", "Зал Б"].map((name, i) => prisma.hall.create({ data: { eventId: flagship.id, name, sortOrder: i } })));
const prog: [number, { k?: "BREAK"; s: string; e: string; t: string; d?: string; h?: number; nmo?: boolean; mods?: number[]; sps?: number[] }[]][] = [
  [
    0,
    [
      { k: "BREAK", s: "08:00", e: "09:30", t: "Регистрация участников, открытие выставки, приветственный кофе" },
      { s: "09:30", e: "11:00", t: "Торжественное открытие. Пленарное заседание", d: "Кардиология 2026: итоги года, новые клинические рекомендации и региональные приоритеты.", h: 0, nmo: true, mods: [0, 1], sps: [2] },
      { s: "11:30", e: "13:00", t: "Артериальная гипертензия: персонализированный подход", d: "Комбинированная терапия, резистентная АГ, клинические случаи.", h: 1, nmo: true, mods: [2], sps: [8] },
      { s: "11:30", e: "13:00", t: "Сателлитный симпозиум: антикоагулянтная терапия при фибрилляции предсердий", d: "Проводится при поддержке компании-партнёра. Не обеспечивается баллами НМО.", h: 2, sps: [6] },
      { k: "BREAK", s: "13:00", e: "14:00", t: "Обед · посещение выставки" },
      { s: "14:00", e: "15:30", t: "Хроническая сердечная недостаточность: от диагностики к реабилитации", h: 0, nmo: true, mods: [1], sps: [3, 4] },
      { s: "16:00", e: "17:30", t: "Мастер-класс: эхокардиография для практикующего врача", d: "Практическое занятие на симуляторах. Количество мест ограничено.", h: 1, sps: [5, 8] },
    ],
  ],
  [
    1,
    [
      { s: "09:30", e: "11:00", t: "Нарушения ритма сердца в амбулаторной практике", h: 0, nmo: true, mods: [2], sps: [8] },
      { s: "09:30", e: "11:00", t: "Кардиоонкология: совместное ведение пациентов", h: 1, nmo: true, sps: [7, 0] },
      { k: "BREAK", s: "11:00", e: "11:30", t: "Кофе-брейк" },
      { s: "11:30", e: "13:00", t: "Сердце и диабет: что важно знать кардиологу", h: 0, nmo: true, sps: [6] },
      { s: "14:00", e: "15:30", t: "Клинические разборы молодых специалистов", d: "Конкурс клинических случаев. Победители получат грант на участие в конгрессе 2027 года.", h: 2, mods: [1] },
    ],
  ],
  [
    2,
    [
      { s: "10:00", e: "11:30", t: "Детская кардиология: от скрининга до хирургии", h: 0, nmo: true, sps: [9, 4] },
      { s: "12:00", e: "13:00", t: "Закрытие конгресса. Подведение итогов", h: 0, mods: [0] },
    ],
  ],
];
for (const [offset, sessions] of prog) {
  const day = await prisma.programDay.create({ data: { eventId: flagship.id, date: new Date(flagship.start.getTime() + offset * DAY) } });
  for (const [order, s] of sessions.entries()) {
    await prisma.programSession.create({
      data: {
        dayId: day.id,
        kind: s.k ?? "SESSION",
        startTime: s.s,
        endTime: s.e,
        title: s.t,
        description: s.d ?? null,
        hallId: s.h !== undefined ? halls[s.h]!.id : null,
        nmo: !!s.nmo,
        sortOrder: order,
        speakers: {
          create: [
            ...(s.mods ?? []).map((m, n) => ({ speakerId: sp[m]!.id, role: "MODERATOR" as const, sortOrder: n })),
            ...(s.sps ?? []).map((m, n) => ({ speakerId: sp[m]!.id, role: "SPEAKER" as const, sortOrder: 10 + n })),
          ],
        },
      },
    });
  }
}
await prisma.eventSpeaker.createMany({
  data: [0, 1, 2, 3, 4, 5, 6, 8].map((n, i) => ({ eventId: flagship.id, speakerId: sp[n]!.id, role: i === 0 ? "CHAIR" : i === 1 ? "CO_CHAIR" : i === 2 ? "COMMITTEE" : "SPEAKER", sortOrder: i })),
});
await prisma.eventSpeaker.createMany({ data: [3, 5].map((n, i) => ({ eventId: events["nevrologiya-segodnya-2026"]!.id, speakerId: sp[n]!.id, role: i === 0 ? "CHAIR" : "SPEAKER", sortOrder: i })) });
await prisma.eventSpeaker.createMany({ data: [7, 1].map((n, i) => ({ eventId: events["onkoforum-2026"]!.id, speakerId: sp[n]!.id, role: i === 0 ? "CHAIR" : "SPEAKER", sortOrder: i })) });
await prisma.eventPartner.createMany({
  data: [
    { eventId: flagship.id, partnerId: partners[0]!.id, level: "GENERAL", sortOrder: 0 },
    { eventId: flagship.id, partnerId: partners[1]!.id, level: "OFFICIAL", sortOrder: 0 },
    { eventId: flagship.id, partnerId: partners[2]!.id, level: "OFFICIAL", sortOrder: 1 },
    { eventId: flagship.id, partnerId: partners[3]!.id, level: "OFFICIAL", sortOrder: 2 },
    { eventId: flagship.id, partnerId: partners[5]!.id, level: "OFFICIAL", sortOrder: 3 },
    { eventId: flagship.id, partnerId: partners[6]!.id, level: "INFO", sortOrder: 0 },
    { eventId: flagship.id, partnerId: partners[7]!.id, level: "INFO", sortOrder: 1 },
  ],
});
await saveDoc("Научная программа конгресса", { eventId: flagship.id, eventSortOrder: 0 });
await saveDoc("Информационное письмо", { eventId: flagship.id, eventSortOrder: 1 });
await saveDoc("Порядок получения баллов НМО", { eventId: flagship.id, eventSortOrder: 2 });
await saveDoc("Условия участия для экспонентов", { eventId: flagship.id, eventSortOrder: 3 });

const onko = events["onkoforum-2026"]!;
const gallery = [];
for (let i = 0; i < 6; i++) gallery.push(await saveImage(coverSvg(i % 2 ? "CONGRESS" : "CONFERENCE", 40 + i), "gallery"));
await prisma.event.update({
  where: { id: onko.id },
  data: {
    resultsText: "Форум собрал онкологов, хирургов, радиологов и химиотерапевтов из 14 регионов. Участники обсудили междисциплинарные подходы, новые схемы терапии и организацию маршрутизации пациентов.\n\nСпасибо всем спикерам и участникам! Материалы докладов доступны ниже.",
    resultsFacts: [
      { value: "820", label: "участников" },
      { value: "14", label: "регионов" },
      { value: "38", label: "докладов" },
      { value: "12", label: "баллов НМО" },
    ],
    resultsLinks: [{ title: "Видеозапись пленарного заседания", url: "https://vk.com/video" }],
    images: { create: gallery.map((g, i) => ({ url: g.url, thumbUrl: g.thumbUrl, caption: i === 0 ? "Пленарное заседание" : null, sortOrder: i })) },
  },
});
await saveDoc("Презентации пленарного заседания", { eventId: onko.id, eventSection: "RESULTS", eventSortOrder: 0 });

const newsSeeds = [
  { title: "Открыта регистрация на XII Уральский конгресс кардиологов", slug: "registraciya-kongress-kardiologov", excerpt: "Участие для врачей бесплатное, начисляются 12 баллов НМО.", event: flagship.id, ago: 3 },
  { title: "Итоги онкологического форума «Новые горизонты»", slug: "itogi-onkoforuma", excerpt: "820 участников из 14 регионов, 38 докладов и новые форматы клинических разборов.", event: onko.id, ago: 30 },
  { title: "Школа ультразвуковой диагностики: осталось 9 мест", slug: "shkola-uzi-mesta", excerpt: "Практический курс на симуляторах — успейте зарегистрироваться.", event: events["shkola-uzi-2026"]!.id, ago: 8 },
  { title: "Как получить баллы НМО за онлайн-участие", slug: "bally-nmo-online", excerpt: "Рассказываем, как работает контроль присутствия на трансляциях.", event: null, ago: 14 },
  { title: "Принимаем тезисы на конференцию «Неврология сегодня»", slug: "tezisy-nevrologiya", excerpt: "Приём тезисов открыт до конца месяца.", event: events["nevrologiya-segodnya-2026"]!.id, ago: 20 },
];
for (const [i, n] of newsSeeds.entries()) {
  const cover = await saveImage(coverSvg((["CONGRESS", "CONFERENCE", "SEMINAR", "ONLINE_SYMPOSIUM", "EXHIBITION"] as EventFormat[])[i]!, 70 + i), "cover");
  await prisma.news.create({
    data: {
      title: n.title,
      slug: n.slug,
      excerpt: n.excerpt,
      body: `<p>${n.excerpt}</p><h2>Что нужно знать</h2><ul><li>Регистрация проходит на сайте и занимает пару минут.</li><li>После регистрации на e-mail придёт письмо с подтверждением.</li><li>Программа и документы доступны на странице мероприятия.</li></ul><blockquote>Мы стараемся сделать каждое мероприятие удобным для врачей — от регистрации до получения сертификата.</blockquote><p>По всем вопросам пишите на <a href="mailto:info@med-expo.org">info@med-expo.org</a>.</p>`,
      coverUrl: cover.url,
      coverThumbUrl: cover.thumbUrl,
      eventId: n.event,
      status: "PUBLISHED",
      publishAt: new Date(Date.now() - n.ago * DAY),
    },
  });
}

await prisma.siteSetting.create({
  data: {
    key: "site",
    value: {
      contacts: {
        headerPhone: "+7 (343) 200-10-20",
        phones: [
          { label: "Отдел регистрации", number: "+7 (343) 200-10-21" },
          { label: "Для экспонентов и партнёров", number: "+7 (343) 200-10-22" },
        ],
        emails: [
          { label: "Общие вопросы", email: "info@med-expo.org" },
          { label: "Регистрация участников", email: "reg@med-expo.org" },
        ],
        address: "Екатеринбург, ул. Малышева, 51, офис 1201",
        workHours: "Пн–Пт 9:00–18:00",
        requisites: "ООО «МедиаЭкспоГрупп»\nИНН 0000000000 · КПП 000000000\nОГРН 0000000000000\nЮридический адрес: г. Екатеринбург",
        mapLat: 56.8352,
        mapLng: 60.6156,
        socials: { vk: "https://vk.com/", telegram: "https://t.me/", youtube: null },
      },
      numbers: [
        { value: "15+", label: "лет организуем мероприятия" },
        { value: "300+", label: "проведённых мероприятий" },
        { value: "50 000", label: "участников" },
        { value: "1 200", label: "врачей-спикеров" },
      ],
      notifications: { onRegistration: false, emails: [] },
    },
  },
});

await prisma.page.createMany({
  data: [
    {
      key: "home",
      title: "Главная",
      blocks: {
        heroTitle: "Организация медицинских конгрессов и конференций",
        heroSubtitle: "Берём на себя всю организацию — от научной программы до регистрации участников, чтобы врачи могли сосредоточиться на знаниях и общении.",
        heroButtonText: "Ближайшие мероприятия",
      },
    },
    {
      key: "about",
      title: "О компании",
      path: "/about",
      body: "Media Expo Group организует медицинские конгрессы, научно-практические конференции, обучающие семинары и выставки медицинской техники на Урале и по всей России.\n\nМы работаем с профессиональными ассоциациями, клиниками и фармацевтическими компаниями: готовим научную программу, приглашаем спикеров, подаём документы на аккредитацию НМО, берём на себя площадку, технику, регистрацию и проживание участников.\n\nДля нас важно, чтобы каждому участнику было удобно: от понятной регистрации до вовремя пришедшего сертификата.",
      blocks: {
        team: [
          { name: "Анна Соколова", position: "Директор", photoUrl: null, photoThumbUrl: null },
          { name: "Павел Ершов", position: "Руководитель проектов", photoUrl: null, photoThumbUrl: null },
          { name: "Марина Ковалёва", position: "Менеджер по работе с партнёрами", photoUrl: null, photoThumbUrl: null },
          { name: "Ирина Белых", position: "Отдел регистрации участников", photoUrl: null, photoThumbUrl: null },
        ],
        reviews: [
          { quote: "Безупречная организация конгресса на тысячу участников: научная программа, регистрация и баллы НМО — всё без сбоев.", name: "Игорь Савельев", position: "д.м.н., президент ассоциации кардиологов", photoUrl: null, photoThumbUrl: null },
          { quote: "Работаем уже несколько лет. Ценю точность, соблюдение сроков и внимание к каждому спикеру.", name: "Елена Морозова", position: "Заведующая кафедрой терапии", photoUrl: null, photoThumbUrl: null },
          { quote: "Онлайн-симпозиум собрал врачей из десятков городов. Удобная трансляция и подробная аналитика.", name: "Мария Лебедева", position: "Медицинский директор, фармкомпания", photoUrl: null, photoThumbUrl: null },
        ],
      },
    },
    { key: "contacts", title: "Контакты", path: "/contacts", body: "Звоните, пишите или приходите в офис — обсудим ваше мероприятие." },
    { key: "events", title: "Мероприятия", body: "Медицинские конгрессы, научные конференции, обучающие семинары, выставки медтехники и онлайн-симпозиумы с регистрацией на сайте." },
    { key: "news", title: "Новости", body: "Анонсы, итоги мероприятий и полезные материалы для врачей." },
    { key: "privacy", title: "Политика конфиденциальности", path: "/privacy", body: "Демо-текст. Здесь будет политика обработки персональных данных ООО «МедиаЭкспоГрупп», утверждённая юристом компании." },
    { key: "consent", title: "Согласие на обработку персональных данных", path: "/consent", body: "Демо-текст. Здесь будет текст согласия на обработку персональных данных." },
    { key: "sveden", title: "Сведения об образовательной организации", body: "Раздел содержит сведения об ООО «МедиаЭкспоГрупп» в соответствии с требованиями Рособрнадзора." },
    { key: "sveden-common", title: "Основные сведения", body: "Полное наименование: Общество с ограниченной ответственностью «МедиаЭкспоГрупп».\n\nДата создания, учредители, место нахождения, режим и график работы, контактные телефоны и адреса электронной почты — демо-раздел, заполняется заказчиком." },
  ],
});
await saveDoc("Устав", { svedenSection: "document", sectionSortOrder: 0 });
await saveDoc("Лицензия на осуществление образовательной деятельности", { svedenSection: "document", sectionSortOrder: 1 });
await saveDoc("Положение о порядке оказания платных образовательных услуг", { svedenSection: "paid_edu", sectionSortOrder: 0 });

await prisma.contactRequest.create({
  data: { name: "Ольга Демина", organization: "Областная клиническая больница", phone: "+79001112233", comment: "Хотим провести конференцию на 200 человек весной", source: "Главная", consentAt: new Date() },
});

console.log("Готово: мероприятия, программа, спикеры, новости, партнёры, страницы и настройки");
await prisma.$disconnect();
