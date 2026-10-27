import { config } from "./config.js";
import { createApp } from "./app.js";
import { purgeExpiredEvents } from "./routes/events.js";
import { purgeExpiredNews } from "./routes/news.js";

createApp().listen(config.PORT, () => {
  console.log(`API запущен: http://localhost:${config.PORT}/api`);
});

const purge = () =>
  Promise.all([purgeExpiredEvents(), purgeExpiredNews()]).catch((e) => console.error("Ошибка очистки корзины:", e));
purge();
setInterval(purge, 6 * 60 * 60 * 1000).unref();
