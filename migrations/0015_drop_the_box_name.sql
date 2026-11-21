-- The makerspace no longer goes by "The Box". It is Discover Burien
-- Makerspace, or "the makerspace" in a sentence. This renames it in the text
-- staff and members read. Each column is done in two steps, because SQLite's
-- REPLACE cannot tell where a sentence starts:
--   1. a value that begins with the name gets a capital: "The makerspace …"
--   2. the name after a full stop or an opening tag gets a capital, every
--      other one is lower case, and "The Box makerspace" loses the repeat.
--
-- Not touched: the waiver (members signed that wording; staff publish a new
-- version when they want it changed), audit history, and people's own notes.

UPDATE "OrgSettings"
SET "orgName" = 'Discover Burien Makerspace'
WHERE "orgName" = 'The Box · Discover Burien Makerspace';

UPDATE "MembershipProduct"
SET "name" = 'Friend of the Makerspace'
WHERE "name" = 'Friend of The Box';

-- A class location is a place name, not a sentence.
UPDATE "ClassSession"
SET "location" = REPLACE("location", 'The Box', 'Discover Burien Makerspace')
WHERE instr("location", 'The Box') > 0;

UPDATE "ContentPage" SET "title" = 'The makerspace' || substr("title", 8)
WHERE "title" GLOB 'The Box*' AND "category" <> 'waiver';
UPDATE "ContentPage" SET "title" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("title",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("title", 'The Box') > 0 AND "category" <> 'waiver';

UPDATE "ContentPage" SET "html" = 'The makerspace' || substr("html", 8)
WHERE "html" GLOB 'The Box*' AND "category" <> 'waiver';
UPDATE "ContentPage" SET "html" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("html",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("html", 'The Box') > 0 AND "category" <> 'waiver';

UPDATE "MembershipProduct" SET "summary" = 'The makerspace' || substr("summary", 8)
WHERE "summary" GLOB 'The Box*';
UPDATE "MembershipProduct" SET "summary" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("summary",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("summary", 'The Box') > 0;

UPDATE "LearningModule" SET "summary" = 'The makerspace' || substr("summary", 8)
WHERE "summary" GLOB 'The Box*';
UPDATE "LearningModule" SET "summary" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("summary",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("summary", 'The Box') > 0;

UPDATE "LessonVideo" SET "condition" = 'The makerspace' || substr("condition", 8)
WHERE "condition" GLOB 'The Box*';
UPDATE "LessonVideo" SET "condition" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("condition",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("condition", 'The Box') > 0;

UPDATE "LessonVideo" SET "notes" = 'The makerspace' || substr("notes", 8)
WHERE "notes" GLOB 'The Box*';
UPDATE "LessonVideo" SET "notes" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("notes",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("notes", 'The Box') > 0;

UPDATE "Question" SET "prompt" = 'The makerspace' || substr("prompt", 8)
WHERE "prompt" GLOB 'The Box*';
UPDATE "Question" SET "prompt" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("prompt",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("prompt", 'The Box') > 0;

UPDATE "Question" SET "explanation" = 'The makerspace' || substr("explanation", 8)
WHERE "explanation" GLOB 'The Box*';
UPDATE "Question" SET "explanation" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("explanation",
    'The Box makerspace', 'the makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("explanation", 'The Box') > 0;

-- "choices" is a JSON list of answers; each answer starts after a quote mark.
UPDATE "Question" SET "choices" =
  REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE("choices",
    'The Box makerspace', 'the makerspace'),
    '"The Box', '"The makerspace'),
    '- The Box', '- The makerspace'),
    '. The Box', '. The makerspace'),
    '? The Box', '? The makerspace'),
    '>The Box', '>The makerspace'),
    'The Box', 'the makerspace')
WHERE instr("choices", 'The Box') > 0;

-- One note writes the name with a small "the".
UPDATE "LessonVideo"
SET "notes" = REPLACE("notes", 'the Box note', 'the makerspace note')
WHERE instr("notes", 'the Box note') > 0;
