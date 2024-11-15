import { Telegraf } from "telegraf";
import "dotenv/config";
import { cleanUpAudioFiles, startLivestream, stopLivestream } from "./handlers/Livestream.js";
import Firebase from "./handlers/Firebase.js";
import uploadAudio from "./handlers/Audiodl.js";
import { message } from "telegraf/filters";

const bot = new Telegraf(process.env.TOKEN);

let streamTimer = null; // Store the timer ID for stopping the stream

bot.start((ctx) => ctx.reply("Welcome"));

bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text;
  if (isValidUrl(text) && text.includes("youtu")) {
    try {
      await downloadAndUploadYouTubeVideo(ctx, text);
      ctx.reply("Video downloaded and uploaded to Firebase!");
    } catch (error) {
      console.error("Error in downloading or uploading video:", error);
      ctx.reply("An error occurred while processing the video.");
    }
  } else if (text === "hi") {
    ctx.reply("hi too");
  } else if (text === "stream") {
    await startStreamWithInterval(ctx);
  } else if (text === "stop") {
    stopLivestream(ctx);
    clearInterval(streamTimer); // Clear the interval when manually stopping
  }
  else if (text === "clean") {
    cleanUpAudioFiles();
  }  else if (text === "auth") {
    const id = ctx.from.id;
    ctx.reply(`${process.env.BASE_URL}/auth?id=${id}`);
  } else if (text === "token") {
    const user = ctx.from.id.toString();
    console.log(user);
    try {
      const userd = await fetch("https://super-garbanzo-6w645q74gqr26vq-3000.app.github.dev/details", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: user }),
      });
      const userDetails = await userd.json();
      const token = userDetails.tokens.access_token;
      ctx.reply(token);
    } catch (error) {
      console.error("Error fetching token:", error);
      ctx.reply("An error occurred while fetching the token.");
    }
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

// Start stream and set a timer for 1 hour
async function startStreamWithInterval(ctx) {
  // Start the stream immediately
  await startLivestream(ctx);

  // Set a timeout to stop the stream after 1 hour (60 minutes = 3600000ms)
  streamTimer = setTimeout(async () => {
    await stopLivestream(ctx);
    console.log("Stream stopped after 1 hour.");

    // Automatically start the stream again after it stops
    await startLivestream(ctx);
    console.log("Stream restarted after 1 hour.");

  }, 3600000); // 1 hour
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

bot.on("audio", async (ctx) => {
  try {
    const file_id = ctx.message.audio.file_id;
    await uploadAudio(ctx, file_id);
  } catch (error) {
    console.error("Error in bot handler:", error);
    ctx.reply("An error occurred while uploading the audio.");
  }
});

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

export default bot;
