import "dotenv-defaults/config";
import axios from "axios";
import cloneDeep from "lodash/cloneDeep";

const MessageTemplate = {
  content: "",
  embeds: [
    {
      title: "",
      description: "",
      color: 16711680,
      fields: [],
      footer: {
        text: "via ncn-backend",
      },
      timestamp: "2022-01-13T07:09:00.000Z",
    },
  ],
  username: "NTUCourse Neo",
  avatar_url:
    "https://external-preview.redd.it/UEwzwB-90sxfOxpN5kjf3qmfSLS6o-sat995maKZS5Q.png?auto=webp&s=21032b88ac0ee2ee73a2dda37d3560ae1277cfc1",
};

export const MessageTypes = {
  Error: {
    title: "Error",
    color: 16711680,
  },
  Warning: {
    title: "Warning",
    color: 16776960,
  },
  Info: {
    title: "Info",
    color: 39423,
  },
  Success: {
    title: "Success",
    color: 65379,
  },
};

export async function sendWebhookMessage(messageType, description, fields) {
  if (process.env.ENV === "dev") {
    return;
  }
  try {
    const msg = cloneDeep(MessageTemplate);
    if (
      messageType === MessageTypes.Error ||
      messageType === MessageTypes.Warning
    ) {
      msg.content = "<@&932646597370720319>\n" + description;
    } else {
      msg.content = description;
    }
    msg.embeds[0].description = description;
    msg.embeds[0].title = messageType.title;
    msg.embeds[0].color = messageType.color;
    msg.embeds[0].fields = fields;
    msg.embeds[0].timestamp = new Date().toISOString();
    const options = {
      method: "POST",
      url: process.env.DISCORD_WEBHOOK_URL,
      headers: { "content-type": "application/json" },
      data: JSON.stringify(msg),
    };
    await axios.request(options);
  } catch (err) {
    console.error(err);
  }
}
