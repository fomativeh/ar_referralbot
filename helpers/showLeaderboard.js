const User = require("../models/userModel");

// Function to get the price based on position or referral count if less than 10 users in the database
function getPrice(position) {
  switch (position) {
    case 1:
      return "7000$";
    case 2:
      return "4550$";
    case 3:
      return "2957$";
    case 4:
      return "1922$";
    case 5:
      return "1249$";
    case 6:
      return "812$";
    case 7:
      return "527$";
    case 8:
      return "343$";
    case 9:
      return "223$";
    case 10:
      return "144$";
    default:
      return ""; // If position is not in top 10, return empty string
  }
}

const showLeaderboard = async (bot, ctx) => {
  try {
    // Access the message object
    const messageObject = ctx.message;

    // Get the message ID
    const messageId = messageObject.message_id;

    // Find users with non-zero referrals and sort them by referral count in descending order
    let topReferrers = await User.find({ referralCount: { $gt: 0 } })
      .sort({ referralCount: -1 })
      .limit(10);

    let message = "🥳 List of top 10 referrals ✨\n\n";

    // Iterate over top referrers and construct the message
    if (topReferrers.length > 0) {
      topReferrers.forEach((user, index) => {
        const position = index + 1;
        const price = getPrice(position);
        const pronoun = user.referralCount>1?`people`:`person`;
        message += `🎖${position}- ${price} @${user.username} invited ${user.referralCount.toLocaleString()} ${pronoun}\n\n`;
      });
    }

    message +=
      "[Click here to participate😎](https://t.me/example_Bot)";

    // Send the message if users are found
    if (topReferrers.length > 0) {
      //For a private chat

      await ctx.reply(message, { parse_mode: "Markdown", reply_to_message_id: messageId });
    }
  } catch (error) {
    console.log(error);
  }
};

module.exports = showLeaderboard;
