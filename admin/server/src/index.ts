import { config } from "./config.js";
import { createApp } from "./app.js";
import { purgeExpiredEvents } from "./routes/events.js";

createApp().listen(config.PORT, () => {
  console.log(`API запущен: http://localhost:${config.PORT}/api`);
});

const purge = () => purgeExpiredEvents().catch((e) => console.error("Ошибка очистки корзины:", e));
purge();
setInterval(purge, 6 * 60 * 60 * 1000).unref();
