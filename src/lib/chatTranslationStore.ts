import { NextRequest } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureProductionColumns } from '@/lib/ensureProductionColumns';
import { DEFAULT_LOCALE, LOCALE_COOKIE, normalizeLocale, type AppLocale } from '@/lib/locale';
import {
  applyProviderResult,
  resolveStoredDisplay,
  translateChatText,
  type ProviderOutcome,
} from '@/lib/chatTranslation';

const CONCURRENCY = 4;
const MAX_PROVIDER_CALLS = 24;

type LocaleParty = { role: string; id: string };

type TextRow = {
  id: string;
  text: string;
  sourceLocale: string | null;
  translations: string | null;
};

export async function readPreferredLocale(role: string, id: string): Promise<string | null> {
  if (!id) return null;
  try {
    await ensureProductionColumns();
    if (role === 'customer') {
      const row = await prisma.customer.findUnique({ where: { id }, select: { preferredLocale: true } });
      return row?.preferredLocale ?? null;
    }
    if (role === 'shop') {
      const row = await prisma.shop.findUnique({ where: { id }, select: { preferredLocale: true } });
      return row?.preferredLocale ?? null;
    }
    if (role === 'tech' || role === 'manager') {
      const row = await prisma.tech.findUnique({ where: { id }, select: { preferredLocale: true } });
      return row?.preferredLocale ?? null;
    }
    if (role === 'admin' || role === 'superadmin') {
      const row = await prisma.admin.findUnique({ where: { id }, select: { preferredLocale: true } });
      return row?.preferredLocale ?? null;
    }
  } catch {
    console.warn('[chatTranslation] could not read preferred locale');
  }
  return null;
}

export async function writePreferredLocale(role: string, id: string, locale: AppLocale): Promise<boolean> {
  if (!id) return false;
  const data = { preferredLocale: locale };
  try {
    await ensureProductionColumns();
    if (role === 'customer') {
      await prisma.customer.update({ where: { id }, data });
      return true;
    }
    if (role === 'shop') {
      await prisma.shop.update({ where: { id }, data });
      return true;
    }
    if (role === 'tech' || role === 'manager') {
      await prisma.tech.update({ where: { id }, data });
      return true;
    }
    if (role === 'admin' || role === 'superadmin') {
      await prisma.admin.update({ where: { id }, data });
      return true;
    }
  } catch {
    console.warn('[chatTranslation] could not save preferred locale');
  }
  return false;
}

/** Cookie wins for the person who is online. The stored locale is what we know when they are not. */
export async function resolveAccountLocale(
  request: NextRequest,
  user: { id: string; role: string },
): Promise<AppLocale> {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie?.trim()) return normalizeLocale(cookie);
  const stored = await readPreferredLocale(user.role, user.id);
  if (stored) return normalizeLocale(stored);
  return DEFAULT_LOCALE;
}

export async function preferredLocalesFor(people: LocaleParty[]): Promise<AppLocale[]> {
  const found = await Promise.all(people.map(async (person) => {
    const stored = await readPreferredLocale(person.role, person.id);
    return stored ? normalizeLocale(stored) : null;
  }));
  return Array.from(new Set(found.filter((locale): locale is AppLocale => Boolean(locale))));
}

async function translateShared(
  cache: Map<string, Promise<ProviderOutcome>>,
  state: { calls: number },
  caption: string,
  viewer: AppLocale,
  source: AppLocale | null,
): Promise<ProviderOutcome> {
  const key = `${source ?? ''}\0${viewer}\0${caption}`;
  const existing = cache.get(key);
  if (existing) return existing;
  if (state.calls >= MAX_PROVIDER_CALLS) return { ok: false };
  state.calls += 1;
  const pending = translateChatText(caption, viewer, source);
  cache.set(key, pending);
  return pending;
}

async function fillDisplays(
  rows: TextRow[],
  viewerLocale: string,
  save: (id: string, patch: { sourceLocale: string | null; translations: string | null }) => Promise<void>,
): Promise<Map<string, { displayText: string; originalText: string }>> {
  const viewer = normalizeLocale(viewerLocale);
  const planned = rows.map((row) => ({
    row,
    decision: resolveStoredDisplay({
      body: row.text,
      sourceLocale: row.sourceLocale,
      translations: row.translations,
      viewerLocale: viewer,
    }),
  }));
  const pending = planned.filter((item) => item.decision.needsProvider);
  const cache = new Map<string, Promise<ProviderOutcome>>();
  const state = { calls: 0 };
  const displays = new Map<string, { displayText: string; originalText: string }>();
  let index = 0;

  async function worker() {
    while (index < pending.length) {
      const current = pending[index];
      index += 1;
      const outcome = await translateShared(
        cache,
        state,
        current.decision.caption,
        current.decision.viewer,
        current.decision.source,
      );
      const applied = applyProviderResult({
        body: current.row.text,
        sourceLocale: current.row.sourceLocale,
        translations: current.row.translations,
        viewerLocale: viewer,
        outcome,
      });
      displays.set(current.row.id, { displayText: applied.displayBody, originalText: applied.originalBody });
      if (!applied.changed) continue;
      try {
        await save(current.row.id, {
          sourceLocale: applied.sourceLocale,
          translations: applied.translations,
        });
      } catch {
        console.warn('[chatTranslation] could not store a translation');
      }
    }
  }

  const workers = Math.min(CONCURRENCY, pending.length);
  if (workers > 0) await Promise.all(Array.from({ length: workers }, () => worker()));

  for (const item of planned) {
    if (displays.has(item.row.id)) continue;
    displays.set(item.row.id, { displayText: item.decision.displayBody, originalText: item.row.text });
  }
  return displays;
}

