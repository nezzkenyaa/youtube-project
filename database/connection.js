import { MongoClient, ServerApiVersion } from "mongodb";
import "dotenv/config";
const URI = process.env.URI;
const client = new MongoClient(URI, {
  serverApi: {
    timestamps: true,
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

try {
  // Connect the client to the server
  await client.connect();
  // Send a ping to confirm a successful connection
  await client.db("admin").command({ ping: 1 });
  console.log("Pinged your deployment. You successfully connected to MongoDB!");
} catch (err) {
  console.error(err);
}

let db = client.db("acess_tokens");

export default db;
