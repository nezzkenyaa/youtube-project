import { AddDb, bucket } from "./Firebase.js";
import youtubedl from "youtube-dl-exec";

export default async function downloadAndUploadYouTubeVideo(ctx, url) {
  try {
    // Get video info
    const info = await youtubedl(url, {
      dumpSingleJson: true,
      noWarnings: true,
      noCallHome: true
    });

    const title = info.title.replace(/[\/\\:*?"<>|]/g, ''); // sanitize title
    const fileName = `videos/${title}_${Date.now()}_${ctx.message.from.id}.mp4`;
    const file = bucket.file(fileName);

    const uploadStream = file.createWriteStream({
      metadata: {
        contentType: 'video/mp4',
      },
      resumable: false,
    });

    return new Promise((resolve, reject) => {
      const videoStream = youtubedl.exec(url, {
        format: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
        output: "-"
      }, { stdio: ['ignore', 'pipe', 'pipe'] });

      if (!videoStream.stdout) {
        return reject(new Error("Failed to initialize video stream."));
      }

      videoStream.stdout.pipe(uploadStream)
        .on('finish', async () => {
          console.log(`File uploaded successfully: ${fileName}`);
          ctx.reply("download finished");
          // Generate a signed URL for the uploaded file
          try {
            const [signedUrl] = await file.getSignedUrl({
              action: 'read',
              expires: '03-01-2500', // Set an appropriate expiry date
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
    // Instead of throwing the error, just log it
    console.error(error);
    // Return a resolved Promise with null value
    return null;
  }
}
