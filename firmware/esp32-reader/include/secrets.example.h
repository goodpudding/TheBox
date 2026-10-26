#pragma once

// Copy this file to secrets.h and fill in your shop values.
// secrets.h is gitignored.
//
// Default: Shelly-only (no relay). Machine power is wall → Shelly → machine.
// Optional local relay: set USE_LOCAL_RELAY 1 and wire RELAY_PIN.

// --- Wi-Fi ---
#define WIFI_SSID "passionfruit"
#define WIFI_PASSWORD "earthmelon122@^"

// --- Portal (Next.js The Box Portal on your LAN) ---
// No trailing slash. Example: laptop running `npm run dev`.
#define PORTAL_BASE_URL "http://192.168.1.50:3000"
#define READER_SHARED_SECRET "dev-reader-secret-change-me"

// Must match Admin → Machines → Reader key.
#define READER_KEY "reader-3d-prusa-mk4"

// --- Shelly Plug US (same Wi-Fi) ---
#define SHELLY_HOST "192.168.1.60"
// "gen2" = Shelly Plus / Plug US RPC   "gen1" = classic /relay/0
#define SHELLY_GENERATION "gen2"
// 0 = Shelly only (recommended). 1 = also drive a local relay on RELAY_PIN.
#define USE_LOCAL_RELAY 0

// --- PN532 I2C ---
#define PN532_SDA 21
#define PN532_SCL 22
#define PN532_IRQ 4
#define PN532_RESET 5

// --- Indicators (Shelly-only Badger wiring) ---
#define LED_GREEN_PIN 25
#define LED_RED_PIN 33
// Only used when USE_LOCAL_RELAY is 1 (GPIO 26 reserved in that layout).
#define RELAY_PIN 26
// Many 5V relay boards are active-LOW on IN.
#define RELAY_ACTIVE_LOW 1

// How long power stays on if nobody taps again (minutes). 0 = until re-tap.
// 3D printers: use 0 — a timer must never cut a print. (See POWER_GUARD_WATTS.)
#define SESSION_TIMEOUT_MINUTES 120

// Power guard (watts). While the Shelly reports more than this, the badger
// refuses to switch the machine off (re-tap or timeout): two long red blinks,
// session stays open, try again when the job finishes. 0 = off.
// Measure idle vs. running with http://<shelly-ip>/rpc/Switch.GetStatus?id=0
// ("apower") and set it a little above idle. Bambu X1C: ~40 is a fair start.
#define POWER_GUARD_WATTS 0

// Done button: momentary switch from this GPIO to GND. Press to end the
// session (power guard still applies). 0 = no button.
#define BUTTON_PIN 14

// Idle auto-end (minutes). After the plug has read at or below
// POWER_GUARD_WATTS for this long, the session ends and the machine powers
// off by itself — lets a member start a printer and leave. 0 = off.
// Attended machines (laser, CNC): 0, or a short value like 10 so an
// abandoned machine still shuts down. Printers: 15–20.
#define IDLE_END_MINUTES 0
