import { editOriginal } from '#lib/discord';
import type { ErrorHandler } from '#types';
import type { Context } from '#utils/command';
import { message } from '#utils/message';
import type { Options } from '#utils/option';
import { DEFERRED, DEFERRED_EPHEMERAL, DEFERRED_UPDATE } from '#utils/response';

type Work = Parameters<Context<Options>['defer']>[0];

function later(
  interaction: { application_id: string; token: string },
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  where: string,
  work: Work,
  onError?: ErrorHandler,
): void {
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
}

export function deferAnswer(
  interaction: { application_id: string; token: string },
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  where: string,
  onError?: ErrorHandler,
): Context<Options>['defer'] {
  return (work, options) => {
    later(interaction, ctx, where, work, onError);

    return Response.json(options?.ephemeral ? DEFERRED_EPHEMERAL : DEFERRED);
  };
}

export function deferUpdate(
  interaction: { application_id: string; token: string },
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  where: string,
  onError?: ErrorHandler,
): (work: Work) => Response {
  return (work) => {
    later(interaction, ctx, where, work, onError);

    return Response.json(DEFERRED_UPDATE);
  };
}
