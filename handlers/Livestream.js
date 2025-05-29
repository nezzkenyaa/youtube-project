import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import "dotenv/config"

// Set the path to the precompiled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

// Replace this with your YouTube stream URL
const youtubeStreamUrl = process.env.S_URL;

// Replace this with your live audio stream URL
const liveAudioUrl = process.env.AUDIO_URL || "https://gene-wr08.ice.infomaniak.ch/gene-wr08.aac";

// Path to the short video file in the root path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shortVideoPath = path.resolve(__dirname, "..", "t.mp4"); // Adjusted path since this is in handlers folder

let isStreaming = false;
let ffmpegProcess = null;
let telegramContext = null; // Store Telegram context for notifications

// Function to start live streaming
async function startLivestream(ctx = null) {
  telegramContext = ctx; // Store context for notifications
  
  if (isStreaming) {
    const message = "A stream is already running. Please wait for it to finish.";
    console.log(message);
    if (ctx) ctx.reply(message);
    return;
  }

  // Check if required files/URLs exist
  if (!fs.existsSync(shortVideoPath)) {
    const message = `Short video file not found: ${shortVideoPath}`;
    console.error(message);
    if (ctx) ctx.reply(`❌ Error: ${message}`);
    return;
  }

  if (!youtubeStreamUrl) {
    const message = "YouTube stream URL not provided. Set S_URL environment variable.";
    console.error(message);
    if (ctx) ctx.reply(`❌ Error: ${message}`);
    return;
  }

  if (!liveAudioUrl) {
    const message = "Live audio URL not provided. Set AUDIO_URL environment variable.";
    console.error(message);
    if (ctx) ctx.reply(`❌ Error: ${message}`);
    return;
  }

  try {
    isStreaming = true;
    const message = "🚀 Starting livestream...";
    console.log(message);
    if (ctx) ctx.reply(message);
    await streamAudio();
  } catch (error) {
    const message = `Error in startLivestream function: ${error.message}`;
    console.error(message);
    if (ctx) ctx.reply(`❌ ${message}`);
    isStreaming = false; // Reset streaming status on error
  }
}

// Function to handle the audio streaming and switching
async function streamAudio() {
  try {
    function startFfmpegCommand() {
      console.log("Starting FFmpeg command...");
      
      ffmpegProcess = ffmpeg()
        .input(shortVideoPath)
        .inputOptions([
          "-stream_loop -1", // Loop the video infinitely
          "-re" // Read input at native frame rate for live streaming
        ])
        .input(liveAudioUrl)
        .inputOptions([
          "-re", // Read input at native frame rate for live streaming
          "-reconnect 1", // Reconnect if connection is lost
          "-reconnect_streamed 1", // Reconnect when the current stream is finished
          "-reconnect_delay_max 5" // Maximum delay between reconnect attempts
        ])
        .outputOptions([
          "-map 0:v:0",       // Use the video stream from the first input (looped video)
          "-map 1:a:0",       // Use the audio stream from the live audio input
          "-c:v libx264",     // Use H.264 codec for video encoding
          "-preset veryfast", // Balance between encoding speed and quality
          "-b:v 6000k",       // Set video bitrate to 6000 Kbps
          "-maxrate 6000k",   // Set maximum bitrate for the video
          "-bufsize 12000k",  // Set buffer size for smoother streaming
          "-c:a aac",         // Use AAC codec for audio encoding
          "-b:a 128k",        // Set audio bitrate to 128 Kbps
          "-f flv",           // Output format for live streaming (YouTube/Twitch)
          "-flush_packets 0", // Ensure no packet is dropped during streaming
          "-reconnect 1",     // Reconnect if connection is lost
          "-reconnect_streamed 1", // Reconnect when the current stream is finished
          "-reconnect_delay_max 5" // Maximum delay between reconnect attempts (in seconds)
        ])
        .on("start", function (commandLine) {
          const message = "✅ Stream started successfully!";
          console.log("Stream starting...");
          console.log("Spawned FFmpeg with command: " + commandLine);
          if (telegramContext) telegramContext.reply(message);
        })
        .on("error", function (err, stdout, stderr) {
          const message = `❌ Stream error: ${err.message}`;
          console.error("An error occurred during streaming.");
          console.error("Error: " + err.message);
          if (stderr) {
            console.error("ffmpeg stderr: " + stderr);
          }
          
          if (telegramContext) telegramContext.reply(message);
          
          // Handle error gracefully
          isStreaming = false;
          
          // Attempt to restart after a delay if it's a connection issue
          setTimeout(() => {
            if (!isStreaming) {
              console.log("Attempting to restart stream...");
              if (telegramContext) telegramContext.reply("🔄 Attempting to restart stream...");
              startLivestream();
            }
          }, 10000); // Wait 10 seconds before restarting
        })
        .on("end", function () {
          console.log("Stream ended.");
          isStreaming = false;
          
          if (telegramContext) telegramContext.reply("⏹️ Stream ended. Restarting in 2 seconds...");
          
          // Automatically restart the stream
          setTimeout(() => {
            console.log("Restarting stream...");
            startFfmpegCommand();
          }, 2000); // Wait 2 seconds before restarting
        })
        .on("progress", function (progress) {
          // Optional: Log progress information (reduced frequency to avoid spam)
          if (progress.timemark && progress.timemark.includes(':00:00')) {
            console.log("Processing: " + progress.timemark + " processed");
          }
        })
        .output(youtubeStreamUrl)
        .run();
    }

    startFfmpegCommand();

  } catch (error) {
    const message = `Error in streamAudio function: ${error.message}`;
    console.error(message);
    if (telegramContext) telegramContext.reply(`❌ ${message}`);
    isStreaming = false; // Reset streaming status on error
  }
}

// Function to stop the stream
function stopLivestream(ctx = null) {
  if (ffmpegProcess) {
    const message = "⏹️ Stopping stream...";
    console.log(message);
    if (ctx) ctx.reply(message);
    
    ffmpegProcess.kill('SIGTERM'); // Use SIGTERM for a graceful shutdown
    setTimeout(() => {
      if (ffmpegProcess) {
        console.log("Force killing stream process...");
        ffmpegProcess.kill('SIGKILL'); // Force kill if SIGTERM doesn't work
      }
    }, 5000);
    
    ffmpegProcess = null;
    isStreaming = false;
    telegramContext = null; // Clear context
    
    const successMessage = "✅ Stream stopped successfully.";
    console.log(successMessage);
    if (ctx) ctx.reply(successMessage);
  } else {
    const message = "ℹ️ No active stream to stop.";
    console.log(message);
    if (ctx) ctx.reply(message);
  }
}

// Function to get stream status
function getStreamStatus() {
  return {
    isStreaming,
    hasProcess: !!ffmpegProcess
  };
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Received SIGINT, stopping stream...');
  stopLivestream();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, stopping stream...');
  stopLivestream();
  process.exit(0);
});

// Start the livestream only if called directly (not when imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  startLivestream();
}

export { startLivestream, stopLivestream, getStreamStatus };