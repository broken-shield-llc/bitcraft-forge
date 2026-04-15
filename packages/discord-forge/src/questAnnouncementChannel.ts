import { ChannelType } from "discord.js";

/** Channels where Forge may post quest embeds (guild text, announcement, threads). */
export function isQuestAnnouncementChannelType(type: ChannelType): boolean {
  switch (type) {
    case ChannelType.GuildText:
    case ChannelType.GuildAnnouncement:
    case ChannelType.PublicThread:
    case ChannelType.PrivateThread:
    case ChannelType.AnnouncementThread:
      return true;
    default:
      return false;
  }
}
