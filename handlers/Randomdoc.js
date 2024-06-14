import db from "../database/connection.js";

export default async function getRandomDocument() {
  try {
    const collection = db.collection("streamv");

    // Use the $sample aggregation stage to get a random document
    const randomDocArray = await collection.aggregate([{ $sample: { size: 1 } }]).toArray();

    // If the collection is empty, return null
    if (randomDocArray.length === 0) {
      return null;
    }

    // Return the random document
    return randomDocArray[0];
  } catch (error) {
    console.error("Error retrieving random document:", error);
    throw error;
  }
}
