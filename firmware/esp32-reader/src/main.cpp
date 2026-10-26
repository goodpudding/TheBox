#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_PN532.h>
#include <ArduinoJson.h>
#include "secrets.h"

// The Box Badger — PN532 + LEDs + Shelly Plug US (relay optional)
// Wiring: see firmware/esp32-reader/README.md

Adafruit_PN532 nfc(PN532_IRQ, PN532_RESET);

String activeSessionId;
String activeBadgeUid;
unsigned long sessionStartedMs = 0;
unsigned long lastTapMs = 0;

const unsigned long TAP_DEBOUNCE_MS = 2500;
const unsigned long WIFI_RETRY_MS = 8000;

// Tap-and-lift: a card sitting on the reader is one tap, not a tap every
// 2.5 s. The card must leave the field (this many consecutive missed reads)
// before the next read counts as a new tap.
const uint8_t CARD_GONE_MISSES = 3;
bool cardPresent = false;
uint8_t cardMisses = 0;

// Power guard: never switch the machine off while it is drawing more than
// POWER_GUARD_WATTS (0 = disabled). Protects a 3D printer mid-print from a
// re-tap or session timeout. Set per machine in secrets.h.
#ifndef POWER_GUARD_WATTS
#define POWER_GUARD_WATTS 0
#endif
const unsigned long BUSY_RETRY_MS = 60000;
unsigned long lastBusyRefuseMs = 0;

// Done button: momentary switch between BUTTON_PIN and GND. Press = end the
// session (same power guard as a re-tap). 0 = no button fitted.
#ifndef BUTTON_PIN
#define BUTTON_PIN 14
#endif
const unsigned long BUTTON_DEBOUNCE_MS = 400;
volatile bool buttonPressed = false;  // set by ISR, cleared in handleButton
unsigned long lastButtonMs = 0;

void IRAM_ATTR onButtonFall() { buttonPressed = true; }

// Idle auto-end: once the plug has read at or below POWER_GUARD_WATTS for this
// many minutes in a row, the session ends by itself (printer finished, member
// gone). 0 = off. Needs POWER_GUARD_WATTS > 0. Use 0 on attended machines
// (laser, CNC) or a short value so an abandoned machine still powers down.
#ifndef IDLE_END_MINUTES
#define IDLE_END_MINUTES 0
#endif
const unsigned long POWER_POLL_MS = 30000;
unsigned long lastPowerPollMs = 0;
unsigned long idleSinceMs = 0;  // 0 = machine is (or was last seen) busy

enum class LedState { Idle, Ok, Deny, Busy };

void setRelay(bool on) {
#if USE_LOCAL_RELAY
  pinMode(RELAY_PIN, OUTPUT);
  const bool level = RELAY_ACTIVE_LOW ? !on : on;
  digitalWrite(RELAY_PIN, level ? HIGH : LOW);
#else
  (void)on;
#endif
}

void setLeds(LedState state) {
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  switch (state) {
    case LedState::Ok:
      digitalWrite(LED_GREEN_PIN, HIGH);
      digitalWrite(LED_RED_PIN, LOW);
      break;
    case LedState::Deny:
      digitalWrite(LED_GREEN_PIN, LOW);
      digitalWrite(LED_RED_PIN, HIGH);
      break;
    case LedState::Busy:
      digitalWrite(LED_GREEN_PIN, HIGH);
      digitalWrite(LED_RED_PIN, HIGH);
      break;
    case LedState::Idle:
    default:
      digitalWrite(LED_GREEN_PIN, LOW);
      digitalWrite(LED_RED_PIN, LOW);
      break;
  }
}

void blinkRed(int times, int onMs = 80, int offMs = 80) {
  for (int i = 0; i < times; i++) {
    setLeds(LedState::Deny);
    delay(onMs);
    setLeds(LedState::Idle);
    delay(offMs);
  }
}

void blinkGreen(int times, int onMs = 80, int offMs = 80) {
  for (int i = 0; i < times; i++) {
    setLeds(LedState::Ok);
    delay(onMs);
    setLeds(LedState::Idle);
    delay(offMs);
  }
}

