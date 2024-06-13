import { AddDb, bucket } from "./Firebase.js";
import youtubedl from "youtube-dl-exec";
import { v4 as uuidv4 } from 'uuid';

export default async function downloadAndUploadYouTubeVideo(ctx, url) {
  try {
    // Get video info
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true
    });

    const title = info.title.replace(/[\/\\:*?"<>|]/g, ''); // sanitize title
    const fileName = `${title}_${Date.now()}_${ctx.message.from.id}.mp4`;

    // Create a unique filename with UUIDv4
    const fileExtension = fileName.split('.').pop();
    const uniqueFilename = `${uuidv4()}.${fileExtension}`;

    const storageFile = bucket.file(uniqueFilename);

    const uploadStream = storageFile.createWriteStream({
      metadata: {
        contentType: 'video/mp4',
        public: true,
      },
      resumable: false,
    });

    return new Promise((resolve, reject) => {
      const videoStream = youtubedl.exec(url, {
        format: "best[height<=1080][ext=mp4]+bestaudio/best[height<=1080]/best",
        output: "-"
      }, { stdio: ['ignore', 'pipe', 'pipe'] });

      if (!videoStream.stdout) {
        reject(new Error("Failed to initialize video stream."));
        return;
      }

      videoStream.stdout.pipe(uploadStream)
        .on('finish', async () => {
          console.log(`File uploaded successfully: ${uniqueFilename}`);
          ctx.reply("Download finished");
          try {
            const [signedUrl] = await storageFile.getSignedUrl({
              action: 'read',
              expires: '03-01-2500',
            });
            ctx.reply(`File uploaded successfully: ${signedUrl}`);
            await AddDb(signedUrl, title, ctx);
            resolve(signedUrl);
          } catch (error) {
            console.error("Error generating signed URL:", error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error("Firebase upload error:", err);
          reject(err);
        });

      videoStream.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
      });

      videoStream.on('error', (error) => {
        console.error(`Error: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error("Error in downloading or uploading video:", error);
    ctx.reply("An error occurred while processing the video.");
    console.error(error);
    return null;
  }
}
