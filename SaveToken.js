import db from "./connection.js";
async function saveTokens(userId, tokens) {
  try {
    const collection = db.collection("oauth_tokens");
    const res = await collection.findOne({ user_id: userId });
    if (res) {
      await collection.updateOne(
        { user_id: userId },
        { $set: { user_id: userId, tokens: tokens } }
      );
      console.log(`Tokens updated for user ID: ${userId}`);
    } else {
      await collection.insertOne({ user_id: userId, tokens: tokens });
      console.log(`Tokens saved for user ID: ${userId}`);
    }
  } catch (error) {
    console.error("Error saving tokens:", error);
    throw error;
  }
}

export default saveTokens;