bool ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return true;
  setLeds(LedState::Busy);
  Serial.printf("WiFi connecting to %s…\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  const unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_RETRY_MS) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WiFi OK %s\n", WiFi.localIP().toString().c_str());
    setLeds(activeSessionId.isEmpty() ? LedState::Idle : LedState::Ok);
    return true;
  }
  Serial.println("WiFi failed");
  setLeds(LedState::Deny);
  return false;
}

bool shellySet(bool on) {
  if (!ensureWifi()) return false;
  HTTPClient http;
  String url;
  if (String(SHELLY_GENERATION) == "gen1") {
    url = String("http://") + SHELLY_HOST + "/relay/0?turn=" + (on ? "on" : "off");
  } else {
    url =
        String("http://") + SHELLY_HOST + "/rpc/Switch.Set?id=0&on=" + (on ? "true" : "false");
  }
  Serial.printf("Shelly %s\n", url.c_str());
  http.begin(url);
  http.setTimeout(4000);
  const int code = http.GET();
  const String body = http.getString();
  http.end();
  Serial.printf("Shelly HTTP %d %s\n", code, body.c_str());
  return code >= 200 && code < 300;
}

// Reads the plug's active power in watts. Returns false if the plug did not
// answer or the reply had no power figure.
bool shellyGetPower(float &watts) {
  watts = 0;
  if (!ensureWifi()) return false;
  HTTPClient http;
  String url;
  const bool gen1 = String(SHELLY_GENERATION) == "gen1";
  if (gen1) {
    url = String("http://") + SHELLY_HOST + "/status";
  } else {
    url = String("http://") + SHELLY_HOST + "/rpc/Switch.GetStatus?id=0";
  }
  http.begin(url);
  http.setTimeout(4000);
  const int code = http.GET();
  const String body = http.getString();
  http.end();
  if (code < 200 || code >= 300) {
    Serial.printf("Shelly power read HTTP %d\n", code);
    return false;
  }
  JsonDocument doc;
  if (deserializeJson(doc, body)) {
    Serial.println("Shelly power read: bad JSON");
    return false;
  }
  if (gen1) {
    if (!doc["meters"][0]["power"].is<float>()) return false;
    watts = doc["meters"][0]["power"].as<float>();
  } else {
    if (!doc["apower"].is<float>()) return false;
    watts = doc["apower"].as<float>();
  }
  return true;
}

// True when the machine is drawing more than POWER_GUARD_WATTS. If the plug
// cannot be read the machine is treated as idle (a power-off would fail too).
bool machineBusy() {
#if POWER_GUARD_WATTS > 0
  float watts = 0;
  if (!shellyGetPower(watts)) return false;
  Serial.printf("Shelly apower %.1f W (guard %d W)\n", watts, POWER_GUARD_WATTS);
  return watts > (float)POWER_GUARD_WATTS;
#else
  return false;
#endif
}

void machinePower(bool on) {
  setRelay(on);
  const bool shellyOk = shellySet(on);
  if (!shellyOk) {
    Serial.println("Shelly toggle failed (local relay only if USE_LOCAL_RELAY)");
  }
}

String uidToHex(const uint8_t *uid, uint8_t len) {
  String out;
  out.reserve(len * 2);
  for (uint8_t i = 0; i < len; i++) {
    if (uid[i] < 0x10) out += "0";
    out += String(uid[i], HEX);
  }
  out.toLowerCase();
  return out;
}

