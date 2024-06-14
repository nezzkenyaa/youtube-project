import admin from "firebase-admin";
import axios from "axios";
import { v4 as uuidv4 } from 'uuid';
import serviceAccount from "../b.json" assert { type: "json" };
import db from "../database/connection.js";

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "tg-bot-6e4ea.appspot.com",
});

export const bucket = admin.storage().bucket();
export async function AddDb(url,name,ctx){
    const newRecord = {
        Name: name,
        Url:url
    }
const collection = await db.collection("video2")
const res = await collection.insertOne(newRecord)
console.log(res)
ctx.reply(`video added to db,     Name:${name}`)
}
export default async function Firebase(ctx, file_id) {
  try {
    console.log("Upload initiated");
    ctx.reply("Upload started to firebase");
const caption = ctx.message.caption
    // Get the file link from Telegram
    const fileLinkResponse = await axios.get(
      `https://api.telegram.org/bot${process.env.TOKEN}/getFile?file_id=${file_id}`
    );

    if (!fileLinkResponse.data.ok) {
      throw new Error("Failed to fetch file link from Telegram");
    }

    const filePath = fileLinkResponse.data.result.file_path;
    const fileUrl = `https://api.telegram.org/file/bot${process.env.TOKEN}/${filePath}`;

    // Download the file from Telegram
    const fileResponse = await axios.get(fileUrl, { responseType: "stream" });

    // Generate a unique filename using uuid
    const fileExtension = filePath.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;
    const storageFile = bucket.file(uniqueFilename);

    // Save the file to Firebase Storage
    await new Promise((resolve, reject) => {
      const writeStream = storageFile.createWriteStream({
        metadata: { contentType: fileResponse.headers['content-type'] },
        public: true,
      });

      fileResponse.data.pipe(writeStream)
        .on('finish', resolve)
        .on('error', reject);
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFilename}`;
    ctx.reply(publicUrl);

    await AddDb(publicUrl,caption,ctx)

  } catch (error) {
    console.error("Upload failed:", error);
    ctx.reply("Upload to firebase failed");
  }
}
