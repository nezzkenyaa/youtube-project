import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import getRandomDocument from "./Randomdoc.js"; // Adjust path as per your project structure
import path from "path";
import { fileURLToPath } from 'url';
import fs from 'fs';

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
const videoPath = path.resolve(__dirname, "output.mp4"); // Output video file path

// Function to get the duration of a video
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

// Function to concatenate multiple audio files into a single video
async function createVideoFromSongs(songUrls) {
  return new Promise((resolve, reject) => {
    let ffmpegCommand = ffmpeg();

    // Add each song as an input
    songUrls.forEach((songUrl) => {
      ffmpegCommand.input(songUrl).inputOptions(["-re"]); // Read input at native frame rate for live streaming
    });

    ffmpegCommand
      .inputOptions([
        "-f concat", // Format for concatenating inputs
        "-safe 0"    // Allow unsafe filenames
      ])
      .outputOptions([
        "-c:v libx264",  // Video codec
        "-b:v 6800k",    // Video bitrate
        "-c:a aac",      // Audio codec
        "-b:a 128k",     // Audio bitrate
        "-strict -2",    // Needed for some ffmpeg builds
        "-f mp4"         // Output format
      ])
      .output(videoPath)
      .on("end", function () {
        console.log("Video concatenation finished.");
        resolve(videoPath);
      })
      .on("error", function (err, stdout, stderr) {
        console.error("Error concatenating videos:", err.message);
        reject(err);
      })
      .run();
  });
}

// Function to start live streaming
async function startLivestream(ctx) {
  if (isStreaming) {
    ctx.reply("A stream is already running. Please wait for it to finish.");
    return;
  }

  try {
    // Fetch 10 random documents (songs)
    const randomDocs = await Promise.all(Array.from({ length: 10 }, () => getRandomDocument()));
    const songUrls = randomDocs.map(doc => doc.url);

    // Create a video from the fetched songs
    const videoFilePath = await createVideoFromSongs(songUrls);

    // Get the duration of the created video
    const videoDuration = await getVideoDuration(videoFilePath);

    if (!videoDuration) {
      throw new Error("Failed to get video duration.");
    }

    isStreaming = true;

    // Set up ffmpeg command to stream the created video
    ffmpegProcess = ffmpeg()
      .input(videoFilePath)
      .inputOptions([
        "-re" // Read input at native frame rate for live streaming
      ])
      .outputOptions([
        "-c:v libx264",  // Video codec
        "-b:v 6800k",    // Video bitrate
        "-c:a aac",      // Audio codec
        "-b:a 128k",     // Audio bitrate
        "-strict -2",    // Needed for some ffmpeg builds
        "-f flv",        // Output format
        "-flush_packets 0", // Ensure no packet is dropped during streaming
        "-shortest"      // Ensure the output ends when the shortest input ends
      ])
      .videoFilter({
        filter: "drawtext",
        options: {
          fontfile: path.resolve(__dirname, "../Righteous-Regular.ttf"), // Path to your font file
          text: "Custom text overlay", // Customize as needed
          fontsize: 46, // Font size
          fontcolor: "white",
          x: "(w-text_w)/2", // Center horizontally based on the width of each line of text
          y: "h-th-20", // Position vertically 40 pixels from the bottom (adjust as needed)
          line_spacing: 12 // Line spacing
        }
      })
      .on("start", function (commandLine) {
        ctx.reply("Stream starting...");
        console.log("Spawned FFmpeg with command: " + commandLine);
      })
      .on("error", function (err, stdout, stderr) {
        ctx.reply("An error occurred during streaming.");
        console.error("Error: " + err.message);
        console.error("ffmpeg stderr: " + stderr);
        isStreaming = false; // Reset streaming status on error
      })
      .on("end", function () {
        ctx.reply("Streaming finished.");
        console.log("Streaming finished.");
        isStreaming = false; // Reset streaming status on completion
      })
      .output(youtubeStreamUrl)
      .run();

  } catch (error) {
    ctx.reply("An error occurred while setting up the stream.");
    console.error("Error in startLivestream function: ", error.message);
    isStreaming = false; // Reset streaming status on error
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
