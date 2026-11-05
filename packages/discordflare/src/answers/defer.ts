import { editOriginal } from '#lib/discord';
import type { ErrorHandler } from '#types';
import type { Context } from '#utils/command';
import { message } from '#utils/message';
import type { Options } from '#utils/option';
import { DEFERRED, DEFERRED_EPHEMERAL } from '#utils/response';

export function deferAnswer(
  interaction: { application_id: string; token: string },
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  where: string,
  onError?: ErrorHandler,
): Context<Options>['defer'] {
  return (work, options) => {
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
}
