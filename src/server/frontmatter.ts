import YAML from 'yaml';

export interface ParsedDay {
  /** All frontmatter keys, including ones we don't manage (kept on rewrite). */
  data: Record<string, unknown>;
  note: string;
}

const FENCE_RE = /^---[ \t]*\n([\s\S]*?)\n?---[ \t]*(?:\n|$)/;

export function parseDay(raw: string): ParsedDay {
  const text = raw.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const match = FENCE_RE.exec(text);
  let data: Record<string, unknown> = {};
  let body = text;
  if (match) {
    body = text.slice(match[0].length);
    try {
      const parsed: unknown = YAML.parse(match[1] ?? '');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed frontmatter (e.g. a hand edit in Obsidian). Treat as empty.
    }
  }
  return { data, note: body.replace(/^\n+/, '').replace(/\s+$/, '') };
}

export function activitiesOf(data: Record<string, unknown>): string[] {
  const a = data.activities;
  const list = Array.isArray(a) ? a : a == null ? [] : [a];
  return list
    .filter(v => typeof v === 'string' || typeof v === 'number')
    .map(v => String(v).trim())
    .filter(Boolean);
}

export function updatedOf(data: Record<string, unknown>): string | null {
  const u = data.updated;
  if (u instanceof Date) return u.toISOString();
  return typeof u === 'string' ? u : null;
}

export function serializeDay(
  existing: Record<string, unknown>,
  activities: string[],
  updated: string,
  note: string
): string {
  // Spread first so existing keys keep their position; ours overwrite in place.
  const doc = new YAML.Document({ ...existing, activities, updated });
  const seq = doc.get('activities', true);
  if (YAML.isSeq(seq)) seq.flow = true;
  const fm = doc.toString({ lineWidth: 0, flowCollectionPadding: false });
  const body = note.replace(/\r\n?/g, '\n').replace(/\s+$/, '');
  return `---\n${fm}---\n${body ? `\n${body}\n` : ''}`;
}
