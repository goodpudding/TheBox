# The Box workstation shell (Tauri 2)

Thin Windows WebView2 wrapper around `/workstation` on the website. It does not run Next.js on the shop PC.

## What it does

- Autostarts with the shop Windows account
- Opens `/workstation` fullscreen
- Stores the workstation session token in **Windows Credential Manager** (`org.discoverburien.thebox.workstation`)
- Launches mapped `.exe`s after the website allows the launch
- Clears WebView data on logout
- **Does not** kill child processes, cancel the print spooler, or power-cycle machines

Login identifies the member and which software they may open. It does **not** start a clock or debit credits. Charge when a job is sent (estimate first). Logout / idle ends the session only.

## Run (on a Windows shop PC)

1. Host the website (Vercel or `npm run dev` on the LAN).
2. Set `THE_BOX_URL` to `https://YOUR_DOMAIN/workstation?device=BOX-PC-1`.
3. From this folder, with [Rust](https://rustup.rs) installed:

```bash
npm create tauri-app@latest -- --yes  # not required; sources are already here
cargo tauri build
```

`BOX-PC-1` is Design PC 1 (Bambu A1, grams × filament+30%). `BOX-PC-2` is the laser desk ($15/$25/hr of estimated run time, not login).

General software (Notepad) needs no machine cert. Vendor apps still go through `POST /api/workstation/launch`.
