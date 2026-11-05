import type { APIMessageComponentButtonInteraction } from 'discord-api-types/v10';

import type { modalResponse, replyResponse, updateResponse } from '#utils/response';

/**
 * Gets an error from work that runs after Discord has its answer: the work of `c.defer()`, a gateway
 * event handler, or a request to Discord that failed. `where` names the command, event or step.
 */
export type ErrorHandler = (error: unknown, where: string) => void | Promise<void>;

/**
 * What a button handler gets: the click, the part of the id after `:` as `value`, and ways to answer.
 */
export type ButtonContext = {
  interaction: APIMessageComponentButtonInteraction;
  value: string | undefined;
  reply: typeof replyResponse;
  update: typeof updateResponse;
  modal: typeof modalResponse;
};
