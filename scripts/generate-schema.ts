import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as z from 'zod';
import { AmoreConfigSchema, CONFIG_SCHEMA_FILENAME } from '../src/config/index';

const schema = z.toJSONSchema(AmoreConfigSchema, {
  io: 'input',
  target: 'draft-2020-12',
});

const output = {
  ...(schema as Record<string, unknown>),
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'ah-my-openresearch config',
  description: 'Configuration schema for ah-my-openresearch (amore).',
};

const outputPath = resolve(CONFIG_SCHEMA_FILENAME);

await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(`Generated ${CONFIG_SCHEMA_FILENAME}`);
