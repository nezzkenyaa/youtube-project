import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import getRandomDocument from "./Randomdoc.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import axios from 'axios';

// Set the path to the precompiled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

// Store the reference to the ffmpeg process globally
let ffmpegProcess = null;
let isStreaming = false;
let audioFiles = []; // Array to store paths of downloaded audio files

// Replace this with your YouTube stream URL
const youtubeStreamUrl = process.env.S_URL;

// Path to the short video file in the root path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const shortVideoPath = path.resolve(__dirname, "document_6034864354405388885.mp4");

// Function to download an audio file locally
async function downloadAudio(url, filepath) {
  const writer = fs.createWriteStream(filepath);
  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

// Function to start live streaming
async function startLivestream(ctx) {
  if (isStreaming) {
    ctx.reply("A stream is already running. Please wait for it to finish.");
    return;
  }

  try {
    isStreaming = true;
    await streamAudio(ctx);
  } catch (error) {
    ctx.reply("An error occurred while setting up the stream.");
    console.error("Error in startLivestream function: ", error.message);
    isStreaming = false; // Reset streaming status on error
  }
}

// Function to handle the audio streaming and switching
async function streamAudio(ctx) {
  try {
    // Fetch the random document array
    const audioDocs = await getRandomDocument();
    if (!audioDocs || !Array.isArray(audioDocs) || audioDocs.length === 0) {
      throw new Error("No valid audio documents found in the collection.");
    }

    // Download all audio files locally
    audioFiles = []; // Reset the audio files array
    for (let i = 0; i < audioDocs.length; i++) {
      const audioDoc = audioDocs[i];
      const localFilePath = path.resolve(__dirname, `audio${i}.mp3`);
      await downloadAudio(audioDoc.url, localFilePath);
      audioFiles.push(localFilePath);
    }

    // Create a temporary file to list the audio files for ffmpeg concat
    const audioListPath = path.resolve(__dirname, "audioList.txt");
    const audioListContent = audioFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(audioListPath, audioListContent);

    // Initialize FFmpeg command with the short video loop and concatenated audio
    function startFfmpegCommand() {
      ffmpegProcess = ffmpeg()
        .input(shortVideoPath)
        .inputOptions([
          "-stream_loop -1", // Loop the video infinitely
          "-re" // Read input at native frame rate for live streaming
        ])
        .input(audioListPath)
        .inputOptions([
          "-f concat",
          "-safe 0", // Allow unsafe file paths
          "-re" // Read input at native frame rate for live streaming
        ])
        .outputOptions([
          "-map 0:v:0", // Use the video stream from the first input
          "-map 1:a:0", // Use the audio stream from the concatenated input
          "-c:v copy", // Copy video codec to avoid re-encoding
          "-c:a aac", // Audio codec
          "-b:a 64k", // Reduced audio bitrate
          "-f flv", // Output format
          "-flush_packets 0", // Ensure no packet is dropped during streaming
          "-reconnect 1", // Reconnect if connection is lost
          "-reconnect_streamed 1", // Reconnect when the current stream is finished
          "-reconnect_delay_max 5" // Maximum delay between reconnect attempts (in seconds)
        ])
        .on("start", function (commandLine) {
          ctx.reply("Stream starting...");
          console.log("Spawned FFmpeg with command: " + commandLine);
        })
        .on("error", function (err, stdout, stderr) {
          ctx.reply("An error occurred during streaming.");
          console.error("Error: " + err.message);
          console.error("ffmpeg stderr: " + stderr);
          // Handle error gracefully
          isStreaming = false; // Reset streaming status on error
          cleanUpAudioFiles(); // Delete downloaded audio files
        })
        .on("end", async function () {
          console.log("Audio finished! Restarting with new audio...");
          await streamAudio(ctx); // Restart streaming with the next track
        })
        .output(youtubeStreamUrl)
        .run();
    }

    startFfmpegCommand();

  } catch (error) {
    ctx.reply("An error occurred while streaming audio.");
    console.error("Error in streamAudio function: ", error.message);
    isStreaming = false; // Reset streaming status on error
    cleanUpAudioFiles(); // Delete downloaded audio files
  }
}

// Function to stop the stream
function stopLivestream(ctx) {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM'); // Use SIGTERM for a graceful shutdown
    ctx.reply("Stream stopped successfully.");
    console.log("Stream stopped successfully.");
    isStreaming = false; // Reset streaming status on stop
    cleanUpAudioFiles(); // Delete downloaded audio files
  } else {
    ctx.reply("No active stream to stop.");
    console.log("No active stream to stop.");
  }
}

// Function to clean up downloaded audio files
function cleanUpAudioFiles() {
  for (const file of audioFiles) {
    fs.unlink(file, (err) => {
      if (err) {
        console.error(`Failed to delete file ${file}: `, err);
      } else {
        console.log(`Deleted file ${file}`);
      }
    });
  }
  audioFiles = []; // Reset the audio files array
}

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

export { startLivestream, stopLivestream };
