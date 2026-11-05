import type { Routes } from '#lib/routes';

const API = 'https://discord.com/api/v10';
const TRIES = 3;

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';

type Init = { path?: Record<string, string>; query?: object; body?: unknown };

type Operation<P extends keyof Routes, M extends Method> =
  Routes[P] extends Record<M, infer O extends { args: unknown[]; result: unknown }> ? O : never;

/** Calls the Discord REST API. Each method takes a route from the Discord API spec. */
export type Rest = {
  [M in Method]: <
    P extends { [K in keyof Routes]: M extends keyof Routes[K] ? K : never }[keyof Routes],
  >(
    path: P,
    ...args: Operation<P, M>['args']
  ) => Promise<[Error, null] | [null, Operation<P, M>['result']]>;
};

export async function callDiscord<T>(
  token: string | null,
  method: Method,
  route: string,
  init: Init = {},
): Promise<[Error, null] | [null, T]> {
  const path = route.replace(/\{(\w+)\}/g, (_, name: string) =>
    encodeURIComponent(init.path?.[name] ?? ''),
  );

  const query = new URLSearchParams();
  for (const [name, value] of Object.entries(init.query ?? {})) {
    if (value !== undefined) query.set(name, String(value));
  }
  const url = query.size > 0 ? `${API}${path}?${query.toString()}` : `${API}${path}`;

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bot ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';
  const body = init.body === undefined ? undefined : JSON.stringify(init.body);

  const send = async (attempt: number): Promise<[Error, null] | [null, T]> => {
    const res = await fetch(url, { method: method.toUpperCase(), headers, body });

    if (res.status === 429 && attempt < TRIES) {
      const { retry_after } = (await res.json()) as { retry_after: number };
      await new Promise((resolve) => setTimeout(resolve, retry_after * 1000));
      return send(attempt + 1);
    }

    if (!res.ok) return [new Error(`Discord answered ${res.status}: ${await res.text()}`), null];
    const data: unknown = res.status === 204 ? null : await res.json();

    return [null, data as T];
  };

  return send(1);
}
