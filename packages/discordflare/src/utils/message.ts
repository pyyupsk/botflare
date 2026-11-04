import type {
  APIActionRowComponent,
  APIButtonComponent,
  APIInteractionResponseCallbackData,
} from 'discord-api-types/v10';

export type Button = { id: string; label: string };

const PER_ROW = 5;

export function message(content: string, buttons?: Button[]): APIInteractionResponseCallbackData {
  if (!buttons) return { content };

  const rows: APIActionRowComponent<APIButtonComponent>[] = [];
  for (let i = 0; i < buttons.length; i += PER_ROW) {
    rows.push({
      type: 1,
      components: buttons
        .slice(i, i + PER_ROW)
        .map((b) => ({ type: 2, style: 1, label: b.label, custom_id: b.id })),
    });
  }

  return { content, components: rows };
}
