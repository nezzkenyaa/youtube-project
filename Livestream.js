import axios from 'axios';
import { PassThrough } from 'stream';
import fetch from 'node-fetch';
import { oauth2Client } from './googleAuth.js';
import { google } from "googleapis";
import db from './connection.js';
import saveTokens from './SaveToken.js';
import ffmpeg from 'fluent-ffmpeg';

export default async function liveStreamVideo(ctx, file_id) {
  console.log("Live stream initiated");
  ctx.reply("Live stream started");

  const userId = ctx.from.id.toString();
  console.log(`User ID: ${userId}`);

  try {
    // Fetch user details
    const userDetailsResponse = await fetch(
      `${process.env.BASE_URL}/details`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: userId }),
      }
    );

    if (!userDetailsResponse.ok) {
      throw new Error(
        `Failed to fetch user details: ${userDetailsResponse.statusText}`
      );
    }

    const userDetails = await userDetailsResponse.json();
    const userTokens = userDetails.tokens;

    if (!userTokens || !userTokens.access_token) {
      throw new Error("User tokens not found");
    }

    ctx.reply("Access token found :rock");
    ctx.reply("Proceeding");
    console.log("User tokens found, setting credentials");

    // Set OAuth2 credentials
    oauth2Client.setCredentials(userTokens);

    console.log("Setting up YouTube live stream");

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    // Create live broadcast
    const broadcastResponse = await youtube.liveBroadcasts.insert({
      part: "snippet,status,contentDetails",
      requestBody: {
        snippet: {
          title: "Live Stream Test",
          description: "A test live stream",
          scheduledStartTime: new Date().toISOString(),
        },
        status: {
          privacyStatus: "private",
        },
        contentDetails: {
          monitorStream: {
            enableMonitorStream: false,
          },
        },
      },
    });

    const broadcast = broadcastResponse.data;
    console.log("Broadcast created:", broadcast);

    // Create live stream
    const streamResponse = await youtube.liveStreams.insert({
      part: "snippet,cdn",
      requestBody: {
        snippet: {
          title: "Live Stream Test",
          description: "A test live stream",
        },
        cdn: {
          frameRate: "30fps",
          ingestionType: "rtmp",
          resolution: "720p",
        },
      },
    });

    const stream = streamResponse.data;
    console.log("Stream created:", stream);

    // Bind the broadcast to the stream
    const bindResponse = await youtube.liveBroadcasts.bind({
      part: "id,contentDetails",
      id: broadcast.id,
      requestBody: {
        id: broadcast.id,
        contentDetails: {
          boundStreamId: stream.id,
        },
      },
    });

    console.log("Broadcast bound to stream:", bindResponse.data);

    console.log("Getting file link");

    // Fetch file link using Axios
    const fileLinkResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.TOKEN}/getFile?file_id=${file_id}`
    );

    if (fileLinkResponse.data.ok !== true) {
      throw new Error("Failed to fetch file link from Telegram");
    }

    const fileLink = fileLinkResponse.data.result.file_path;
    console.log(`File link: ${fileLink}`);

    console.log("Downloading video file");

    // Download video file as a stream
    const fileResponse = await axios.get(
      `https://api.telegram.org/file/bot${process.env.TOKEN}/${fileLink}`,
      { responseType: "stream" }
    );

    const passThrough = new PassThrough();
    fileResponse.data.pipe(passThrough);

    // Setup RTMP URL
    const rtmpUrl = `${stream.cdn.ingestionInfo.ingestionAddress}/${stream.cdn.ingestionInfo.streamName}`;

    console.log(`Streaming to RTMP URL: ${rtmpUrl}`);

    // Stream video using FFmpeg (requires FFmpeg installed on your server)
    ffmpeg(passThrough)
      .addOption('-f', 'flv')
      .output(rtmpUrl)
      .on('start', function(commandLine) {
        console.log('FFmpeg process started:', commandLine);
      })
      .on('error', function(err, stdout, stderr) {
        console.log('FFmpeg error:', err.message);
        console.log('FFmpeg stderr:', stderr);
        ctx.reply(`Failed to stream video: ${err.message}`);
      })
      .on('end', function() {
        console.log('FFmpeg process ended');
        ctx.reply("Live stream ended");
      })
      .run();

    ctx.reply("Video is now live streaming");

    await saveTokens(userId, userTokens);
    console.log("Tokens saved to MongoDB");
  } catch (error) {
    console.error("Error live streaming video:", error);
    ctx.reply(`Failed to live stream video: ${error.message}`);
  }
}
