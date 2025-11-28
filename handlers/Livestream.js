import ffmpeg from "fluent-ffmpeg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { promisify } from "util";
import "dotenv/config";

const execAsync = promisify(exec);

// Environment variables
const YOUTUBE_STREAM_URL = process.env.S_URL;
const LIVE_AUDIO_URL =
  process.env.AUDIO_URL ||
  "https://hiphoplive.radionoise.ro:9110/stream?type=http&nocache=228";

// File paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SHORT_VIDEO_PATH = path.resolve(__dirname, "..", "t.mp4");

// Stream state
let isStreaming = false;
let ffmpegProcess = null;
let telegramContext = null;

/**
 * Detect and set FFmpeg path (prefer system FFmpeg)
 */
async function detectFFmpegPath() {
  try {
    // Try to find system FFmpeg first
    const { stdout } = await execAsync("which ffmpeg");
    const systemPath = stdout.trim();
    if (systemPath) {
      console.log(`✓ Using system FFmpeg: ${systemPath}`);
      ffmpeg.setFfmpegPath(systemPath);
      return true;
    }
  } catch (error) {
    console.log("System FFmpeg not found, trying ffmpeg-static...");
  }

  try {
    // Fallback to ffmpeg-static
    const ffmpegStatic = await import("ffmpeg-static");
    console.log(`✓ Using ffmpeg-static: ${ffmpegStatic.default}`);
    ffmpeg.setFfmpegPath(ffmpegStatic.default);
    return true;
  } catch (error) {
    console.error("❌ No FFmpeg found. Install with: sudo apt install ffmpeg");
    return false;
  }
}

/**
 * Validates required files and environment variables
 */
function validateRequirements(ctx) {
  if (!fs.existsSync(SHORT_VIDEO_PATH)) {
    const message = `❌ Video file not found: ${SHORT_VIDEO_PATH}`;
    console.error(message);
    if (ctx) ctx.reply(message);
    return false;
  }

  if (!YOUTUBE_STREAM_URL) {
    const message =
      "❌ YouTube stream URL not set. Configure S_URL environment variable.";
    console.error(message);
    if (ctx) ctx.reply(message);
    return false;
  }

  if (!LIVE_AUDIO_URL) {
    const message =
      "❌ Audio URL not set. Configure AUDIO_URL environment variable.";
    console.error(message);
    if (ctx) ctx.reply(message);
    return false;
  }

  return true;
}

/**
 * Sends notification message to console and Telegram
 */
function notify(message, ctx = telegramContext) {
  console.log(message);
  if (ctx) ctx.reply(message);
}

/**
 * Creates FFmpeg streaming command with maximum compatibility
 */
function createStreamCommand() {
  return ffmpeg()
    .input(SHORT_VIDEO_PATH)
    .inputOptions(["-stream_loop -1", "-re"])
    .input(LIVE_AUDIO_URL)
    .inputOptions([
      "-re",
      "-reconnect 1",
      "-reconnect_streamed 1",
      "-reconnect_delay_max 5",
      "-reconnect_at_eof 1",
      "-timeout 10000000",
    ])
    .outputOptions([
      "-map 0:v:0",
      "-map 1:a:0",
      // Video encoding - simplified for maximum compatibility
      "-c:v libx264",
      "-preset ultrafast",
      "-tune zerolatency",
      "-pix_fmt yuv420p",
      "-b:v 2500k",
      "-maxrate 3000k",
      "-bufsize 5000k",
      "-r 30",
      "-g 60",
      "-sc_threshold 0",
      // Audio encoding - simplified
      "-c:a aac",
      "-b:a 128k",
      "-ar 44100",
      "-ac 2",
      // Output format
      "-f flv",
      // Error recovery
      "-max_muxing_queue_size 1024",
    ])
    .output(YOUTUBE_STREAM_URL);
}

/**
 * Handles stream restart with delay
 */
function scheduleRestart(delay = 5000, reason = "") {
  if (reason === "Unknown error") {
    return;
  }
  if (reason) {
    console.log(`Restart scheduled: ${reason}`);
  }

  setTimeout(() => {
    if (!isStreaming) {
      console.log("Attempting automatic restart...");
      notify("🔄 Restarting stream...");
      startStream();
    }
  }, delay);
}

/**
 * Starts the FFmpeg streaming process
 */
