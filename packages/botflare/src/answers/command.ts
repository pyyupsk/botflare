import type { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';

import { deferAnswer } from '#answers/defer';
import { type AnswerContext, followUps } from '#answers/follow';
import type { ErrorHandler } from '#types';
import { type Command, findCommand } from '#utils/command';
import { optionValues } from '#utils/option';
import { modalResponse, replyResponse } from '#utils/response';

export function answerCommand(
  interaction: APIChatInputApplicationCommandInteraction,
  commands: Map<string, Command>,
  ctx: AnswerContext,
  onError?: ErrorHandler,
): Response | Promise<Response> {
  const { found, given, path } = findCommand(commands, interaction.data);
  if (!found || !('run' in found)) return new Response(null, { status: 404 });

  return found.run({
    interaction,
    options: optionValues(given, interaction.data.resolved),
    reply: replyResponse,
    defer: deferAnswer(interaction, ctx, path, onError),
    modal: modalResponse,
    ...followUps(interaction, ctx, path, onError),
  });
}
