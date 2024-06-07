import express, { json } from "express";
import bot from "./bot.js";
import "dotenv/config";
import router from "./routes/routes.js";

const app = express();
const port = 3000;

//middleware
app.use(express.json());
app.use("/", router);

bot.launch(() => {
  console.log("Bot started");
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
