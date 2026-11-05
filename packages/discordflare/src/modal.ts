import type { Fields, Modal } from '#utils/modal';

/**
 * Declares a modal: a form Discord shows in a popup. Open it with `c.modal()` from a command or a
 * button, and add it to the `modals` of {@link bot} so the bot gets what the user typed.
 *
 * @param config What Discord shows in the popup.
 * @param config.id The id Discord sends back when the user submits the form.
 * @param config.title The title of the popup.
 * @param config.fields The text fields, keyed by name. A field is required unless `required` is `false`.
 * @param run Answers the submitted form. `c.fields` holds the text of each field, keyed by name.
 *   A field that is not required and left empty is `undefined`.
 *   To carry a value through the form, open it with `c.modal(form, value)`. The handler gets that
 *   value as `c.value`, such as the id of the item the form edits.
 * @returns The modal, for `c.modal()` and the `modals` of {@link bot}.
 * @example
 * const feedback = modal(
 *   { id: 'feedback', title: 'Feedback', fields: { text: { label: 'Your idea', style: 'paragraph' } } },
 *   (c) => c.reply(`Thanks: ${c.fields.text}`),
 * );
 */
export function modal<const F extends Fields>(
  config: { id: string; title: string; fields: F },
  run: Modal<F>['run'],
): Modal<F> {
  return { id: config.id, title: config.title, fields: config.fields, run };
}
