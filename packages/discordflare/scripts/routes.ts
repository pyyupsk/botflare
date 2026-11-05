import { writeFile } from 'node:fs/promises';

const SPEC_COMMIT = '4e75626a4cedfbc397d66f5491c79a9a62a71fd5';
const SPEC = `https://raw.githubusercontent.com/discord/discord-api-spec/${SPEC_COMMIT}/specs/openapi.json`;
const OUT = new URL('../src/lib/routes.ts', import.meta.url);
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

type Schema = {
  $ref?: string;
  const?: unknown;
  type?: string | string[];
  enum?: unknown[];
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean | Schema;
};
type Parameter = { name: string; in: string; required?: boolean; schema: Schema };
type Operation = {
  operationId: string;
  parameters?: (Parameter | { $ref: string })[];
  requestBody?: { required?: boolean; content: Record<string, { schema: Schema }> };
  responses: Record<string, { content?: Record<string, { schema: Schema }> }>;
};
type Spec = {
  paths: Record<
    string,
    { parameters?: (Parameter | { $ref: string })[] } & {
      [M in (typeof METHODS)[number]]?: Operation;
    }
  >;
  components: { schemas: Record<string, Schema>; parameters?: Record<string, Parameter> };
};

const key = (name: string): string =>
  /^[A-Za-z_$][\w$]*$/.test(name) ? name : JSON.stringify(name);

function typeOf(schema: Schema): string {
  if (schema.$ref) return `S[${JSON.stringify(schema.$ref.split('/').at(-1))}]`;
  if ('const' in schema) return JSON.stringify(schema.const);
  if (schema.enum?.length) return schema.enum.map((value) => JSON.stringify(value)).join(' | ');
  const union = schema.oneOf ?? schema.anyOf;
  if (union) return [...new Set(union.map(typeOf))].join(' | ');
  if (schema.allOf) return schema.allOf.map((s) => `(${typeOf(s)})`).join(' & ');

  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  const parts = new Set(types.map((type) => plain(type, schema)));

  return parts.has('unknown') ? 'unknown' : [...parts].join(' | ');
}

function plain(type: string | undefined, schema: Schema): string {
  if (type === 'string' || type === 'boolean' || type === 'null') return type;
  if (type === 'integer' || type === 'number') return 'number';
  if (type === 'array') return `(${schema.items ? typeOf(schema.items) : 'unknown'})[]`;
  if (type !== 'object') return 'unknown';

  const extra = schema.additionalProperties;
  const rest = typeof extra === 'object' ? `{ [key: string]: ${typeOf(extra)} }` : null;
  if (!schema.properties) return rest ?? 'Record<string, unknown>';

  const required = new Set(schema.required);
  const fields = Object.entries(schema.properties).map(
    ([name, field]) => `${key(name)}${required.has(name) ? '' : '?'}: ${typeOf(field)}`,
  );
  const shape = `{ ${fields.join('; ')} }`;

  return rest ? `${shape} & ${rest}` : shape;
}

const res = await fetch(SPEC);
if (!res.ok) throw new Error(`Cannot download the spec: ${res.status}`);

const spec = (await res.json()) as Spec;
const schemas = { ...spec.components.schemas };
const routes: string[] = [];

const resolve = (p: Parameter | { $ref: string }): Parameter =>
  '$ref' in p ? (spec.components.parameters?.[p.$ref.split('/').at(-1) ?? ''] as Parameter) : p;

for (const [path, item] of Object.entries(spec.paths)) {
  const methods: string[] = [];

  for (const method of METHODS) {
    const op = item[method];
    if (!op) continue;

    const id = op.operationId;
    const params = [...(item.parameters ?? []), ...(op.parameters ?? [])].map(resolve);
    const inPath = params.filter((p) => p.in === 'path');
    const inQuery = params.filter((p) => p.in === 'query');
    const body = op.requestBody?.content['application/json']?.schema;
    const ok = op.responses['200'] ?? op.responses['201'] ?? op.responses['202'];
    const result = ok?.content?.['application/json']?.schema;

    const fields: string[] = [];
    let required = false;

    if (inPath.length > 0) {
      fields.push(`path: { ${inPath.map((p) => `${key(p.name)}: string`).join('; ')} }`);
      required = true;
    }

    if (inQuery.length > 0) {
      schemas[`${id}_query`] = {
        type: 'object',
        properties: Object.fromEntries(inQuery.map((p) => [p.name, p.schema])),
        required: inQuery.filter((p) => p.required).map((p) => p.name),
      };
      const needed = inQuery.some((p) => p.required);
      fields.push(`query${needed ? '' : '?'}: S['${id}_query']`);
      required ||= needed;
    }

    if (body) {
      schemas[`${id}_body`] = body;
      const needed = op.requestBody?.required === true;
      fields.push(`body${needed ? '' : '?'}: S['${id}_body']`);
      required ||= needed;
    }

    if (op.requestBody?.content['multipart/form-data']) fields.push('files?: Upload[]');

    if (result) schemas[`${id}_result`] = result;

    let args = '[]';
    if (fields.length > 0) args = `[init${required ? '' : '?'}: { ${fields.join('; ')} }]`;

    methods.push(`${method}: { args: ${args}; result: ${result ? `S['${id}_result']` : 'null'} }`);
  }

  routes.push(`${JSON.stringify(path)}: { ${methods.join('; ')} };`);
}

const types = Object.entries(schemas).map(([name, schema]) => `${key(name)}: ${typeOf(schema)};`);

await writeFile(
  OUT,
  [
    `// Generated by scripts/routes.ts from discord/discord-api-spec@${SPEC_COMMIT}. Do not edit.`,
    "import type { Upload } from '#utils/upload';\n",
    `type S = {\n${types.join('\n')}\n};`,
    'export type { S as Schemas };',
    `export type Routes = {\n${routes.join('\n')}\n};`,
    '',
  ].join('\n'),
);

process.stdout.write(`Wrote ${routes.length} paths and ${types.length} types\n`);
