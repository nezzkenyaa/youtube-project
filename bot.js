import { Telegraf } from "telegraf";
import "dotenv/config";
import { startLivestream, stopLivestream } from "./handlers/Livestream.js";
import { message } from "telegraf/filters";

const bot = new Telegraf(process.env.TOKEN);

bot.start((ctx) => ctx.reply("Welcome"));

bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  if (text === "hi") {
    ctx.reply("hi too");
  } else if (text === "stream") {
    startLivestream(ctx);
  } else if (text === "stop") {
    stopLivestream(ctx);
  } else if (text === "auth") {
    const id = ctx.from.id;
    ctx.reply(`${process.env.BASE_URL}/auth?id=${id}`);
  }
});



// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

export default bot;
