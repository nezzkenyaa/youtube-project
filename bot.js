import { Telegraf, Markup } from "telegraf";
import "dotenv/config";
import {
  startLivestream,
  stopLivestream,
  getStreamStatus,
} from "./handlers/Livestream.js";

const bot = new Telegraf(process.env.TOKEN);

// Authorized users (add your user IDs here)
const AUTHORIZED_USERS = process.env.AUTHORIZED_USERS
  ? process.env.AUTHORIZED_USERS.split(",").map((id) => parseInt(id.trim()))
  : [];

/**
 * Check if user is authorized
 */
function isAuthorized(userId) {
  if (AUTHORIZED_USERS.length === 0) return true; // Allow all if not configured
  return AUTHORIZED_USERS.includes(userId);
}

/**
 * Main menu keyboard
 */
function getMainKeyboard() {
  return Markup.keyboard([
    ["🔴 Start Stream", "⏹️ Stop Stream"],
    ["📊 Status", "❓ Help"],
  ]).resize();
}

/**
 * Inline keyboard for stream control
 */
function getStreamControlKeyboard(isActive) {
  const buttons = [];

  if (!isActive) {
    buttons.push([Markup.button.callback("▶️ Start Stream", "start_stream")]);
  } else {
    buttons.push([Markup.button.callback("⏹️ Stop Stream", "stop_stream")]);
  }

  buttons.push([Markup.button.callback("🔄 Refresh Status", "check_status")]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Format status message
 */
function getStatusMessage() {
  const status = getStreamStatus();
  const emoji = status.isStreaming ? "🔴" : "⚫";
  const state = status.isStreaming ? "ACTIVE" : "STOPPED";
  const timestamp = new Date().toLocaleTimeString();

  return `
${emoji} *Stream Status*

Status: *${state}*
Process: ${status.hasProcess ? "✅ Running" : "❌ Not Running"}
Last Check: ${timestamp}
  `.trim();
}

// Error handling middleware
bot.catch((err, ctx) => {
  console.error("Bot error:", err);
  ctx.reply("❌ An error occurred. Please try again.", getMainKeyboard());
});

// Authorization middleware
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;

  if (!userId) return;

  if (!isAuthorized(userId)) {
    console.log(`Unauthorized access attempt from: ${userId}`);
    await ctx.reply("🚫 You are not authorized to use this bot.");
    return;
  }

  return next();
});

// Start command
bot.command("start", (ctx) => {
  const username = ctx.from.username || ctx.from.first_name || "User";
  const welcomeMessage = `
🤖 *Welcome ${username}!*

I'm your Livestream Control Bot. Use the buttons below to control your stream.

🔴 Start/Stop streaming
📊 Check stream status
❓ Get help
  `.trim();

  ctx.reply(welcomeMessage, {
    parse_mode: "Markdown",
    ...getMainKeyboard(),
  });
});

// Help command
bot.command("help", (ctx) => {
  const helpMessage = `
📋 *Help & Commands*

*Keyboard Buttons:*
🔴 Start Stream - Begin livestreaming
⏹️ Stop Stream - End livestreaming
📊 Status - Check current status
❓ Help - Show this message

*Text Commands:*
/start - Show main menu
/status - Detailed status
/help - Show this help

*Tips:*
• Only one stream can run at a time
• Stream auto-restarts on errors
• Use Stop button for clean shutdown
  `.trim();

  ctx.reply(helpMessage, {
    parse_mode: "Markdown",
    ...getMainKeyboard(),
  });
});

// Status command
bot.command("status", (ctx) => {
  ctx.reply(getStatusMessage(), {
    parse_mode: "Markdown",
    ...getStreamControlKeyboard(getStreamStatus().isStreaming),
  });
});

// Handle keyboard button presses
bot.hears("🔴 Start Stream", async (ctx) => {
  const status = getStreamStatus();

  if (status.isStreaming) {
    ctx.reply("⚠️ Stream is already running!", getMainKeyboard());
    return;
  }

  ctx.reply("🔄 Starting stream...", getMainKeyboard());
  await startLivestream(ctx);
});

