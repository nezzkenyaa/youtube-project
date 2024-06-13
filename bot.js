import { Telegraf } from "telegraf";
import "dotenv/config";
import uploadVideo from "./handlers/upload.js";
import { startLivestream, stopLivestream } from "./handlers/Livestream.js";
import Firebase from "./handlers/Firebase.js";
import downloadAndUploadYouTubeVideo from "./handlers/Ytdl.js";
const bot = new Telegraf(process.env.TOKEN);

bot.start((ctx) => ctx.reply("Welcome"));
bot.on("message", async (ctx) => {
  const text = ctx.message.text;
  if (isValidUrl(text) && text.includes("youtu")) {
    try {
      await downloadAndUploadYouTubeVideo(ctx, text);
      ctx.reply("Video downloaded and uploaded to Firebase!");
    } catch (error) {
      console.error("Error in downloading or uploading video:", error);
      ctx.reply("An error occurred while processing the video.");
    }
  }else if(text==="hi"){
ctx.reply("hi too")
  }else if(text === "stream"){
startLivestream(ctx)
  }else if(text === "stop"){
    stopLivestream(ctx)
  }else if(text==="auth"){
    const id = ctx.from.id;
    ctx.reply(`${process.env.BASE_URL}/auth?id=${id}`);
  }else if(text==="token"){
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
  }
});

function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

bot.on("video", async (ctx) => {
  try {
    const file_id = ctx.message.video.file_id;
    await Firebase(ctx, file_id);
  } catch (error) {
    console.error("Error in bot handler:", error);
    ctx.reply("An error occurred while uploading the video.");
  }
});


// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

export default bot;
