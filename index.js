import { startLivestream, stopLivestream, getStreamStatus } from "./handlers/Livestream.js";
import bot from "./bot.js";
import "dotenv/config";

console.log('🚀 Starting livestream application and Telegram bot...');

// Function to handle graceful shutdown
const gracefulShutdown = (signal) => {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  
  try {
    // Stop the bot
    bot.stop(signal);
    console.log('🤖 Bot stopped successfully');
    
    // Stop the livestream
    stopLivestream();
    console.log('✅ Livestream stopped successfully');
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
  }
  
  setTimeout(() => {
    console.log('👋 Goodbye!');
    process.exit(0);
  }, 2000);
};

// Handle process termination signals
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection');
});

// Start the application
async function main() {
  try {
    // Start the Telegram bot first
    console.log('🤖 Starting Telegram bot...');
    await bot.launch();
    console.log('✅ Telegram bot started successfully!');
    
    console.log('📡 Auto-starting livestream...');
    await startLivestream();
    
    console.log('🎉 Application is running! Use Telegram bot to control the stream.');
    
    // Keep the process running and show status periodically
    setInterval(() => {
      const status = getStreamStatus();
      if (status.isStreaming) {
        console.log('🔴 Stream Status: ACTIVE');
      }
      // Only log when stream is active to reduce console spam
    }, 60000); // Check status every 60 seconds
    
  } catch (error) {
    console.error('❌ Failed to start application:', error.message);
    process.exit(1);
  }
}

// Start the application
main().catch((error) => {
  console.error('❌ Application failed to start:', error);
  process.exit(1);
});