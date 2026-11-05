import type {
  APIInteractionDataResolvedChannel,
  APIMessageComponentButtonInteraction,
  APIMessageComponentSelectMenuInteraction,
  APIRole,
  APIUser,
} from 'discord-api-types/v10';

import type { modalResponse, replyResponse, updateResponse } from '#utils/response';
import type { SelectMenu, SelectType } from '#utils/select';

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

/** What each kind of select menu gives its handler for one picked item. */
export type SelectValue = {
  string: string;
  user: APIUser;
  role: APIRole;
  channel: APIInteractionDataResolvedChannel;
  mentionable: APIUser | APIRole;
};

/** What a select menu handler gets: the pick, the picked `values`, and ways to answer. */
export type SelectContext<V> = {
  interaction: APIMessageComponentSelectMenuInteraction;
  values: V[];
  reply: typeof replyResponse;
  update: typeof updateResponse;
  modal: typeof modalResponse;
};

/** A select menu made with `select()`, for the `selects` of a message and of `bot()`. */
export type Select<T extends SelectType = SelectType, V = SelectValue[T]> = SelectMenu & {
  type: T;
  run(c: SelectContext<V>): Response | Promise<Response>;
};
