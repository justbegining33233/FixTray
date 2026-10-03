import fs from 'fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmailsLayout } from '../src/app/admin/emails/EmailsLayout';

function markup(sendOpen: boolean): string {
  return renderToStaticMarkup(createElement(EmailsLayout, {
    sendOpen,
    onToggleSend: () => {},
    form: createElement('form', null,
      createElement('input', { 'aria-label': 'To' }),
      createElement('input', { 'aria-label': 'Subject' }),
      createElement('textarea', { 'aria-label': 'Message' }),
      createElement('button', { type: 'submit' }, 'Send'),
    ),
    inbox: createElement('section', null, createElement('h2', null, 'Inbox')),
  }));
}

describe('emails send disclosure', () => {
  it('starts closed so the form is not in the way of the inbox', () => {
    const page = fs.readFileSync('src/app/admin/emails/page.tsx', 'utf8');
    expect(page).toMatch(/const \[sendOpen, setSendOpen\] = useState\(false\)/);

    const closed = markup(false);
    expect(closed).toContain('aria-expanded="false"');
    expect(closed).not.toContain('<form');
    expect(closed).not.toContain('aria-label="To"');
    expect(closed).not.toContain('aria-label="Message"');
    expect(closed.indexOf('Send a message')).toBeGreaterThanOrEqual(0);
    expect(closed.indexOf('Send a message')).toBeLessThan(closed.indexOf('Inbox'));
  });

  it('shows the send form only after the control is opened, still above the inbox', () => {
    const open = markup(true);
    expect(open).toContain('aria-expanded="true"');
    expect(open).toContain('<form');
    expect(open).toContain('aria-label="To"');
    expect(open).toContain('aria-label="Subject"');
    expect(open).toContain('aria-label="Message"');
    const formAt = open.indexOf('<form');
    const inboxAt = open.indexOf('Inbox');
    expect(formAt).toBeGreaterThan(open.indexOf('Send a message'));
    expect(formAt).toBeLessThan(inboxAt);
  });
});
