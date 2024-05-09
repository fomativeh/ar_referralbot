const handleReferral = async (ctx, linkOwnerData) => {
  try {
    //Reward link owner
    const idOfReferredUser = ctx.from.id;
    const { referralCount, referredUsers } = linkOwnerData;

    const updatedLinkOwnerData = Object.assign(linkOwnerData, {
      referralCount: referralCount + 1,
      referredUsers: [...referredUsers, idOfReferredUser],
    });
    console.log(updatedLinkOwnerData)

    await updatedLinkOwnerData.save();

    const replyText = `
*Welcome to example!*

Referred by: @${linkOwnerData.username}

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

    ctx.reply(replyText, { ...replyMarkup, parse_mode:"Markdown" });
  } catch (error) {
    console.log(error);
    ctx.reply("An error occured. Please try again");
  }
};

module.exports = handleReferral;
