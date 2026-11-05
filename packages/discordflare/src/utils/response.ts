import type { Schemas } from '#lib/routes';
import { message, type MessageOptions, type ReplyOptions } from '#utils/message';
import { type Modal, modalData } from '#utils/modal';

export const PONG: Schemas['PongInteractionCallbackRequest'] = { type: 1 };
export const DEFERRED: Schemas['CreateMessageInteractionCallbackRequest'] = { type: 5 };
export const DEFERRED_EPHEMERAL: Schemas['CreateMessageInteractionCallbackRequest'] = {
  type: 5,
  data: { flags: 64 },
};

export function replyResponse(content: string, options?: ReplyOptions): Response {
  const response: Schemas['CreateMessageInteractionCallbackRequest'] = {
    type: 4,
    data: message(content, options),
  };

  return Response.json(response);
}

export function updateResponse(content: string, options?: MessageOptions): Response {
  const response: Schemas['UpdateMessageInteractionCallbackRequest'] = {
    type: 7,
    data: message(content, options),
  };

  return Response.json(response);
}

export function modalResponse(form: Modal): Response {
  const response: Schemas['ModalInteractionCallbackRequest'] = { type: 9, data: modalData(form) };

  return Response.json(response);
}
