import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import getRandomDocument from "./Randomdoc.js";
import path from "path";
import { fileURLToPath } from 'url';

// Set the path to the precompiled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

// Store the reference to the ffmpeg process globally
let ffmpegProcess = null;
let isStreaming = false;

// Replace this with your YouTube stream URL
const youtubeStreamUrl = process.env.S_URL;

// Path to the video file in the root path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const videoPath = path.resolve(__dirname, "t.mp4");

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

    const audioDuration = await getVideoDuration(randomDoc.Url);
    const videoDuration = await getVideoDuration(videoPath);

    if (!audioDuration || !videoDuration) {
      throw new Error("Failed to get video or audio duration.");
    }

    isStreaming = true;

    // Set up ffmpeg command with the desired bitrates and options
    ffmpegProcess = ffmpeg()
      .input(videoPath)
      .inputOptions([
        "-stream_loop -1", // Loop the video infinitely
        "-re" // Read input at native frame rate for live streaming
      ])
      .input(randomDoc.Url)
      .inputOptions([
        "-re" // Read input at native frame rate for live streaming
      ])
      .outputOptions([
        "-map 0:v:0", // Use the video stream from the first input
        "-map 1:a:0", // Use the audio stream from the second input
        "-c:v libx264",  // Video codec
        "-b:v 6800k", 
        "-c:a aac",      // Audio codec
        "-b:a 128k",     // Audio bitrate
        "-strict -2",    // Needed for some ffmpeg builds
        "-f flv",        // Output format
        "-flush_packets 0", // Ensure no packet is dropped during streaming
        "-shortest" // Ensure the output ends when the shortest input ends
      ])
      .videoFilter({
        filter: "drawtext",
        options: {
          fontfile: "../Righteous-Regular.ttf", // Path to a font file
          text: randomDoc.Name,
          fontsize: 24,
          fontcolor: "white",
          x: "(w-text_w)/2",
          y: "h-40"
        }
      })
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

        startLivestream(ctx);
      })
      .output(youtubeStreamUrl)
      .run();

  } catch (error) {
    ctx.reply("An error occurred while setting up the stream.");
    console.error("Error in startLivestream function: ", error.message);
    isStreaming = false; // Reset streaming status on error
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
