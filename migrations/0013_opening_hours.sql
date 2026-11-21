-- New opening hours: Tuesday to Friday 1 to 8 PM, Saturday 11 to 5, Sunday
-- 11 to 4, closed Mondays. The Hours page listed the old ones (Monday 4 to 8).
-- The same hours are in src/lib/opening-hours.ts; a test keeps the two in step.
UPDATE "ContentPage"
SET "html" = '<ul><li>Sunday 11:00 AM – 4:00 PM</li><li>Monday Closed</li><li>Tuesday 1:00 – 8:00 PM</li><li>Wednesday 1:00 – 8:00 PM</li><li>Thursday 1:00 – 8:00 PM</li><li>Friday 1:00 – 8:00 PM</li><li>Saturday 11:00 AM – 5:00 PM</li></ul><p>Holiday closures and special events are posted at the shop and on the Discover Burien calendar.</p>',
    "updatedAt" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE "slug" = 'hours';
