export type Upload = {
  name: string;
  data: Blob | ArrayBuffer | Uint8Array<ArrayBuffer> | string;
  description?: string;
};

export function attachmentsOf(
  files: Upload[],
): { id: string; filename: string; description?: string }[] {
  return files.map((file, i) => ({
    id: String(i),
    filename: file.name,
    ...(file.description !== undefined && { description: file.description }),
  }));
}

export function formOf(payload: unknown, files: Upload[]): FormData {
  const form = new FormData();
  form.append('payload_json', JSON.stringify(payload));
  files.forEach((file, i) => {
    const blob = file.data instanceof Blob ? file.data : new Blob([file.data]);
    form.append(`files[${i}]`, blob, file.name);
  });

  return form;
}

export async function uploadsOf(form: FormData): Promise<{ payload: unknown; files: Upload[] }> {
  const files: Upload[] = [];
  for (const [key, value] of form.entries()) {
    if (key.startsWith('files[') && typeof value !== 'string') {
      files.push({ name: value.name, data: value });
    }
  }

  const payload = form.get('payload_json');

  return { payload: typeof payload === 'string' ? (JSON.parse(payload) as unknown) : null, files };
}
