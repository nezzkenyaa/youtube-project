import axios from "axios";
import { PassThrough } from "stream";
import fetch from "node-fetch";
import { oauth2Client } from "./googleAuth.js";
import { google } from "googleapis";
import db from "./connection.js";
import saveTokens from "./SaveToken.js";

export default async function uploadVideo(ctx, file_id, link) {
  console.log("Upload initiated");
  ctx.reply("Upload started");

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

    ctx.reply(`Access token found :rock`);
    ctx.reply(`proceeding`);
    console.log("User tokens found, setting credentials");

    // Set OAuth2 credentials
    oauth2Client.setCredentials(userTokens);

    console.log("Getting file link");

    let fileLink;

    if (file_id) {
      // Fetch file link using Axios if file_id is provided
      const fileLinkResponse = await axios.get(
        `https://api.telegram.org/bot${process.env.TOKEN}/getFile?file_id=${file_id}`
      );

      if (fileLinkResponse.data.ok !== true) {
        throw new Error("Failed to fetch file link from Telegram");
      }

      fileLink = fileLinkResponse.data.result.file_path;
    } else if (link) {
      // If link is provided, use it directly
      fileLink = link;
    } else {
      throw new Error("No file ID or link provided");
    }

    console.log(`File link: ${fileLink}`);

    console.log("Downloading video file");
var fileResponse;
    // Download video file as a stream
    if(file_id){
      var fileResponse = await axios.get(
        `https://api.telegram.org/file/bot${process.env.TOKEN}/${fileLink}`,
        { responseType: "stream" }
      );
    }else{
      var fileResponse = await axios.get(link,{
        responseType: "stream"
      })
    }

    const passThrough = new PassThrough();
    fileResponse.data.pipe(passThrough);

    const youtube = google.youtube({ version: "v3", auth: oauth2Client });

    console.log("Uploading video to YouTube");

    const youtubeResponse = await youtube.videos.insert({
      part: "snippet,status",
      requestBody: {
        snippet: {
          title: "Upload Test",
          description: "A test video",
        },
        status: {
          privacyStatus: "private",
        },
      },
      media: {
        body: passThrough,
      },
    });

    console.log("Upload response:", youtubeResponse.data);
    ctx.reply("Video uploaded successfully");
    await saveTokens(userId, userTokens);

    console.log("Tokens saved to MongoDB");
  } catch (error) {
    console.error("Error uploading video:", error);
    ctx.reply(`Failed to upload video: ${error.message}`);
  }
}
