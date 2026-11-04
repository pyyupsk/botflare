import type { GatewayIntentBits } from 'discord-api-types/v10';

export type Intent = Exclude<
  keyof typeof GatewayIntentBits,
  'GuildBans' | 'GuildEmojisAndStickers'
>;

const BITS: Record<Intent, GatewayIntentBits> = {
  Guilds: 1,
  GuildMembers: 2,
  GuildModeration: 4,
  GuildExpressions: 8,
  GuildIntegrations: 16,
  GuildWebhooks: 32,
  GuildInvites: 64,
  GuildVoiceStates: 128,
  GuildPresences: 256,
  GuildMessages: 512,
  GuildMessageReactions: 1024,
  GuildMessageTyping: 2048,
  DirectMessages: 4096,
  DirectMessageReactions: 8192,
  DirectMessageTyping: 16384,
  MessageContent: 32768,
  GuildScheduledEvents: 65536,
  AutoModerationConfiguration: 1048576,
  AutoModerationExecution: 2097152,
  GuildMessagePolls: 16777216,
  DirectMessagePolls: 33554432,
};

export function intentBits(names: Intent[]): number {
  return names.reduce((bits, name) => bits | BITS[name], 0);
}
