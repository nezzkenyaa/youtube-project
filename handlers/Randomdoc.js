import db from "../database/connection.js";

export default async function getRandomDocument() {
  try {
    const collection = db.collection("pop");

    // Retrieve all documents from the collection
    const allDocs = await collection.find({}).toArray();

    // If the collection is empty, return null
    if (allDocs.length === 0) {
      return null;
    }

    // Shuffle the array to get random order of documents
    const randomDocArray = shuffleArray(allDocs);

    // Return up to 30 random documents
    return randomDocArray.slice(0,30);
  } catch (error) {
    console.error("Error retrieving random document:", error);
    throw error;
  }
}

// Function to shuffle an array using Fisher-Yates algorithm
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
