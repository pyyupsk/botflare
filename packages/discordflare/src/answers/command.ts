import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import { editOriginal } from '#lib/discord';
import type { ErrorHandler } from '#types';
import { type Command, type Context, findCommand } from '#utils/command';
import { message } from '#utils/message';
import { type Options, optionValues } from '#utils/option';
import { DEFERRED, DEFERRED_EPHEMERAL, modalResponse, replyResponse } from '#utils/response';

export function answerCommand(
  interaction: APIChatInputApplicationCommandInteraction,
  commands: Map<string, Command>,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const { found, given, path: where } = findCommand(commands, interaction.data);
  if (!found || !('run' in found)) return new Response(null, { status: 404 });

  const defer: Context<Options>['defer'] = (work, options) => {
    const finish = async (): Promise<void> => {
      let edit = message('Something went wrong.');
      try {
        const done = await work();
        edit =
          typeof done === 'string'
            ? message(done)
            : message(done.content, {
                buttons: done.buttons,
                selects: done.selects,
                embeds: done.embeds,
                allowedMentions: done.allowedMentions,
              });
      } catch (error) {
        await onError?.(error, where);
      }

      const failed = await editOriginal(interaction.application_id, interaction.token, edit);
      if (failed) await onError?.(failed, where);
    };
    ctx.waitUntil(finish());

    return Response.json(options?.ephemeral ? DEFERRED_EPHEMERAL : DEFERRED);
  };

  return found.run({
    interaction,
    options: optionValues(given, interaction.data.resolved),
    reply: replyResponse,
    defer,
    modal: modalResponse,
  });
}
