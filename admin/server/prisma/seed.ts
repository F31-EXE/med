import "dotenv/config";
import "../src/lib/dbEnv.js";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const email = (process.env.SEED_ADMIN_EMAIL || "admin@med-expo.org").trim().toLowerCase();
const password = process.env.SEED_ADMIN_PASSWORD;
const name = process.env.SEED_ADMIN_NAME?.trim() || "Администратор";

if (!email || !password || password.length < 8) {
  console.error("Задайте SEED_ADMIN_EMAIL и SEED_ADMIN_PASSWORD (не короче 8 символов) в .env");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

const existing = await prisma.user.findUnique({ where: { email } });

if (existing) {
  console.log(`Пользователь ${email} уже существует, пропускаю`);
} else {
  await prisma.user.create({
    data: { email, name, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Создан администратор ${email}`);
}

await prisma.$disconnect();
