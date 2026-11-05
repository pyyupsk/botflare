import { callDiscord } from '#lib/rest';
import type { ErrorHandler } from '#types';
import { type FollowUps, message } from '#utils/message';

export type AnswerContext = Pick<ExecutionContext, 'waitUntil'> & {
  afterAnswer?: (task: () => Promise<void>) => void;
};

export function followUps(
  interaction: { application_id: string; token: string },
  ctx: AnswerContext,
  where: string,
  onError?: ErrorHandler,
): FollowUps {
  const path = { webhook_id: interaction.application_id, webhook_token: interaction.token };
  const schedule = ctx.afterAnswer ?? ((task) => ctx.waitUntil(task()));

  return {
    after: (work) =>
      schedule(async () => {
        try {
          await work();
        } catch (error) {
          await onError?.(error, `${where} after`);
        }
      }),
    async followUp(content, options = {}) {
      const [error] = await callDiscord(null, 'post', '/webhooks/{webhook_id}/{webhook_token}', {
        path,
        body: message(content, options),
        files: options.files,
      });

      return error;
    },
    async editReply(content, options = {}) {
      const [error] = await callDiscord(
        null,
        'patch',
        '/webhooks/{webhook_id}/{webhook_token}/messages/@original',
        { path, body: message(content, options), files: options.files },
      );

      return error;
    },
    async deleteReply() {
      const [error] = await callDiscord(
        null,
        'delete',
        '/webhooks/{webhook_id}/{webhook_token}/messages/@original',
        { path },
      );

      return error;
    },
  };
}
