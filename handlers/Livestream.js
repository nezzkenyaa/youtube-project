import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import getRandomDocument from "./Randomdoc.js";

// Set the path to the precompiled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);

// Replace this with your YouTube stream URL
const youtubeStreamUrl = process.env.S_URL;

// Function to start live streaming
async function Livestream(ctx) {
  while (true) {
    try {
      // Fetch the random document URL
      const randomDoc = await getRandomDocument();
      if (!randomDoc) {
        throw new Error("No documents found in the collection.");
      }
      const videoUrl = randomDoc.Url;

      // Ensure videoUrl is valid
      if (!videoUrl) {
        throw new Error("Invalid video URL received from getRandomDocument");
      }

      // Set up ffmpeg command with the desired bitrates
      await new Promise((resolve, reject) => {
        const ffmpegProcess = ffmpeg(videoUrl)
          .outputOptions([
            "-c:v libx264",  // Video bitrate
            "-c:a aac",     // Audio codec
            "-b:a 128k",    // Audio bitrate
            "-strict -2",   // Needed for some ffmpeg builds
            "-f flv",       // Output format
          ])
          .on("start", function (commandLine) {
            ctx.reply("Stream starting...");
            ctx.reply(`Streaming: ${randomDoc.Name}`);
            console.log("Spawned FFmpeg with command: " + commandLine);
          })
          .on("error", function (err, stdout, stderr) {
            ctx.reply("An error occurred during streaming.");
            console.error("Error: " + err.message);
            console.error("ffmpeg stderr: " + stderr);
            ffmpegProcess.kill('SIGKILL'); // Ensure the process is killed
            reject(err);
          })
          .on("end", function () {
            ctx.reply("Streaming finished! Fetching new URL...");
            console.log("Streaming finished!");
            resolve();
          })
          .output(youtubeStreamUrl)
          .run();
      });

    } catch (error) {
      ctx.reply("An error occurred while setting up the stream.");
      console.error("Error in Livestream function: ", error.message);
      // Optionally add a delay before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

export default Livestream;
