import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const LAB_LOG_ACTIONS = [
  'draft',
  'update',
  'edge-add',
  'handoff',
] as const;

export type LabLogAction = (typeof LAB_LOG_ACTIONS)[number];

export interface LabLogEntry {
  action: LabLogAction;
  subject: string;
  description?: string;
  affected?: string[];
  task?: string;
  result?: string;
  at?: Date;
}

export function formatLabTimestamp(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function formatAffected(affected: string[] | undefined): string {
  if (!affected || affected.length === 0) {
    return 'Affected:';
  }

  return `Affected: ${affected.map((target) => `[[${target}]]`).join(', ')}`;
}

export function formatLogEntry(entry: LabLogEntry): string {
  const lines = [
    `## [${formatLabTimestamp(entry.at)}] ${entry.action} | ${entry.subject}`,
  ];

  if (entry.action === 'handoff') {
    lines.push(`Task: ${entry.task ?? ''}`);
    lines.push(`Result: ${entry.result ?? ''}`);
  } else if (entry.description) {
    lines.push(entry.description);
  }

  lines.push(formatAffected(entry.affected));

  return `${lines.join('\n')}\n\n`;
}

export async function appendLabLogEntry(
  labDir: string,
  entry: LabLogEntry,
): Promise<void> {
  await appendFile(resolve(labDir, 'log.md'), formatLogEntry(entry), 'utf8');
}
