import fs from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MailScreen } from '../src/app/admin/emails/MailScreen';
import { SupportInboxList } from '../src/app/admin/emails/SupportInboxList';
import { preparePlatformSend, replyToReceivedMessage } from '../src/lib/platformMailbox';

const ROBIN_SUBJECT = 'Re: Action Transmission Specialists, want a free way to run your shop?';
const REQUEST_ID = '11111111-1111-4111-8111-111111111111';

const robin = {
  id: 'baa8f63c-893b-479e-9388-e1c29530534f',
  from: 'sales@transmission-repair-jacksonville.com',
  to: ['support@fixtray.app'],
  subject: ROBIN_SUBJECT,
  text: 'Unsubscribe',
};

function screen(composing: boolean, replyText = '') {
  return renderToStaticMarkup(createElement(MailScreen, {
    message: robin,
    loading: false,
    openError: '',
    composing,
    replyText,
    replyError: '',
    sending: false,
    onClose: () => {},
    onReply: () => {},
    onReplyText: () => {},
    onSend: () => {},
  }));
}

describe('email message screen', () => {
  it('opens the message over the page with a close control and a reply box at the bottom', () => {
    const page = fs.readFileSync('src/app/admin/emails/page.tsx', 'utf8');
    const inboxAt = page.indexOf('inbox={');
    const inboxEnd = page.indexOf(')}', inboxAt);
    const inboxBlock = page.slice(inboxAt, inboxEnd);
    expect(inboxBlock).not.toContain('MailScreen');
    expect(inboxBlock).not.toContain('selected.text');
    expect(page).toContain('createPortal');
    expect(page).toMatch(/const \[sendOpen, setSendOpen\] = useState\(false\)/);

    const list = renderToStaticMarkup(createElement(SupportInboxList, {
      emails: [{ id: robin.id, from: robin.from, subject: robin.subject }],
      loaded: true,
      error: '',
      selectedId: robin.id,
      onOpen: () => {},
    }));
    expect(list).toContain(ROBIN_SUBJECT);
    expect(list).not.toContain('Unsubscribe');

    const open = screen(false);
    expect(open).toContain('data-mail-screen="read"');
    expect(open).toContain('role="dialog"');
    expect(open).toContain('position:fixed');
    expect(open).toContain('z-index:1400');
    expect(open).toContain('aria-label="Close"');
    expect(open).toContain('Unsubscribe');
    expect(open).toContain('data-reply-box="1"');
    expect(open).toContain('aria-label="Reply"');
    expect(open.indexOf('Unsubscribe')).toBeLessThan(open.indexOf('data-reply-box="1"'));
    expect(open).not.toContain('aria-label="Reply message"');
    expect(open).not.toContain('<textarea');
  });

  it('replaces the open message with a reply that sends only the typed body', () => {
    const typed = 'We can look at the shop next week.';
    const compose = screen(true, typed);
    expect(compose).toContain('data-mail-screen="compose"');
    expect(compose).toContain('aria-label="Close"');
    expect(compose).not.toContain('Unsubscribe');
    expect(compose).not.toContain('data-reply-box="1"');
    expect(compose).toContain('FixTray Support &lt;support@fixtray.app&gt;');
    expect(compose).toContain('sales@transmission-repair-jacksonville.com');
    expect(compose).toContain(ROBIN_SUBJECT);
    expect(compose).toContain('aria-label="Reply message"');
    expect(compose).toContain(typed);
    expect(compose).not.toContain('<select');

    const draft = replyToReceivedMessage(robin);
    expect(draft).toEqual({
      from: 'FixTray Support <support@fixtray.app>',
      to: 'sales@transmission-repair-jacksonville.com',
      subject: ROBIN_SUBJECT,
    });
    const named = replyToReceivedMessage({
      from: 'Gomez Repairs <202andrescelle@gmail.com>',
      subject: 'Gomez Repairs, want a free way to run your shop?',
    });
    expect(named).toEqual({
      from: 'FixTray Support <support@fixtray.app>',
      to: '202andrescelle@gmail.com',
      subject: 'Re: Gomez Repairs, want a free way to run your shop?',
    });

    const prepared = preparePlatformSend({
      from: draft?.from,
      to: draft?.to,
      subject: draft?.subject,
      text: typed,
      requestId: REQUEST_ID,
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.data.from).toBe('FixTray Support <support@fixtray.app>');
    expect(prepared.data.to).toBe('sales@transmission-repair-jacksonville.com');
    expect(prepared.data.subject).toBe(ROBIN_SUBJECT);
    expect(prepared.data.text).toBe(typed);
    expect(prepared.data.html).toBe(`<p>${typed}</p>`);
    expect(prepared.data.html).not.toMatch(/<img|signature|footer|logo/i);
  });
});
