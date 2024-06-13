import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import getRandomDocument from "./Randomdoc.js";

// Set the path to the precompiled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

// Store the reference to the ffmpeg process globally
let ffmpegProcess = null;
let isStreaming = false;

// Replace this with your YouTube stream URL
const youtubeStreamUrl = process.env.S_URL;

// Function to get the duration of the video
async function getVideoDuration(url) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(url, (err, metadata) => {
      if (err) {
        reject(err);
      } else {
        const duration = metadata.format.duration;
        resolve(duration);
      }
    });
  });
}

// Function to start live streaming
async function startLivestream(ctx) {
  if (isStreaming) {
    ctx.reply("A stream is already running. Please wait for it to finish.");
    return;
  }

  try {
    // Fetch the random document URL
    const randomDoc = await getRandomDocument();
    if (!randomDoc || !randomDoc.Url) {
      throw new Error("No valid document URL found in the collection.");
    }

    const duration = await getVideoDuration(randomDoc.Url);
    if (!duration) {
      throw new Error("Failed to get video duration.");
    }

    isStreaming = true;

    // Set up ffmpeg command with the desired bitrates and options
    ffmpegProcess = ffmpeg(randomDoc.Url)
      .inputOptions([
        "-re" // Read input at native frame rate for live streaming
      ])
      .outputOptions([
        "-c:v libx264",  // Video codec
        "-b:v 750k", 
        "-c:a aac",      // Audio codec
        "-b:a 128k",     // Audio bitrate
        "-strict -2",    // Needed for some ffmpeg builds
        "-f flv",        // Output format
        "-flush_packets 0" // Ensure no packet is dropped during streaming
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
        isStreaming = false; // Reset streaming status on error
      })
      .on("end", async function () {
        ctx.reply("Streaming finished! Fetching new URL...");
        console.log("Streaming finished!");

        // Ensure the ffmpeg process is terminated
        ffmpegProcess = null;

        // Reset streaming status immediately after completion
        isStreaming = false;

        // Wait for a short delay before starting a new stream
        await new Promise(resolve => setTimeout(resolve, 5000));
        startLivestream(ctx);
      })
      .output(youtubeStreamUrl)
      .run();

  } catch (error) {
    ctx.reply("An error occurred while setting up the stream.");
    console.error("Error in startLivestream function: ", error.message);
    isStreaming = false; // Reset streaming status on error
    // Optionally add a delay before retrying
    await new Promise(resolve => setTimeout(resolve, 5000));
    startLivestream(ctx); // Retry streaming after delay
  }
}

// Function to stop the stream
function stopLivestream(ctx) {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM'); // Use SIGTERM for a graceful shutdown
    ctx.reply("Stream stopped successfully.");
    console.log("Stream stopped successfully.");
    isStreaming = false; // Reset streaming status on stop
  } else {
    ctx.reply("No active stream to stop.");
    console.log("No active stream to stop.");
  }
}

export { startLivestream, stopLivestream };
