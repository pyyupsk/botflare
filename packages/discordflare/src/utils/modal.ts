import type { APIModalSubmissionComponent, APIModalSubmitInteraction } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import type { ReplyOptions } from '#utils/message';

export type Fields = Record<
  string,
  { label: string; style?: 'short' | 'paragraph'; required?: boolean }
>;

export type Modal<F extends Fields = Fields> = {
  id: string;
  title: string;
  fields: F;
  run(c: {
    interaction: APIModalSubmitInteraction;
    value: string | undefined;
    fields: {
      [K in keyof F]: F[K] extends { label: string; required?: true } ? string : string | undefined;
    };
    reply: (content: string, options?: ReplyOptions) => Response;
  }): Response | Promise<Response>;
};

export function modalData(
  modal: Modal,
  value?: string,
): Schemas['ModalInteractionCallbackRequestData'] {
  return {
    custom_id: value === undefined ? modal.id : `${modal.id}:${value}`,
    title: modal.title,
    components: Object.entries(modal.fields).map(([name, field]) => ({
      type: 18,
      label: field.label,
      component: {
        type: 4,
        custom_id: name,
        style: field.style === 'paragraph' ? 2 : 1,
        required: field.required ?? true,
      },
    })),
  };
}

export function fieldValues(
  components: APIModalSubmissionComponent[],
): Record<string, string | undefined> {
  const inputs = components.flatMap((row) => {
    if ('component' in row) return [row.component];
    if ('components' in row) return row.components;
    return [];
  });

  const values: Record<string, string | undefined> = {};
  for (const input of inputs) {
    if ('value' in input && typeof input.value === 'string')
      values[input.custom_id] = input.value || undefined;
  }

  return values;
}
