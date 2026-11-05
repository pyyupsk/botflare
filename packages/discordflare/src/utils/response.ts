import type { Schemas } from '#lib/routes';
import { message, type MessageOptions, type ReplyOptions } from '#utils/message';
import { type Modal, modalData } from '#utils/modal';
import { formOf } from '#utils/upload';

export const PONG: Schemas['PongInteractionCallbackRequest'] = { type: 1 };
export const DEFERRED: Schemas['CreateMessageInteractionCallbackRequest'] = { type: 5 };
export const DEFERRED_EPHEMERAL: Schemas['CreateMessageInteractionCallbackRequest'] = {
  type: 5,
  data: { flags: 64 },
};

export const DEFERRED_UPDATE: Schemas['UpdateMessageInteractionCallbackRequest'] = { type: 6 };

function answer(response: object, options?: MessageOptions): Response {
  if (!options?.files?.length) return Response.json(response);

  return new Response(formOf(response, options.files));
}

export function replyResponse(content: string, options?: ReplyOptions): Response {
  const response: Schemas['CreateMessageInteractionCallbackRequest'] = {
    type: 4,
    data: message(content, options),
  };

  return answer(response, options);
}

export function updateResponse(content: string, options?: MessageOptions): Response {
  const response: Schemas['UpdateMessageInteractionCallbackRequest'] = {
    type: 7,
    data: message(content, options),
  };

  return answer(response, options);
}

export function modalResponse(form: Modal, value?: string): Response {
  const response: Schemas['ModalInteractionCallbackRequest'] = {
    type: 9,
    data: modalData(form, value),
  };

  return Response.json(response);
}
