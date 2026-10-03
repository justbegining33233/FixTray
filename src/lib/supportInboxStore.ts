import prisma from '@/lib/prisma';
import { addressList } from '@/lib/platformEmailAccess';
import type { PlatformMailDetail, PlatformMailSummary } from '@/lib/platformMailbox';

type StoredMessage = {
  id: string;
  sender: string;
  recipients: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
};

function toSummary(row: StoredMessage): PlatformMailSummary {
  return {
    id: row.id,
    from: row.sender,
    to: addressList(row.recipients),
    subject: row.subject,
    createdAt: row.receivedAt.toISOString(),
    lastEvent: 'received',
  };
}

export async function rememberSupportInboxMessage(message: PlatformMailDetail): Promise<void> {
  try {
    await prisma.supportInboxMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        sender: message.from,
        recipients: message.to.join(', '),
        subject: message.subject,
        bodyText: message.text,
        receivedAt: message.createdAt && !Number.isNaN(Date.parse(message.createdAt))
          ? new Date(message.createdAt)
          : new Date(),
      },
      update: {
        sender: message.from,
        recipients: message.to.join(', '),
        subject: message.subject,
        bodyText: message.text,
      },
    });
  } catch (error) {
    console.error('[supportInbox] could not store message', error instanceof Error ? error.message : '');
  }
}

/** Keep a listed message without erasing a body the webhook or an open already saved. */
export async function rememberSupportInboxSummary(message: PlatformMailSummary): Promise<void> {
  const receivedAt = message.createdAt && !Number.isNaN(Date.parse(message.createdAt))
    ? new Date(message.createdAt)
    : new Date();
  try {
    await prisma.supportInboxMessage.upsert({
      where: { id: message.id },
      create: {
        id: message.id,
        sender: message.from,
        recipients: message.to.join(', '),
        subject: message.subject,
        bodyText: '',
        receivedAt,
      },
      update: {
        sender: message.from,
        recipients: message.to.join(', '),
        subject: message.subject,
        receivedAt,
      },
    });
  } catch (error) {
    console.error('[supportInbox] could not store message', error instanceof Error ? error.message : '');
  }
}

export async function listRememberedSupportInbox(): Promise<PlatformMailSummary[]> {
  try {
    const rows = await prisma.supportInboxMessage.findMany({
      orderBy: { receivedAt: 'desc' },
      take: 50,
    });
    return rows.map(toSummary);
  } catch (error) {
    console.error('[supportInbox] could not list messages', error instanceof Error ? error.message : '');
    return [];
  }
}

export async function readRememberedSupportMail(id: string): Promise<PlatformMailDetail | null> {
  try {
    const row = await prisma.supportInboxMessage.findUnique({ where: { id } });
    if (!row) return null;
    return { ...toSummary(row), text: row.bodyText };
  } catch (error) {
    console.error('[supportInbox] could not read message', error instanceof Error ? error.message : '');
    return null;
  }
}
