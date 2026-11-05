import type { APIMessageComponentButtonInteraction } from 'discord-api-types/v10';

import { deferUpdate } from '#answers/defer';
import type { ButtonContext, ErrorHandler } from '#types';
import { modalResponse, replyResponse, updateResponse } from '#utils/response';

export function answerButton(
  interaction: APIMessageComponentButtonInteraction,
  buttons: Record<string, (c: ButtonContext) => Response | Promise<Response>> | undefined,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const id = interaction.data.custom_id;
  const colon = id.indexOf(':');
  const name = colon === -1 ? id : id.slice(0, colon);
  const clicked = buttons?.[name];
  if (!clicked) return new Response(null, { status: 404 });

  return clicked({
    interaction,
    value: colon === -1 ? undefined : id.slice(colon + 1),
    reply: replyResponse,
    update: updateResponse,
    modal: modalResponse,
    deferUpdate: deferUpdate(interaction, ctx, `button ${name}`, onError),
  });
}
