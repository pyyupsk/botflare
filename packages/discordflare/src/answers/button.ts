import type { APIMessageComponentButtonInteraction } from 'discord-api-types/v10';

import { deferUpdate } from '#answers/defer';
import type { ButtonContext, ErrorHandler } from '#types';
import { splitId } from '#utils/id';
import { modalResponse, replyResponse, updateResponse } from '#utils/response';

export function answerButton(
  interaction: APIMessageComponentButtonInteraction,
  buttons: Record<string, (c: ButtonContext) => Response | Promise<Response>> | undefined,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const { name, value } = splitId(interaction.data.custom_id);
  const clicked = buttons?.[name];
  if (!clicked) return new Response(null, { status: 404 });

  return clicked({
    interaction,
    value,
    reply: replyResponse,
    update: updateResponse,
    modal: modalResponse,
    deferUpdate: deferUpdate(interaction, ctx, `button ${name}`, onError),
  });
}
