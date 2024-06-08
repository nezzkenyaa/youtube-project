import express from "express";
import bot from "./bot.js"; // Ensure this exports a configured Telegraf instance
import "dotenv/config";
import router from "./routes/routes.js";
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use("/", router);

bot.telegram
  .setWebhook("https://youtube-project-eu93.vercel.app/telegram-webhook")
  .then(() => {
    console.log("Webhook set successfully");
  })
  .catch((error) => {
    console.error("Error setting webhook", error);
  });


app.listen(port, () => console.log("Listening on port", port));
