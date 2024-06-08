import express from "express";
import bot from "./bot.js"; // Ensure this exports a configured Telegraf instance
import "dotenv/config";
import router from "./routes/routes.js";

const app = express();
const port = process.env.PORT || 3000;
const webhook = `https://youtube-project-eu93.vercel.app`;

// Middleware
app.use(express.json());
app.use("/", router);

// Handle incoming updates from Telegram
app.post("/telegraf/:id", (req, res) => {
  bot.handleUpdate(req.body);
  res.send("message received").status(200);
});

// Set up webhook
async function setup() {
  try {
    await bot.createWebhook({
      domain: webhook,
    });
    console.log("Webhook set up successfully");
  } catch (error) {
    console.error("Error setting up webhook:", error);
  }
}

// Start the Express server
await setup();
app.listen(port, async () => {
  console.log(`Server is running on port ${port}`);
});
