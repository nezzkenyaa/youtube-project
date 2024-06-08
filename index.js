import express from "express";
import bot from "./bot.js"; // Ensure this exports a configured Telegraf instance
import "dotenv/config";
import router from "./routes/routes.js";
import { Context } from "telegraf";

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use("/", router);

app.post("/telegram-webhook", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

// Set the bot API endpoint
bot.telegram
  .setWebhook("https://077d-154-159-237-111.ngrok-free.app/telegram-webhook")
  .then(() => {
    console.log("Webhook set successfully");
  })
  .catch((error) => {
    console.error("Error setting webhook", error);
  });

bot.on("text", (ctx) => {
  const message = ctx.message;
  if (message && message.reply_to_message && message.reply_to_message.video) {
    const fileId = message.reply_to_message.video.file_id;
    console.log("Video File ID:", fileId);
    ctx.reply(`The video file ID is: ${fileId}`);
  } else {
    ctx.reply("Please reply to a message containing a video to get its ID.");
  }
});

app.listen(port, () => console.log("Listening on port", port));
