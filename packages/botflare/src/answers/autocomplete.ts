import type { APIApplicationCommandAutocompleteInteraction } from 'discord-api-types/v10';

import type { Schemas } from '#lib/routes';
import type { ErrorHandler } from '#types';
import { type Command, findCommand } from '#utils/command';
import type { Suggestion } from '#utils/option';

const MAX_CHOICES = 25;

export async function answerAutocomplete(
  interaction: APIApplicationCommandAutocompleteInteraction,
  commands: Map<string, Command>,
  onError?: ErrorHandler,
): Promise<Response> {
  const { found, given, path } = findCommand(commands, interaction.data);
  const focused = given.find((o) => 'focused' in o && o.focused);
  const suggest =
    found && 'options' in found && focused ? found.options[focused.name]?.autocomplete : undefined;
  if (!suggest || !focused || !('value' in focused)) return new Response(null, { status: 404 });

  let suggestions: Suggestion<unknown>[] = [];
  try {
    suggestions = await suggest({ interaction, value: String(focused.value) });
  } catch (error) {
    await onError?.(error, `${path} autocomplete`);
  }

  const choices = suggestions
    .slice(0, MAX_CHOICES)
    .map((s) => (typeof s === 'object' && s !== null ? s : { name: String(s), value: s }));
  const response = {
    type: 8,
    data: { choices },
  } as Schemas['ApplicationCommandAutocompleteCallbackRequest'];

  return Response.json(response);
}
