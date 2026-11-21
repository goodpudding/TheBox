-- Photos the lobby display rotates through. Rows here are loaded with the
-- rest of the site's data; the pictures themselves are in DisplayPhotoBlob.
CREATE TABLE "DisplayPhoto" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caption" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

CREATE TABLE "DisplayPhotoBlob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dataBase64" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- "full" or "calm": how much the lobby display animates.
ALTER TABLE "DisplayConfig" ADD COLUMN "motion" TEXT NOT NULL DEFAULT 'full';
