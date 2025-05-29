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
const shortVideoPath = path.resolve(__dirname, "..", "s.mp4"); // Adjusted path since this is in handlers folder

let isStreaming = false;
let ffmpegProcess = null;
let telegramContext = null; // Store Telegram context for notifications

// Function to test audio stream connectivity
// Function to test audio stream connectivity
async function testAudioStream() {
  return new Promise((resolve, reject) => {
    console.log("Testing audio stream connectivity...");
    
    const testProcess = ffmpeg()
      .input(liveAudioUrl)
      .inputOptions([
        "-t 5", // Test for 5 seconds only
        "-reconnect 1",
        "-timeout 5000000" // 5 second timeout
      ])
      .outputOptions([
        "-f null" // Null output (just test connection)
      ])
      .output("-") // Specify stdout as output for null format
      .on("start", () => {
        console.log("Audio stream test started...");
      })
      .on("end", () => {
        console.log("✅ Audio stream test successful");
        resolve(true);
      })
      .on("error", (err) => {
        console.error("❌ Audio stream test failed:", err.message);
        reject(err);
      })
      .run();
    
    // Timeout after 10 seconds
    setTimeout(() => {
      testProcess.kill('SIGTERM');
      reject(new Error("Audio stream test timeout"));
    }, 10000);
  });
}

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
    
    // Test audio stream first
    try {
      await testAudioStream();
    } catch (error) {
      throw new Error(`Audio stream test failed: ${error.message}`);
    }
    
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
          "-reconnect_delay_max 5", // Maximum delay between reconnect attempts
          "-reconnect_at_eof 1", // Reconnect at end of file
          "-timeout 10000000" // Set timeout to 10 seconds (in microseconds)
        ])
        .outputOptions([
          "-map 0:v:0",       // Use the video stream from the first input (looped video)
          "-map 1:a:0",       // Use the audio stream from the live audio input
          "-c:v libx264",     // Use H.264 codec for video encoding
          "-preset veryfast", // Use veryfast preset for stability
          "-profile:v baseline", // Use baseline profile for better compatibility
          "-level 3.1",       // Set H.264 level for compatibility
          "-b:v 4500k",       // Set video bitrate to 4500 Kbps (more conservative)
          "-maxrate 5000k",   // Set maximum bitrate
          "-bufsize 10000k",  // Set buffer size
          "-r 30",            // Force 30 fps output
          "-g 60",            // GOP size (keyframe every 2 seconds at 30fps)
          "-c:a aac",         // Use AAC codec for audio encoding
          "-b:a 128k",        // Set audio bitrate to 128 Kbps
          "-ar 44100",        // Set audio sample rate to 44.1kHz
          "-ac 2",            // Stereo audio (2 channels)
          "-f flv",           // Output format for live streaming
          "-flvflags no_duration_filesize", // FLV compatibility flags
          "-avoid_negative_ts make_zero" // Handle timestamp issues
        ])
        .on("start", function (commandLine) {
          const message = "✅ Stream started successfully!";
          console.log("Stream starting...");
          console.log("Spawned FFmpeg with command: " + commandLine);
          if (telegramContext) telegramContext.reply(message);
        })
        .on("error", function (err, stdout, stderr) {
          const message = `❌ Stream error: ${err.message}`;
          console.error("=== FFmpeg Error Details ===");
          console.error("Error message:", err.message);
          console.error("Error code:", err.code);
          console.error("Signal:", err.signal);
          
          if (stderr) {
            console.error("=== FFmpeg stderr ===");
            console.error(stderr);
          }
          
          if (stdout) {
            console.error("=== FFmpeg stdout ===");
            console.error(stdout);
          }
          
          console.error("=== End Error Details ===");
          
          if (telegramContext) telegramContext.reply(message);
          
          // Handle error gracefully
          isStreaming = false;
          
          // Only restart if it's not a segmentation fault
          if (err.signal !== 'SIGSEGV') {
            setTimeout(() => {
              if (!isStreaming) {
                console.log("Attempting to restart stream...");
                if (telegramContext) telegramContext.reply("🔄 Attempting to restart stream...");
                startLivestream();
              }
            }, 15000); // Wait 15 seconds before restarting
          } else {
            console.error("Segmentation fault detected. Manual restart required.");
            if (telegramContext) telegramContext.reply("💥 Critical error occurred. Please restart manually with 'stream' command.");
          }
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