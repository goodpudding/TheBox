# The Box Badger — ESP32 machine reader

Firmware for the shop **NFC Machine Access Badger**:

- KeeYees **ESP32** Dev Board  
- **PN532** NFC (I2C)  
- **Green / Red LEDs** + 220Ω  
- **Shelly Plug US** on Wi‑Fi (machine power)  
- Optional **5V relay** (off by default — Shelly switches the machine)

Backend is **The Box Portal** (Next.js), not the old FastAPI sketch on the flyer:

| Call | Endpoint |
|---|---|
| Tap to start | `POST /api/access/authorize` |
| Tap again / timeout | `POST /api/access/end` |

## Wiring (Shelly-only — recommended)

PN532 in **I2C mode**. No GPIO to the Shelly — power is wall → Shelly → machine; ESP32 talks to Shelly over HTTP on the LAN.

| Device | ESP32 |
|---|---|
| PN532 VCC | **3V3** (or 5V if your module requires it) |
| PN532 GND | GND |
| PN532 SDA | GPIO **21** |
| PN532 SCL | GPIO **22** |
| PN532 IRQ | GPIO **4** |
| PN532 RSTO | GPIO **5** |
| Green LED (+) via 220Ω | GPIO **25** |
| Red LED (+) via 220Ω | GPIO **33** |
| LED (−) | GND |
| Done button (momentary) | GPIO **14** ↔ GND (internal pull-up; no resistor) |

Power the ESP32 via USB-C. GPIO **26** stays unused unless you add a local relay.

### Optional local relay

Set `USE_LOCAL_RELAY 1` in `secrets.h`, wire Relay IN to GPIO **26**, Relay VCC to 5V, GND to GND. Prefer a separate 5V supply for the relay board (common GND with ESP32) if it chatters on USB power alone.

## Flash

1. Install [PlatformIO](https://platformio.org/).
2. Config:

```bash
cd firmware/esp32-reader
cp include/secrets.example.h include/secrets.h
```

3. Edit `include/secrets.h`: Wi‑Fi, `PORTAL_BASE_URL`, `READER_SHARED_SECRET`, `READER_KEY`, `SHELLY_HOST`, `SHELLY_GENERATION` (`gen2` for Plug US / Plus). Leave `USE_LOCAL_RELAY` at `0` unless you wired a relay.
4. Upload:

```bash
pio run -t upload
pio device monitor
```

## Behaviour

| LEDs | Meaning |
|---|---|
| Off | Idle |
| Both | Talking to portal / Wi‑Fi |
| Green | Allowed — session active (Shelly on) |
| Red blinks | Denied / error |

1. Tap badge → portal checks certs / waiver / membership.  
2. Allow → **Shelly on** (+ local relay if enabled), green LED.  
3. Same badge again, the **Done button**, or timeout → Shelly off, session ends.  
3b. **Idle auto-end** (`IDLE_END_MINUTES`, 0 = off): once the plug has read idle (≤ `POWER_GUARD_WATTS`) for that many minutes, the session ends by itself — a member can start a printer and leave. Use 0 on attended machines (laser, CNC) or a short value so an abandoned machine still powers down.  
4. Tap and lift. A card left resting on the reader counts as one tap; the next tap is only accepted after the card has left the field.  
5. **Power guard** (`POWER_GUARD_WATTS` in `secrets.h`, 0 = off): if the Shelly reports the machine drawing more than that — a printer mid-print — a re-tap or timeout does *not* switch it off. Two long red blinks, LED back to green, session stays open; tap again when the job is done. A timed-out session re-checks every minute. Set `SESSION_TIMEOUT_MINUTES 0` on printers regardless.

## Portal

In repo `.env`:

```
READER_SHARED_SECRET=dev-reader-secret-change-me
```

Smoke test:

```bash
curl -s -X POST http://localhost:3000/api/access/authorize \
  -H "Content-Type: application/json" \
  -H "X-Reader-Secret: dev-reader-secret-change-me" \
  -d "{\"readerKey\":\"reader-3d-prusa-mk4\",\"badgeUid\":\"a1b2c3d4e5f60718\"}"
```

Link real card UIDs (serial monitor hex) to members under Admin. `READER_KEY` must match that machine’s reader key.