function startStream() {
  console.log("Initializing FFmpeg stream...");

  ffmpegProcess = createStreamCommand()
    .on("start", (commandLine) => {
      notify("✅ Stream started successfully!");
      console.log("FFmpeg command:", commandLine);
    })
    .on("error", (err, stdout, stderr) => {
      console.error("=== Stream Error ===");
      console.error("Message:", err.message);
      console.error("Signal:", err.signal);

      if (stderr) {
        // Show more context for debugging
        const stderrLines = stderr.split("\n");
        const errorContext = stderrLines.slice(-15).join("\n");
        console.error("=== Last 15 lines of stderr ===");
        console.error(errorContext);
      }

      notify(`❌ Stream error: ${err.message}`);
      isStreaming = false;
      ffmpegProcess = null;

      // Handle different error types
      if (err.signal === "SIGSEGV") {
        notify("💥 FFmpeg crashed (SIGSEGV)");
        notify("🔧 Please install system FFmpeg:");
        notify("   sudo apt update && sudo apt install ffmpeg");
        notify("   Then restart the application");
        // Don't auto-restart on segfault
      } else if (
        err.message.includes("Connection") ||
        err.message.includes("timed out")
      ) {
        notify("🌐 Network error - retrying in 15 seconds");
        scheduleRestart(15000, "Network error");
      } else if (err.message.includes("Conversion failed")) {
        notify("⚠️ Encoding error - retrying with different settings");
        scheduleRestart(10000, "Encoding error");
      } else {
        notify("⚠️ Unexpected error - retrying in 30 seconds");
        scheduleRestart(30000, "Unknown error");
      }
    })
    .on("end", () => {
      console.log("Stream ended normally.");
      isStreaming = false;
      ffmpegProcess = null;
      notify("⏹️ Stream ended. Restarting in 5 seconds...");
      scheduleRestart(5000, "Normal end");
    })
    .on("progress", (progress) => {
      // Log every 30 seconds to show stream is alive
      if (progress.timemark) {
        const match = progress.timemark.match(/(\d{2}):(\d{2})/);
        if (match) {
          const seconds = parseInt(match[2]);
          if (seconds % 30 === 0) {
            console.log(
              `[${new Date().toLocaleTimeString()}] Stream running: ${
                progress.timemark
              }`
            );
          }
        }
      }
    })
    .run();
}

/**
 * Starts the livestream
 */
async function startLivestream(ctx = null) {
  telegramContext = ctx;

  if (isStreaming) {
    notify("⚠️ Stream already running. Use 'stop' to end current stream.", ctx);
    return;
  }

  if (!validateRequirements(ctx)) {
    return;
  }

  // Detect and configure FFmpeg
  const ffmpegFound = await detectFFmpegPath();
  if (!ffmpegFound) {
    notify("❌ FFmpeg not found. Install with: sudo apt install ffmpeg", ctx);
    return;
  }

  try {
    isStreaming = true;
    notify("🚀 Starting livestream...", ctx);
    startStream();
  } catch (error) {
    notify(`❌ Failed to start: ${error.message}`, ctx);
    isStreaming = false;
  }
}

/**
 * Stops the livestream
 */
function stopLivestream(ctx = null) {
  if (!ffmpegProcess) {
    notify("ℹ️ No active stream to stop.", ctx);
    return;
  }

  notify("⏹️ Stopping stream...", ctx);

  try {
    ffmpegProcess.kill("SIGTERM");

    // Force kill if graceful shutdown fails
    setTimeout(() => {
      if (ffmpegProcess) {
        console.log("Force killing stream process...");
        try {
          ffmpegProcess.kill("SIGKILL");
        } catch (e) {
          console.log("Process already terminated");
        }
      }
    }, 5000);
  } catch (error) {
    console.error("Error stopping stream:", error.message);
  }

  ffmpegProcess = null;
  isStreaming = false;
  telegramContext = null;

  notify("✅ Stream stopped.", ctx);
}

/**
 * Returns current stream status
 */
function getStreamStatus() {
  return {
    isStreaming,
    hasProcess: !!ffmpegProcess,
  };
}

// Graceful shutdown handlers
process.on("SIGINT", () => {
  console.log("\nShutting down gracefully...");
  stopLivestream();
  setTimeout(() => process.exit(0), 1000);
});

process.on("SIGTERM", () => {
  console.log("Shutting down gracefully...");
  stopLivestream();
  setTimeout(() => process.exit(0), 1000);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  stopLivestream();
});

// Auto-start if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startLivestream();
}

export { startLivestream, stopLivestream, getStreamStatus };
