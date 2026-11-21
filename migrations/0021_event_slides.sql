-- Two new lobby display slides: one event at a time with its description, and
-- the free community events together. Saved settings list the panels in
-- order, so add each to a saved list that does not have it yet.
UPDATE "DisplayConfig"
SET "panelOrder" = json_insert("panelOrder", '$[#]', 'spotlight')
WHERE json_valid("panelOrder")
  AND instr("panelOrder", '"spotlight"') = 0;

UPDATE "DisplayConfig"
SET "panelOrder" = json_insert("panelOrder", '$[#]', 'community')
WHERE json_valid("panelOrder")
  AND instr("panelOrder", '"community"') = 0;
