import { config } from "./config.js";
import { createApp } from "./app.js";

createApp().listen(config.PORT, () => {
  console.log(`API запущен: http://localhost:${config.PORT}/api`);
});
