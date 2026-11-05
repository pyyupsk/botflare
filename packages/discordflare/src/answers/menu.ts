import type {
  APIContextMenuInteraction,
  APIMessageApplicationCommandInteraction,
  APIUserApplicationCommandInteraction,
  ApplicationCommandType,
} from 'discord-api-types/v10';

import { deferAnswer } from '#answers/defer';
import type { ErrorHandler } from '#types';
import type { ContextMenu, MenuType } from '#utils/command';
import { modalResponse, replyResponse } from '#utils/response';

const USER: ApplicationCommandType.User = 2;

export function answerMenu(
  interaction: APIContextMenuInteraction,
  menus: Map<string, ContextMenu>,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const { data } = interaction;
  const menu: MenuType = data.type === USER ? 'user' : 'message';
  const found = menus.get(`${menu}:${data.name}`);
  if (!found) return new Response(null, { status: 404 });

  const target =
    data.type === USER
      ? (interaction as APIUserApplicationCommandInteraction).data.resolved.users[data.target_id]
      : (interaction as APIMessageApplicationCommandInteraction).data.resolved.messages[
          data.target_id
        ];

  return found.run({
    interaction,
    target: target as never,
    reply: replyResponse,
    defer: deferAnswer(interaction, ctx, `${data.name} (${menu} menu)`, onError),
    modal: modalResponse,
  });
}