bot.hears("⏹️ Stop Stream", (ctx) => {
  const status = getStreamStatus();

  if (!status.isStreaming) {
    ctx.reply("ℹ️ No active stream to stop.", getMainKeyboard());
    return;
  }

  ctx.reply("🔄 Stopping stream...", getMainKeyboard());
  stopLivestream(ctx);
});

bot.hears("📊 Status", (ctx) => {
  ctx.reply(getStatusMessage(), {
    parse_mode: "Markdown",
    ...getStreamControlKeyboard(getStreamStatus().isStreaming),
  });
});

bot.hears("❓ Help", (ctx) => {
  ctx.replyWithMarkdown(
    `
📋 *Quick Guide*

Use the buttons below to control your stream:

🔴 *Start Stream* - Begin broadcasting
⏹️ *Stop Stream* - End broadcasting
📊 *Status* - Check current state

The stream will automatically reconnect if there are any network issues.
  `,
    getMainKeyboard()
  );
});

// Handle inline button callbacks
bot.action("start_stream", async (ctx) => {
  await ctx.answerCbQuery("Starting stream...");

  const status = getStreamStatus();
  if (status.isStreaming) {
    ctx.editMessageText("⚠️ Stream is already running!", {
      parse_mode: "Markdown",
      ...getStreamControlKeyboard(true),
    });
    return;
  }

  ctx.editMessageText("🔄 Starting stream...", { parse_mode: "Markdown" });
  await startLivestream(ctx);

  // Update message with new status
  setTimeout(() => {
    ctx
      .editMessageText(getStatusMessage(), {
        parse_mode: "Markdown",
        ...getStreamControlKeyboard(getStreamStatus().isStreaming),
      })
      .catch(() => {});
  }, 2000);
});

bot.action("stop_stream", async (ctx) => {
  await ctx.answerCbQuery("Stopping stream...");

  const status = getStreamStatus();
  if (!status.isStreaming) {
    ctx.editMessageText("ℹ️ No active stream to stop.", {
      parse_mode: "Markdown",
      ...getStreamControlKeyboard(false),
    });
    return;
  }

  ctx.editMessageText("🔄 Stopping stream...", { parse_mode: "Markdown" });
  stopLivestream(ctx);

  // Update message with new status
  setTimeout(() => {
    ctx
      .editMessageText(getStatusMessage(), {
        parse_mode: "Markdown",
        ...getStreamControlKeyboard(getStreamStatus().isStreaming),
      })
      .catch(() => {});
  }, 2000);
});

bot.action("check_status", async (ctx) => {
  await ctx.answerCbQuery("Refreshing...");

  ctx
    .editMessageText(getStatusMessage(), {
      parse_mode: "Markdown",
      ...getStreamControlKeyboard(getStreamStatus().isStreaming),
    })
    .catch(() => {});
});

// Handle unknown text messages
bot.on("text", (ctx) => {
  const text = ctx.message.text;

  // Ignore if it starts with / (command)
  if (text.startsWith("/")) return;

  ctx.reply(
    "❓ Please use the buttons below to control the stream.",
    getMainKeyboard()
  );
});

// Handle other message types
bot.on("message", (ctx) => {
  ctx.reply(
    "ℹ️ I only respond to button presses and commands.",
    getMainKeyboard()
  );
});

/**
 * Graceful shutdown handler
 */
async function gracefulShutdown(signal) {
  console.log(`\n📛 Received ${signal}, shutting down gracefully...`);

  try {
    const status = getStreamStatus();
    if (status.isStreaming) {
      console.log("⏹️ Stopping active stream...");
      stopLivestream();
    }
  } catch (error) {
    console.error("Error stopping stream:", error);
  }

  try {
    console.log("🤖 Stopping bot...");
    await bot.stop(signal);
  } catch (error) {
    console.error("Error stopping bot:", error);
  }

  console.log("✅ Shutdown complete");
  process.exit(0);
}

// Process signal handlers
process.once("SIGINT", () => gracefulShutdown("SIGINT"));
process.once("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Error handlers
process.on("uncaughtException", (error) => {
  console.error("💥 Uncaught Exception:", error);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("⚠️ Unhandled Rejection at:", promise, "reason:", reason);
});

export default bot;
