/**
 * The explanatory words on the public pages, as staff can edit them.
 *
 * Each block has a fixed address (slug), a title that says where it shows,
 * and the built-in wording. Staff change one under Admin → Content; the saved
 * version is a ContentPage row with the same slug and the category "block".
 * A block nobody has saved has no row, and the wording here is shown.
 *
 * A word in {curly braces} is filled in when the page is drawn: the contact
 * email from Settings, a limit, a link. Staff leave those as they are.
 *
 * The HTML here must already be in the form the save-time clean-up produces
 * (a unit test checks), so opening a block and saving it changes nothing.
 */

export type TextBlock = {
  slug: string;
  /** Where it shows, for the list in Admin → Content. */
  title: string;
  html: string;
};

export const TEXT_BLOCKS: readonly TextBlock[] = [
  // Join
  {
    slug: "join-hero",
    title: "Join page: line under the heading",
    html: "<p>Pick a membership that fits how you make — day passes, Community, Maker, and ways to support the shop.</p>",
  },
  {
    slug: "join-checkout",
    title: "Join page: how checkout works",
    html: "<p>Checkout stays on Zeffy. After you pay, this portal handles your account, waiver, certifications, and shop access.</p>",
  },
  {
    slug: "join-coming-tiers",
    title: "Join page: memberships that are not open yet",
    html: "<p>Maker Pro, Unlimited, and Team wait until the badge system can enforce priority booking and we have real usage data. Listed here so the ladder is complete — not joinable yet.</p>",
  },
  {
    slug: "join-try-first",
    title: "Join page: try a class first",
    html: "<p>Workshops, orientation, and open studio live on the Events calendar — not buried under memberships.</p>",
  },
  {
    slug: "join-directions",
    title: "Join page: directions",
    html: "<p>We're on the lower level at 611 SW 152nd St, Burien — access from SW 153rd between Ambaum and 6th Ave SW, behind Discover Burien. Look for the orange Maker Space doors.</p>",
  },
  {
    slug: "join-how-it-works",
    title: "Join page: how joining works",
    html: "<ul><li>Payments stay on our external checkout (Zeffy). This portal manages account, waiver, certifications, and shop access after staff activate you.</li><li>Class tickets include a day pass good for 30 days; join in that window and your first month can start at the Community rate.</li><li>Gift memberships and class + membership bundles roll out for the holiday season — ask staff or check Support.</li><li>Have a gift card or a code? Sign in and open <a href=\"/redeem\">Redeem a code</a>.</li></ul>",
  },

  // Support
  {
    slug: "support-hero",
    title: "Support page: line under the heading",
    html: "<p>Give to the general fund, grow scholarship seats, or pick something concrete off the wishlist. Business sponsorships plug into Discover Burien’s existing member roster.</p>",
  },
  {
    slug: "support-tax-note",
    title: "Support page: note about donations and tax",
    html: "<p>Donations open on Zeffy (or your configured nonprofit checkout). Tax deductibility depends on Discover Burien’s legal status — staff will note that on the live form before public launch.</p>",
  },
  {
    slug: "support-wishlist",
    title: "Support page: about the wishlist",
    html: "<p>The live list is on its own page: stations, supplies, prices, and a link to the exact product. Confirmed purchases come off that list.</p>",
  },

  // Wishlist
  {
    slug: "wishlist-hero",
    title: "Wishlist page: line under the heading",
    html: "<p>Everything the makerspace still needs, with a link to the exact product we picked. Give a whole station, or grab a $15 spool of filament. Every piece ends up in members’ hands at the bench.</p>",
  },
  {
    slug: "wishlist-step-1",
    title: "Wishlist page: step 1, pick something",
    html: "<p>Filter by area or by price. Each link goes to the exact product we picked, so everything in the space matches. Please buy that model; the same model from another store is fine. For lumber and paint, a Home Depot gift card works too.</p>",
  },
  {
    slug: "wishlist-step-2",
    title: "Wishlist page: step 2, tell us first",
    html: '<p>So two people don’t buy the same saw. Email <a href="mailto:{contactEmail}">{contactEmail}</a>, talk to staff in the shop, or message us on the makerspace Discord. You can also tap “I bought this” below — that stays pending until staff confirm, so the item stays on the list.</p>',
  },
  {
    slug: "wishlist-step-3",
    title: "Wishlist page: step 3, ship it or drop it off",
    html: "<p>We’ll give you the shipping address when you check in. Staff mark it purchased once it lands, then send a gift receipt for your taxes.</p>",
  },
  {
    slug: "wishlist-cash-and-sponsors",
    title: "Wishlist page: giving cash, and named sponsorships",
    html: '<p>Rather give cash toward a station? <a href="{donateUrl}" target="_blank" rel="noopener noreferrer">Donate here</a>. Big-ticket items (table saw, fume extractor, UV printer) also work as named sponsorships — ask about putting your business’s name on a station.</p>',
  },
  {
    slug: "wishlist-prices-note",
    title: "Wishlist page: note about prices",
    html: "<p>Prices are US retail as checked September–October 2026, before sales tax. They move with sales, so the store page is the final word. Prices marked “about” depend on the local store (lumber, pegboard) or haven’t been confirmed yet.</p>",
  },

  // Staff, history, events
  {
    slug: "staff-hero",
    title: "Staff page: line under the heading",
    html: "<p>Who keeps the makerspace open, and who teaches on the calendar. A program of Discover Burien.</p>",
  },
  {
    slug: "staff-teaching",
    title: "Staff page: how teaching a class works",
    html: "<p>Instructors propose a plan; staff decide if it fits the shop. Classes and fees run through Discover Burien. Members can teach without a space-rental fee; students do not need a membership to take a class.</p>",
  },
  {
    slug: "history-hero",
    title: "History page: line under the heading",
    html: "<p>A public shop in downtown Burien, run by Discover Burien — from a Farmers Market problem to memberships, certs, and classes in this portal.</p>",
  },
  {
    slug: "events-hero",
    title: "Events page: line under the heading",
    html: "<p>Classes, workshops, orientation, and open studio. Toggle calendar or list view, filter by type, and register when a checkout link is available.</p>",
  },
  {
    slug: "events-interest",
    title: "Events page: how interest lists work",
    html: "<p>Raise your hand for ideas the community wants. When enough people sign up, staff schedule the class and the interest list gets first dibs.</p>",
  },

  // Bounties, volunteer, equipment
  {
    slug: "bounties-hero",
    title: "Bounty board: line under the heading",
    html: "<p>Ask members to make something custom in the shop — signs, small runs, embroidered gear. Members claim a request so it isn’t double-booked.</p>",
  },
  {
    slug: "bounties-request-note",
    title: "Bounty board: note above the request form",
    html: "<p>No payment on this board — it’s a handshake with a member who can make it during shop hours. Share enough detail that someone can decide whether to claim it.</p>",
  },
  {
    slug: "volunteer-hero",
    title: "Volunteer page: line under the heading",
    html: "<p>Cover open hours as a Shop Steward, or champion a machine for two months. Three completed championships unlock the Shop lead track.</p>",
  },
  {
    slug: "equipment-hero",
    title: "Equipment page: line under the heading",
    html: "<p>Everything available in the makerspace and where it lives. Scan the QR on a machine for certifications, a getting-started video, and reservations.</p>",
  },
  {
    slug: "equipment-shop-intro",
    title: "Equipment page: line above the shop's equipment",
    html: "<p>What members have to work with, by area. Staff and the people who look after each area keep this list.</p>",
  },

  // Made here
  {
    slug: "made-hero",
    title: "Made here page: line under the heading",
    html: "<p>Projects from members learning, teaching, and making in Burien’s shop. Follow us on social for more — and share your own when you’re ready.</p>",
  },
  {
    slug: "made-bounty",
    title: "Made here page: asking for something custom",
    html: '<p>Need something custom made for a shop or project? <a href="/bounties#request">Post a bounty</a> — members claim requests and make them in the space.</p>',
  },
  {
    slug: "gallery-intro",
    title: "Gallery: introduction",
    html: "<p>A peek at what people are building in the shop. Follow along for more — and tag us when you finish something.</p>",
  },
  {
    slug: "gallery-permission",
    title: "Gallery: getting featured, and permission",
    html: '<p>Want your build featured? Share it on <a href="{instagramUrl}" target="_blank" rel="noopener noreferrer">Instagram</a> or <a href="{facebookUrl}" target="_blank" rel="noopener noreferrer">Facebook</a> and tell staff — we only post member work with permission.</p>',
  },

  // Classes and reservations
  {
    slug: "class-payment-required",
    title: "Class page: paying for a held seat",
    html: "<p>Pay through Zeffy to hold your seat. Staff marks the booking paid after confirmation; unpaid holds expire automatically.</p>",
  },
  {
    slug: "class-credits-note",
    title: "Class page: paying with machine credits",
    html: "<p>Credits can pay the full class price, or you pay Zeffy the full amount — no split.</p>",
  },
  {
    slug: "class-booking-paid",
    title: "Class page: before booking a paid class",
    html: "<p>Booking a paid class holds a seat until payment is confirmed.</p>",
  },
  {
    slug: "class-booking-free",
    title: "Class page: before booking a free class",
    html: "<p>Free classes confirm instantly when seats remain.</p>",
  },
  {
    slug: "class-booking-full",
    title: "Class page: when the class is full",
    html: "<p>This class is full — you can join the waitlist.</p>",
  },
  {
    slug: "reserve-hero",
    title: "Reserve page: line under the heading",
    html: "<p>See what’s open or booked right now, then pick a time. A reservation is priority — not exclusive lockout.</p>",
  },
  {
    slug: "redeem-intro",
    title: "Redeem a code page: introduction",
    html: "<p>Have a gift card or a code from the makerspace? Type it here. It can be shop credit for machine time and classes, a membership, or a seat in a class.</p>",
  },
  {
    slug: "reserve-limits",
    title: "Reserve page: booking limits",
    html: "<p>Book up to {horizonDays} days ahead. Length caps depend on the machine (3D printers up to 5 hours). You may hold {openReservations} at a time.</p>",
  },
];

const BY_SLUG = new Map(TEXT_BLOCKS.map((block) => [block.slug, block]));

export function isTextBlockSlug(slug: string): boolean {
  return BY_SLUG.has(slug);
}

/** The words to show for a block: what staff saved, else the built-in ones. */
export function textBlockHtml(slug: string, saved: Record<string, string>): string {
  return saved[slug] ?? BY_SLUG.get(slug)?.html ?? "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Fills {name} with its value, escaped, so a value can sit in text or inside
 * an attribute. A placeholder with no value is left as written.
 */
export function fillTextBlock(
  html: string,
  values: Record<string, string | number | null | undefined>,
): string {
  return html.replace(/\{([A-Za-z][A-Za-z0-9]*)\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? whole : escapeHtml(String(value));
  });
}

/** A block for use inside a sentence: paragraphs become line breaks. */
export function inlineTextBlock(html: string): string {
  return html
    .trim()
    .replace(/<\/p>\s*<p[^>]*>/gi, "<br><br>")
    .replace(/^<p[^>]*>/i, "")
    .replace(/<\/p>$/i, "");
}

/** A block as plain words, for places a tag cannot go. */
export function textBlockPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
