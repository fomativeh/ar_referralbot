const { Telegraf } = require("telegraf");
require("dotenv").config();
const express = require("express");
const app = express();
const { Schema, model, default: mongoose } = require("mongoose");
const { v1: uuidv1 } = require("uuid");
const bodyParser = require("body-parser");
const cors = require("cors");
const bot = new Telegraf(process.env.BOT_TOKEN);
const Queue = require("queue-promise");
const User = require("./models/userModel");
const checkIfUserExists = require("./helpers/checkIfUserExists");
const showAccountInfo = require("./helpers/showAccountInfo");
const dontReferYourself = require("./helpers/dontReferYourself");
const hasBeenReferred = require("./helpers/hasBeenReferred");
const checkForIncompleteTasks = require("./helpers/checkForIncompleteTasks");
const checkMembership = require("./helpers/checkMembership");
const setReferredString = require("./helpers/setReferredString");
const showLeaderboard = require("./helpers/showLeaderboard");
const handleReferral = require("./helpers/handleReferral");

// Create a queue instance
const queue = new Queue({
  concurrent: 25, // Process one request at a time
  interval: 3000, // Interval between dequeue operations (1 second)
});

app.use(
  cors({
    origin: "*",
  })
);

// Parse URL-encoded bodies (deprecated in Express v4.16+)
app.use(bodyParser.urlencoded({ extended: false }));

// Parse JSON bodies
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

const port = process.env.PORT || 8933;

mongoose
  .connect(process.env.URI)
  .then(() => {
    app.listen(port, () => {
      console.log(`App is listening on port ${port}`);
    });
    console.log("Connected to db.");
    //Send the leaderboard stats every 20 minutes
    const interval = 20 * 60 * 1000; //
    setInterval(async () => {
      queue.enqueue(async () => {
        await showLeaderboard(bot);
      });
    }, interval);
  })
  .catch((err) => {
    console.log(`Error connecting to db: ${err}`);
  });

bot.start(async (ctx) => {
  try {
    const { chat } = ctx.message;
    if (chat.type != "private") {
      return ctx.reply("Please use that command in a private chat.");
    }

    queue.enqueue(async () => {
      const userId = ctx.from.id;
      let inviteId = ctx.payload;
      let linkFirstChunk = "t.me/example_Bot?start=";

      //Check if user came via an invite link
      if (inviteId) {
        //Check if user has incomplete tasks
        await checkForIncompleteTasks(ctx, userId, true); //Use these arguments when they click a link

        //Check if link is valid
        const linkOwnerData = await User.findOne({
          referralLink: linkFirstChunk + inviteId,
        });

        //If the link is valid
        if (linkOwnerData) {
          //Check if user tried to refer themselves.
          if (linkOwnerData.chatId == userId) {
            return await dontReferYourself(ctx, linkOwnerData);
          }

          //If they didn't refer themselves, but they already have an account
          const userData = await checkIfUserExists(userId);
          if (userData) {
            return await showAccountInfo(ctx, userData, true);
          }

          //Hasn't done any of the above, so handle the referral
          return await handleReferral(ctx, linkOwnerData);
        }

        //If the link is invalid
        if (!linkOwnerData) {
          return ctx.reply(
            "Sorry that link is invalid. Please check and try again."
          );
        }
      }

      await checkForIncompleteTasks(ctx, userId); //Use these arguments if user started the bot but have incomplete tasks

      //If user already exists but they didn't click a link, show their account details
      const userData = await checkIfUserExists(userId);
      if (userData) {
        return showAccountInfo(ctx, userData);
      }

      const replyText = `
This example bot rewards users for referrals. To begin, complete the tasks below:`;

const replyMarkup = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "Join our group", url: "t.me/examplebotgroup" }],
      [{ text: "Join our channel", url: "t.me/examplebotchannel" }],
      [
        {
          text: "Follow our instagram",
          url: "https://www.instagram.com/exampleinstagram",
        },
      ],
      [
        {
          text: "Click me when you're done",
          callback_data: "send_link",
        },
      ],
    ],
  },
};

      ctx.reply(replyText, { ...replyMarkup });
    });
  } catch (error) {
    console.log(error);
    ctx.reply("An error occured. Please try again.");
  }
});

bot.action("send_link", async (ctx) => {
  queue.enqueue(async () => {
    try {
      //If user clicked the button after account creation
      const userData = await checkIfUserExists(ctx.from.id);
      if (userData) {
        return showAccountInfo(ctx, userData);
      }

      //Check if user has completed all tasks
      const result = await checkMembership(ctx, ["@examplebotgroup", "@examplebotchannel"]);
      console.log(result);

      //If join check failed
      if (!result.success) {
        return ctx.reply("An error occured, please try again.");
      }

      //If user hasn't joined TG channel
      if (!result.joined) {
        return ctx.reply(
          "You haven't completed the tasks, please join all our socials to continue."
        );
      }

      const newReferralLink = `t.me/example_Bot?start=${uuidv1()}`;
      const newUser = new User({
        chatId: ctx.from.id,
        referralLink: newReferralLink,
        referredUsers: [],
        referralCount: 0,
        username: ctx.from.username,
      });

      await newUser.save();

      ctx.reply(
        `This is your referral link\n\n\`${newReferralLink}\`\n\nKeep sharing it to refer users`,
        { parse_mode: "Markdown" }
      );
    } catch (error) {
      console.log(error);
    }
  });
});

bot.command("myinvite", async (ctx) => {
  queue.enqueue(async () => {
    try {
      const { chat } = ctx.message;
      // Access the message object
      const message = ctx.message;

      // Get the message ID
      const messageId = message.message_id;

      const userDetails = await User.findOne({ chatId: ctx.from.id });
      if (!userDetails) {
        return ctx.reply(
          "You have no account yet. Please use the /start command in a private chat and complete the tasks to continue."
        );
      }

      const referred = userDetails.referralCount;

      const replyText = `
Username: *${userDetails.username}*

Your have referred: *${setReferredString(referred)}*

Keep sharing your link with others.

\`${userDetails.referralLink}\` _(Tap to copy)_    
`;

      ctx.reply(replyText, {
        reply_to_message_id: messageId,
        parse_mode: "Markdown",
      });
    } catch (error) {
      console.log(error);
      ctx.reply("An error occured. Please try again.");
    }
  });
});

bot.command("invite", async (ctx) => {
  queue.enqueue(async () => {
    await showLeaderboard(bot, ctx);
  });
});

// Handle incoming messages
bot.on("message", async (ctx) => {
  queue.enqueue(async () => {
    if (ctx.message.text === "/invite") {
      // Reply to the user who sent the /invite command
      await showLeaderboard(bot, ctx);
    }
  });
});

// Set bot commands for Telegram
bot.telegram.setMyCommands([
  { command: "start", description: "Start the example Bot" },
  {
    command: "myinvite",
    description: "Check your invite status",
  },
  {
    command: "invite",
    description: "See the referral leaderboard",
  },
]);

bot.launch();
