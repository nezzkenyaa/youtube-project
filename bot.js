import { Telegraf } from "telegraf";
import "dotenv/config";
import { startLivestream, stopLivestream, getStreamStatus } from "./handlers/Livestream.js";
import { message } from "telegraf/filters";

const bot = new Telegraf(process.env.TOKEN);

// Error handling middleware
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('❌ An error occurred. Please try again.');
});

// Start command
bot.start((ctx) => {
  const welcomeMessage = `
🤖 Welcome to Livestream Bot!

Available commands:
• Type "hi" - Say hello
• Type "stream" - Start livestream
• Type "stop" - Stop livestream  
• Type "status" - Check stream status
• Type "help" - Show this help message
  `;
  ctx.reply(welcomeMessage);
});

// Help command
bot.command('help', (ctx) => {
  const helpMessage = `
📋 Available commands:

• "hi" - Say hello
• "stream" - Start livestream
• "stop" - Stop livestream
• "status" - Check stream status
• "help" - Show this help message

🔴 To start streaming: Type "stream"
⏹️ To stop streaming: Type "stop"
📊 To check status: Type "status"
  `;
  ctx.reply(helpMessage);
});

// Text message handler
bot.on(message('text'), async (ctx) => {
  const text = ctx.message.text.toLowerCase().trim();
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name || 'User';
  
  console.log(`Message from ${username} (${userId}): ${text}`);
  
  try {
    switch (text) {
      case "hi":
        ctx.reply(`👋 Hi ${username}! How can I help you today?`);
        break;
        
      case "stream":
        ctx.reply("🔄 Processing your request to start the stream...");
        await startLivestream(ctx);
        break;
        
      case "stop":
        ctx.reply("🔄 Processing your request to stop the stream...");
        stopLivestream(ctx);
        break;
        
      case "status":
        const status = getStreamStatus();
        const statusMessage = status.isStreaming 
          ? "🔴 Stream is currently ACTIVE"
          : "⚫ Stream is currently STOPPED";
        ctx.reply(statusMessage);
        break;
        
      case "help":
        ctx.reply(`
📋 Available commands:

• "hi" - Say hello
• "stream" - Start livestream
• "stop" - Stop livestream
• "status" - Check stream status
• "help" - Show this help message
        `);
        break;
        
      default:
        ctx.reply(`
❓ I don't understand "${text}".

Type "help" to see available commands.
        `);
        break;
    }
  } catch (error) {
    console.error('Error handling message:', error);
    ctx.reply('❌ An error occurred while processing your request. Please try again.');
  }
});

// Handle unknown commands
bot.on('message', (ctx) => {
  ctx.reply('❓ I only understand text messages. Please send a text command.');
});

// Graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  
  // Stop any active streams
  try {
    stopLivestream();
  } catch (error) {
    console.error('Error stopping stream during shutdown:', error);
  }
  
  // Stop the bot
  bot.stop(signal);
  
  // Exit the process
  setTimeout(() => {
    console.log('Forcing exit...');
    process.exit(0);
  }, 5000);
};

// Handle process termination signals
process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

export default bot;