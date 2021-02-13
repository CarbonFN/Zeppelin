import { guildCommand } from "knub";
import { CountersPluginType } from "../types";
import { commandTypeHelpers as ct } from "../../../commandTypes";
import { sendErrorMessage } from "../../../pluginUtils";
import { resolveChannel, waitForReply } from "knub/dist/helpers";
import { TextChannel, User } from "eris";
import { resolveUser, UnknownUser } from "../../../utils";

export const ViewCounterCmd = guildCommand<CountersPluginType>()({
  trigger: ["counters view", "counter view", "viewcounter"],
  permission: "can_view",

  signature: [
    {
      counterName: ct.string(),
      user: ct.resolvedUserLoose(),
      channel: ct.textChannel(),
    },
    {
      counterName: ct.string(),
      user: ct.resolvedUserLoose(),
    },
    {
      counterName: ct.string(),
      channel: ct.textChannel(),
    },
    {
      counterName: ct.string(),
      user: ct.resolvedUserLoose(),
      channel: ct.textChannel(),
    },
    {
      counterName: ct.string(),
    },
  ],

  async run({ pluginData, message, args }) {
    const config = pluginData.config.getForMessage(message);
    const counter = config.counters[args.counterName];
    const counterId = pluginData.state.counterIds[args.counterName];
    if (!counter || !counterId) {
      sendErrorMessage(pluginData, message.channel, `Unknown counter: ${args.counterName}`);
      return;
    }

    if (counter.can_view === false) {
      sendErrorMessage(pluginData, message.channel, `Missing permissions to view this counter's values`);
      return;
    }

    if (args.channel && !counter.per_channel) {
      sendErrorMessage(pluginData, message.channel, `This counter is not per-channel`);
      return;
    }

    if (args.user && !counter.per_user) {
      sendErrorMessage(pluginData, message.channel, `This counter is not per-user`);
      return;
    }

    let channel = args.channel;
    if (!channel && counter.per_channel) {
      message.channel.createMessage(`Which channel's counter value would you like to view?`);
      const reply = await waitForReply(pluginData.client, message.channel, message.author.id);
      if (!reply || !reply.content) {
        sendErrorMessage(pluginData, message.channel, "Cancelling");
        return;
      }

      const potentialChannel = resolveChannel(pluginData.guild, reply.content);
      if (!potentialChannel || !(potentialChannel instanceof TextChannel)) {
        sendErrorMessage(pluginData, message.channel, "Channel is not a text channel, cancelling");
        return;
      }

      channel = potentialChannel;
    }

    let user = args.user;
    if (!user && counter.per_user) {
      message.channel.createMessage(`Which user's counter value would you like to view?`);
      const reply = await waitForReply(pluginData.client, message.channel, message.author.id);
      if (!reply || !reply.content) {
        sendErrorMessage(pluginData, message.channel, "Cancelling");
        return;
      }

      const potentialUser = await resolveUser(pluginData.client, reply.content);
      if (!potentialUser) {
        sendErrorMessage(pluginData, message.channel, "Unknown user, cancelling");
        return;
      }

      user = potentialUser;
    }

    const value = await pluginData.state.counters.getCurrentValue(counterId, channel?.id ?? null, user?.id ?? null);
    const finalValue = value ?? counter.initial_value;
    const counterName = counter.name || args.counterName;

    if (channel && user) {
      message.channel.createMessage(`${counterName} for <@!${user.id}> in <#${channel.id}> is ${finalValue}`);
    } else if (channel) {
      message.channel.createMessage(`${counterName} in <#${channel.id}> is ${finalValue}`);
    } else if (user) {
      message.channel.createMessage(`${counterName} for <@!${user.id}> is ${finalValue}`);
    } else {
      message.channel.createMessage(`${counterName} is ${finalValue}`);
    }
  },
});