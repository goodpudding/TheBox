-- The weekly opening hours are a setting now (Admin → Settings → Opening
-- hours), and the Join page lists them from there. The Hours page keeps only
-- what is extra: holiday closures and notes. This takes the week that
-- migration 0013 wrote off that page. A page staff have since rewritten does
-- not contain that exact list and is left as it is.
UPDATE "ContentPage"
SET "html" = replace(
      "html",
      '<ul><li>Sunday 11:00 AM – 4:00 PM</li><li>Monday Closed</li><li>Tuesday 1:00 – 8:00 PM</li><li>Wednesday 1:00 – 8:00 PM</li><li>Thursday 1:00 – 8:00 PM</li><li>Friday 1:00 – 8:00 PM</li><li>Saturday 11:00 AM – 5:00 PM</li></ul>',
      ''
    ),
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "slug" = 'hours'
  AND instr(
      "html",
      '<ul><li>Sunday 11:00 AM – 4:00 PM</li><li>Monday Closed</li><li>Tuesday 1:00 – 8:00 PM</li><li>Wednesday 1:00 – 8:00 PM</li><li>Thursday 1:00 – 8:00 PM</li><li>Friday 1:00 – 8:00 PM</li><li>Saturday 11:00 AM – 5:00 PM</li></ul>'
    ) > 0;
