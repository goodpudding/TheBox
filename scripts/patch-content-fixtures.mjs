import fs from "fs";

const path = "data/mock/content-pages.json";
const pages = JSON.parse(fs.readFileSync(path, "utf8"));

const hoursHtml =
  "<ul>" +
  "<li>Sunday 11:00 AM – 5:00 PM</li>" +
  "<li>Monday 4:00 – 8:00 PM</li>" +
  "<li>Tuesday 4:00 – 8:00 PM</li>" +
  "<li>Wednesday 3:00 – 8:00 PM</li>" +
  "<li>Thursday 11:00 AM – 8:00 PM</li>" +
  "<li>Friday 11:00 AM – 8:00 PM</li>" +
  "<li>Saturday 11:00 AM – 6:00 PM</li>" +
  "</ul>" +
  "<p>Holiday closures and special events are posted at the shop and on the Discover Burien calendar.</p>";

const guestsHtml =
  "<p>Adult guests may visit during open hours with a member host and must sign a day waiver at the front desk.</p>" +
  '<p class="todo-flag">TODO: Confirm age thresholds, guardian requirements, and which machines are off-limits to minors under 16. Legal review pending before publish.</p>' +
  "<p>Minors must be accompanied by a guardian who remains on-site unless enrolled in a staffed youth program.</p>";

for (const p of pages) {
  if (p.slug === "hours") p.html = hoursHtml;
  if (p.slug === "faq") p.category = "policy";
  if (p.slug === "guests-and-minors") p.html = guestsHtml;
}

fs.writeFileSync(path, JSON.stringify(pages, null, 2) + "\n");

fs.writeFileSync(
  "data/mock/content/hours/hours.md",
  `# Hours

- Sunday 11:00 AM – 5:00 PM
- Monday 4:00 – 8:00 PM
- Tuesday 4:00 – 8:00 PM
- Wednesday 3:00 – 8:00 PM
- Thursday 11:00 AM – 8:00 PM
- Friday 11:00 AM – 8:00 PM
- Saturday 11:00 AM – 6:00 PM

Holiday closures and special events are posted at the shop and on the Discover Burien calendar.
`,
);

console.log("content fixtures patched");
