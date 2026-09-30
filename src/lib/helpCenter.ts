/** Public how-to articles. Each one describes a flow the app already has. */

export interface HelpArticle {
  slug: string;
  title: string;
  summary: string;
  body: string[];
}

export const HELP_ARTICLES: HelpArticle[] = [
  {
    slug: 'approve-an-estimate',
    title: 'How to approve an estimate',
    summary: 'A customer accepts an estimate by signing it. Verbal approval does not create a work authorization.',
    body: [
      'Sign in as the customer and open My Estimates.',
      'Open the pending estimate. Accept or deny requires a signature in the box.',
      'Choose Sign and accept. That records the signature, creates a signed work authorization, and sets the job to in progress.',
      'The shop does not get a separate automatic handoff. A person at the shop continues the job from the work order.',
    ],
  },
  {
    slug: 'deny-an-estimate',
    title: 'How a customer denies an estimate',
    summary: 'Denying closes the quote. It does not create a work authorization, and it does not send the job to the next step by itself.',
    body: [
      'Sign in as the customer and open My Estimates.',
      'On the pending estimate, choose Deny Estimate, sign in the box, and choose Sign and deny.',
      'The quote is closed and the job status becomes Denied Estimate. No work authorization is created.',
      'The shop, a manager, and the assigned technician get a notification flag that says the denial needs a look. The flag does not approve, deny, or move the job.',
      'A person at the shop can open the work order and reissue the estimate if they want to send a new quote.',
    ],
  },
  {
    slug: 'add-a-tech',
    title: 'How to add a tech',
    summary: 'A shop owner adds a technician from Manage Team.',
    body: [
      'Sign in as the shop owner and open Manage Team.',
      'Choose Add Team Member. The employee number is filled in for you.',
      'Choose Technician, then enter the full name, email, phone, and password.',
      'Choose Add Member. They can sign in with that email and work assigned jobs.',
    ],
  },
  {
    slug: 'turn-by-turn',
    title: 'How a technician starts turn-by-turn directions',
    summary: 'Directions run in the browser on the job screen. There is no store app.',
    body: [
      'Sign in as the technician and open the road call or assigned job.',
      'On the job screen, choose Start turn-by-turn and allow location when the browser asks.',
      'The job screen lists each driving step and draws the route. Follow the highlighted step. If you leave the route, choose Reroute.',
      'Starting directions does not change the job status. En route and the other steps are still set by a person.',
      'You can also open driving directions in the browser with Google Maps or Apple Maps. A mobile app is in development. Until then FixTray works on the web and in a phone browser. On iPhone, use Safari and Add to Home Screen.',
    ],
  },
  {
    slug: 'notification-flag',
    title: 'What a notification flag means',
    summary: 'A flag means something happened and a person should look. It does not approve, deny, or hand the job off.',
    body: [
      'When a customer denies an estimate, the notification carries a flag labeled Needs a look.',
      'The flag shows on a banner while you are signed in, and as a FLAG mark on that notification in the bell.',
      'Open the job to read it. Choose Mark looked at when you have seen it. That only clears the flag.',
      'The job stays where a person left it. The flag does not approve the estimate, deny it again, or pass the job to the next step.',
    ],
  },
  {
    slug: 'email-support',
    title: 'How to reach email support',
    summary: 'Email support stays available next to the help center.',
    body: [
      'Write to support@fixtray.app.',
      'You can also use the contact form. Help articles on this page cover the short how-tos. Email is for everything else.',
    ],
  },
];

export function searchHelpArticles(query: string, articles: HelpArticle[] = HELP_ARTICLES): HelpArticle[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return articles;
  return articles.filter((article) => {
    const haystack = `${article.title} ${article.summary} ${article.body.join(' ')}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function helpArticlePath(slug: string): string {
  return `/help/${slug}`;
}
