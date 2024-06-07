import express, { Router } from "express";
import { oauth2Client } from "../googleAuth.js";
import db from "../connection.js";
import saveTokens from "../SaveToken.js";
const router = express.Router();
const SCOPES = ["https://www.googleapis.com/auth/youtube.upload"];

router.get("/auth", (req, res) => {
  const id = req.query.id;
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    state: id,
    scope: SCOPES,
  });
  res.redirect(authUrl);
});

router.get("/oauth2callback", async (req, res) => {
  const { code, state: userId } = req.query;
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log(`Received tokens for user ID: ${userId}`, tokens);
    await saveTokens(userId, tokens);
    res.send(
      "Authentication successful! You can now use the bot to upload videos."
    );
  } catch (error) {
    console.error("Error retrieving access token:", error);
    res.status(500).send("Authentication failed");
  }
});

router.post("/details", async (req, res) => {
  const id = req.body?.id;
  try {
    const collection = await db.collection("oauth_tokens");
    const results = await collection.findOne({ user_id: id });
    if (results) {
      res.json(results).status(200);
    } else {
      res.json("token does not exist").status(200);
    }
  } catch (error) {
    console.log(error);
    res.json("an error occurred");
  }
});

export default router;
