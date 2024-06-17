import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobe from "ffprobe-static";
import fetch from "node-fetch"; // Import fetch for HTTP request

// Set the path to the precompiled ffmpeg binary
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobe.path);

let ffmpegProcess = null;
let isStreaming = false;

// Replace this with your YouTube stream URL or any other RTMP server URL
const rtmpUrl = "rtmps://dc4-1.rtmp.t.me/s/2062352088:F5AyB6_-JclPtrE268zqqQ";

// Function to start live streaming from an m3u8 URL
async function startLivestream(m3u8Url) {
  try {
    const response = await fetch(m3u8Url);
    if (!response.ok) {
      throw new Error(`Failed to fetch m3u8 playlist: ${response.statusText}`);
    }

    // Set up ffmpeg command with the desired options
    ffmpegProcess = ffmpeg()
      .input(m3u8Url)
      .inputOptions([
        "-re" // Read input at native frame rate for live streaming
      ])
      .outputOptions([
        "-c:v copy",  // Video codec (copy to avoid re-encoding)
        "-c:a aac",   // Audio codec
        "-b:a 128k",  // Audio bitrate
        "-f flv",     // Output format
        "-flush_packets 0" // Ensure no packet is dropped during streaming
      ])
      .on("start", function (commandLine) {
        console.log("Spawned FFmpeg with command: " + commandLine);
        isStreaming = true;
      })
      .on("error", function (err, stdout, stderr) {
        console.error("Error: " + err.message);
        console.error("ffmpeg stderr: " + stderr);
        isStreaming = false; // Reset streaming status on error
      })
      .on("end", function () {
        console.log("Streaming finished!");

        // Ensure the ffmpeg process is terminated
        ffmpegProcess = null;

        // Reset streaming status immediately after completion
        isStreaming = false;
      })
      .output(rtmpUrl)
      .run();

  } catch (error) {
    console.error("Error in startLivestream function: ", error.message);
    isStreaming = false; // Reset streaming status on error
  }
}

// Replace with the m3u8 URL you want to stream
const m3u8Url = "https://i.mjh.nz/Plex/all.m3u8";

// Start livestreaming
startLivestream(m3u8Url);