function withDisplay<T extends { id: string }>(
  rows: T[],
  displays: Map<string, { displayText: string; originalText: string }>,
  textOf: (row: T) => string,
): Array<T & { displayBody: string; originalBody: string }> {
  return rows.map((row) => {
    const shown = displays.get(row.id);
    const original = textOf(row);
    return {
      ...row,
      displayBody: shown?.displayText ?? original,
      originalBody: original,
    };
  });
}

export async function decorateDirectMessages<T extends {
  id: string;
  body: string;
  sourceLocale?: string | null;
  translations?: string | null;
}>(rows: T[], viewerLocale: string) {
  await ensureProductionColumns();
  const displays = await fillDisplays(
    rows.map((row) => ({
      id: row.id,
      text: row.body,
      sourceLocale: row.sourceLocale ?? null,
      translations: row.translations ?? null,
    })),
    viewerLocale,
    async (id, patch) => {
      await prisma.directMessage.update({ where: { id }, data: patch });
    },
  );
  return withDisplay(rows, displays, (row) => row.body);
}

export async function decorateWorkOrderMessages<T extends {
  id: string;
  body: string;
  sourceLocale?: string | null;
  translations?: string | null;
}>(rows: T[], viewerLocale: string) {
  await ensureProductionColumns();
  const displays = await fillDisplays(
    rows.map((row) => ({
      id: row.id,
      text: row.body,
      sourceLocale: row.sourceLocale ?? null,
      translations: row.translations ?? null,
    })),
    viewerLocale,
    async (id, patch) => {
      await prisma.message.update({ where: { id }, data: patch });
    },
  );
  return withDisplay(rows, displays, (row) => row.body);
}

export async function decorateCustomerMessages<T extends {
  id: string;
  content: string;
  sourceLocale?: string | null;
  translations?: string | null;
}>(rows: T[], viewerLocale: string) {
  await ensureProductionColumns();
  const displays = await fillDisplays(
    rows.map((row) => ({
      id: row.id,
      text: row.content,
      sourceLocale: row.sourceLocale ?? null,
      translations: row.translations ?? null,
    })),
    viewerLocale,
    async (id, patch) => {
      await prisma.customerMessage.update({ where: { id }, data: patch });
    },
  );
  return withDisplay(rows, displays, (row) => row.content);
}

export async function decoratePortalMessages<T extends {
  id: string;
  body: string;
  sourceLocale?: string | null;
  translations?: string | null;
}>(rows: T[], viewerLocale: string) {
  await ensureProductionColumns();
  const displays = await fillDisplays(
    rows.map((row) => ({
      id: row.id,
      text: row.body,
      sourceLocale: row.sourceLocale ?? null,
      translations: row.translations ?? null,
    })),
    viewerLocale,
    async (id, patch) => {
      await prisma.portalChatMessage.update({ where: { id }, data: patch });
    },
  );
  return withDisplay(rows, displays, (row) => row.body);
}

/** Fill the locale map after the row is stored. A provider failure leaves the original in place. */
export async function stampOutgoingTranslation(input: {
  body: string;
  sourceLocale: string;
  audiences: LocaleParty[];
  persist: (fields: { sourceLocale: string; translations: string | null }) => Promise<void>;
}): Promise<void> {
  try {
    const source = normalizeLocale(input.sourceLocale);
    const targets = (await preferredLocalesFor(input.audiences)).filter((locale) => locale !== source);
    let translations: string | null = null;
    let learned = source;
    for (const target of targets) {
      const decision = resolveStoredDisplay({
        body: input.body,
        sourceLocale: learned,
        translations,
        viewerLocale: target,
      });
      if (!decision.needsProvider) continue;
      const outcome = await translateChatText(decision.caption, target, learned);
      const applied = applyProviderResult({
        body: input.body,
        sourceLocale: learned,
        translations,
        viewerLocale: target,
        outcome,
      });
      learned = applied.sourceLocale ? normalizeLocale(applied.sourceLocale) : learned;
      translations = applied.translations;
    }
    if (!translations) return;
    await input.persist({ sourceLocale: learned, translations });
  } catch {
    console.warn('[chatTranslation] outgoing translation failed');
  }
}