bool portalAuthorize(const String &badgeUid, bool &allow, String &sessionId, String &reason) {
  allow = false;
  sessionId = "";
  reason = "network";
  if (!ensureWifi()) return false;

  HTTPClient http;
  const String url = String(PORTAL_BASE_URL) + "/api/access/authorize";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Reader-Secret", READER_SHARED_SECRET);
  http.setTimeout(8000);

  JsonDocument doc;
  doc["readerKey"] = READER_KEY;
  doc["badgeUid"] = badgeUid;
  String payload;
  serializeJson(doc, payload);

  Serial.printf("POST %s %s\n", url.c_str(), payload.c_str());
  const int code = http.POST(payload);
  const String body = http.getString();
  http.end();
  Serial.printf("Authorize HTTP %d %s\n", code, body.c_str());
  if (code < 200 || code >= 300) {
    reason = "http_" + String(code);
    return false;
  }

  JsonDocument res;
  if (deserializeJson(res, body)) {
    reason = "bad_json";
    return false;
  }
  allow = res["allow"] | false;
  reason = res["reason"] | "unknown";
  if (res["sessionId"].is<const char *>()) {
    sessionId = String(res["sessionId"].as<const char *>());
  }
  return true;
}

bool portalEnd(const String &sessionId) {
  if (sessionId.isEmpty()) return false;
  if (!ensureWifi()) return false;

  HTTPClient http;
  const String url = String(PORTAL_BASE_URL) + "/api/access/end";
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("X-Reader-Secret", READER_SHARED_SECRET);
  http.setTimeout(8000);

  JsonDocument doc;
  doc["readerKey"] = READER_KEY;
  doc["sessionId"] = sessionId;
  String payload;
  serializeJson(doc, payload);

  Serial.printf("POST %s %s\n", url.c_str(), payload.c_str());
  const int code = http.POST(payload);
  const String body = http.getString();
  http.end();
  Serial.printf("End HTTP %d %s\n", code, body.c_str());
  return code >= 200 && code < 300;
}

// Returns false (and leaves the session open) when the power guard says the
// machine is still working — e.g. a printer mid-print.
bool endActiveSession(const char *why) {
  if (activeSessionId.isEmpty()) return true;
  if (machineBusy()) {
    lastBusyRefuseMs = millis();
    Serial.printf("Not ending session (%s): machine still drawing power\n", why);
    // Two long red blinks, then back to green: "still running, try later".
    blinkRed(2, 350, 200);
    setLeds(LedState::Ok);
    return false;
  }
  Serial.printf("Ending session (%s)\n", why);
  portalEnd(activeSessionId);
  machinePower(false);
  activeSessionId = "";
  activeBadgeUid = "";
  sessionStartedMs = 0;
  blinkGreen(2, 40, 40);
  setLeds(LedState::Idle);
  return true;
}

void startSession(const String &badgeUid, const String &sessionId) {
  activeBadgeUid = badgeUid;
  activeSessionId = sessionId;
  sessionStartedMs = millis();
  machinePower(true);
  setLeds(LedState::Ok);
  Serial.printf("Session %s started\n", sessionId.c_str());
  // Give the member time to load a job before idle counting starts.
  idleSinceMs = 0;
  lastPowerPollMs = millis();
}

void handleButton() {
#if BUTTON_PIN > 0
  if (!buttonPressed) return;
  buttonPressed = false;
  // The NFC poll blocks the loop ~200 ms, so the press is latched by an
  // interrupt and handled here; debounce filters contact bounce.
  if (millis() - lastButtonMs > BUTTON_DEBOUNCE_MS) {
    lastButtonMs = millis();
    if (activeSessionId.isEmpty()) {
      Serial.println("Button: no session to end");
      blinkRed(1, 120, 0);
      setLeds(LedState::Idle);
    } else {
      Serial.println("Button: done");
      endActiveSession("button");
    }
  }
#endif
}

