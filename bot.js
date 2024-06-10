import { Telegraf } from "telegraf";
import "dotenv/config";
import uploadVideo from "./upload.js";
import liveStreamVideo from "./Livestream.js";
const bot = new Telegraf(process.env.TOKEN);

bot.start((ctx) => ctx.reply("Welcome"));
bot.hears("hi", (ctx) => {
  ctx.reply("hi too");
});
bot.help((ctx) => ctx.reply("Send me a sticker"));
bot.hears("token", async (ctx) => {
  const user = ctx.from.id.toString();
  console.log(user);
  const userd = await fetch("https://super-garbanzo-6w645q74gqr26vq-3000.app.github.dev/details", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: user,
    }),
  });
  const userDetails = await userd.json();
  const token = userDetails.tokens.access_token;
  ctx.reply(token);
});

bot.on("video", async (ctx) => {
  try {
    const file_id = ctx.message.video.file_id;
    await liveStreamVideo(ctx, file_id);
  } catch (error) {
    console.error("Error in bot handler:", error);
    ctx.reply("An error occurred while uploading the video.");
  }
});

bot.hears("auth", (ctx) => {
  const id = ctx.from.id;
  ctx.reply(`https://super-garbanzo-6w645q74gqr26vq-3000.app.github.dev/auth?id=${id}`);
});

// Function to validate URLs
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

export default bot;
