-- The lobby display has a new "Find us" slide. Saved settings list the panels
-- in order, so add it to a saved list that does not have it yet. With no saved
-- settings the defaults apply, and those include it.
UPDATE "DisplayConfig"
SET "panelOrder" = json_insert("panelOrder", '$[#]', 'findus')
WHERE json_valid("panelOrder")
  AND instr("panelOrder", '"findus"') = 0;