void handleIdleEnd() {
#if IDLE_END_MINUTES > 0 && POWER_GUARD_WATTS > 0
  if (activeSessionId.isEmpty()) return;
  if (millis() - lastPowerPollMs < POWER_POLL_MS) return;
  lastPowerPollMs = millis();
  float watts = 0;
  if (!shellyGetPower(watts)) return;  // plug unreachable: don't guess
  if (watts > (float)POWER_GUARD_WATTS) {
    idleSinceMs = 0;
    return;
  }
  if (idleSinceMs == 0) {
    idleSinceMs = millis();
    Serial.printf("Idle at %.1f W; auto-end in %d min unless it starts working\n",
                  watts, IDLE_END_MINUTES);
    return;
  }
  const unsigned long limitMs = (unsigned long)IDLE_END_MINUTES * 60UL * 1000UL;
  if (millis() - idleSinceMs >= limitMs) {
    endActiveSession("idle");
    idleSinceMs = 0;
  }
#endif
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println();
  Serial.println("The Box Badger (ESP32 + PN532 + Shelly)");
  Serial.printf("Reader key: %s\n", READER_KEY);

  setRelay(false);
  setLeds(LedState::Idle);
#if BUTTON_PIN > 0
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  attachInterrupt(digitalPinToInterrupt(BUTTON_PIN), onButtonFall, FALLING);
#endif
  ensureWifi();

  Wire.begin(PN532_SDA, PN532_SCL);
  nfc.begin();
  uint32_t version = nfc.getFirmwareVersion();
  if (!version) {
    Serial.println(
        "PN532 not found — I2C mode jumpers, SDA=21 SCL=22, RST=GPIO5");
    while (true) {
      blinkRed(3, 60, 60);
      delay(800);
    }
  }
  Serial.printf("PN532 OK firmware 0x%08lx\n", (unsigned long)version);
  nfc.SAMConfig();
  // Start with the machine off — unless it is busy (a reboot mid-print must
  // not cut the printer). No session is tracked for it; the next tap starts one.
  if (machineBusy()) {
    Serial.println("Boot: machine is drawing power, leaving it on");
  } else {
    machinePower(false);
  }
  blinkGreen(2, 100, 100);
  setLeds(LedState::Idle);
}

void loop() {
  handleButton();
  handleIdleEnd();

  if (SESSION_TIMEOUT_MINUTES > 0 && !activeSessionId.isEmpty()) {
    const unsigned long limitMs =
        (unsigned long)SESSION_TIMEOUT_MINUTES * 60UL * 1000UL;
    if (millis() - sessionStartedMs > limitMs &&
        millis() - lastBusyRefuseMs > BUSY_RETRY_MS) {
      // If the guard refuses (machine busy) this re-checks every minute.
      endActiveSession("timeout");
    }
  }

  uint8_t uid[7] = {0};
  uint8_t uidLength = 0;
  const bool saw =
      nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 200);
  if (!saw || uidLength == 0) {
    // Card gone? Only after a few consecutive misses — a single missed read
    // while the card is still there must not count as a lift.
    if (cardPresent && ++cardMisses >= CARD_GONE_MISSES) {
      cardPresent = false;
      cardMisses = 0;
    }
    delay(40);
    return;
  }
  cardMisses = 0;

  if (cardPresent) {
    // Same card still resting on the reader: not a new tap.
    delay(40);
    return;
  }
  cardPresent = true;

  if (millis() - lastTapMs < TAP_DEBOUNCE_MS) {
    delay(40);
    return;
  }
  lastTapMs = millis();

  const String badgeUid = uidToHex(uid, uidLength);
  Serial.printf("Tap UID %s\n", badgeUid.c_str());
  setLeds(LedState::Busy);

  if (!activeSessionId.isEmpty() && badgeUid == activeBadgeUid) {
    endActiveSession("retap");
    delay(400);
    return;
  }

  if (!activeSessionId.isEmpty()) {
    Serial.println("Session already active for another badge");
    blinkRed(4, 40, 40);
    setLeds(LedState::Ok);
    delay(400);
    return;
  }

  bool allow = false;
  String sessionId;
  String reason;
  if (!portalAuthorize(badgeUid, allow, sessionId, reason)) {
    blinkRed(6, 40, 40);
    setLeds(LedState::Idle);
    delay(400);
    return;
  }

  if (!allow || sessionId.isEmpty()) {
    Serial.printf("Denied: %s\n", reason.c_str());
    blinkRed(3, 200, 120);
    setLeds(LedState::Idle);
    delay(400);
    return;
  }

  startSession(badgeUid, sessionId);
  delay(400);
}
