import axios from "axios";
import { PassThrough } from "stream";
import ffmpeg from "fluent-ffmpeg";
import { bucket } from "./Firebase.js";
import db from "../database/connection.js";

export default async function uploadAudio(ctx, file_id) {
  console.log("Upload initiated");
  ctx.reply("Upload started for Firebase");
  
  try {
    console.log("Getting file link");
    // Fetch file link using Axios if file_id is provided
    const fileLinkResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.TOKEN}/getFile?file_id=${file_id}`
    );

    if (fileLinkResponse.data.ok !== true) {
      throw new Error("Failed to fetch file link from Telegram");
    }

    const fileLink = fileLinkResponse.data.result.file_path;
    console.log(`File link: ${fileLink}`);

    console.log("Downloading audio file");
    // Download audio file as a stream
    const fileResponse = await axios.get(
      `https://api.telegram.org/file/bot${process.env.TOKEN}/${fileLink}`,
      { responseType: "stream" }
    );

    const passThrough = new PassThrough();
    fileResponse.data.pipe(passThrough);

    console.log("Extracting audio metadata");
    let metadata = {};

    await new Promise((resolve, reject) => {
      ffmpeg(passThrough)
        .ffprobe((err, data) => {
          if (err) {
            reject(err);
          } else {
            metadata.title = data.format.tags.title || "Unknown Title";
            metadata.artist = data.format.tags.artist || "Unknown Artist";
            resolve();
          }
        });
    });
    console.log("Uploading audio to Firebase");
    const firebaseFile = bucket.file(`audio/${file_id}.mp3`);
    const fileStream = firebaseFile.createWriteStream({
      metadata: {
        contentType: "audio/mpeg",
      },
    });

    passThrough.pipe(fileStream);

    await new Promise((resolve, reject) => {
      fileStream.on("finish", resolve);
      fileStream.on("error", reject);
    });

    console.log("Audio uploaded successfully");

    // Generate download URL
    const [url] = await firebaseFile.getSignedUrl({
      action: "read",
      expires: "03-09-2491" // Replace with appropriate expiry date or duration
    });
const details = {
  artist: metadata.artist,
  title: metadata.title,
  url: url
}
    ctx.reply("Audio uploaded successfully to firebase");
    await AddAudioDb(details,ctx)
  } catch (error) {
    console.error("Error uploading audio:", error);
    ctx.reply(`Failed to upload audio: ${error.message}`);
    throw error; // Re-throw error to handle it appropriately in your application
  }
}
async function AddAudioDb(metadata,ctx){
  try {
    const collection = db.collection("audio")
    const res = await collection.insertOne(metadata)
    ctx.reply("audio added to db")
    
  } catch (error) {
    console.log(error)
  }
}