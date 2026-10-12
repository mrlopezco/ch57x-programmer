# ch57x-programmer

A small browser-based keyboard tool project for ch57x-based keyboards.

This repository is derived from and inspired by https://github.com/kriomant/ch57x-keyboard-tool.

A live version of this is available at https://pollrobots.com/cheese-tax.html

## Overview

This provides a compact browser-based solution for working with ch57x
keyboard hardware via WebHID, programming the keyboard/controller from the
browser.

## Features

- Support for ch57x-based keyboards via WebHID
- Named devices: add a keyboard, set layout/knobs/layers, read current config
- Key binding editor with multi-modifier chords (e.g. Ctrl+Alt+F1, Win+Alt+K)
- Lightweight, keyboard-focused tooling

## Building and running locally

This is a **web app**, not a Chrome Web Store extension. You can develop and
test everything locally without publishing.

Requirements:

- A recent Node.js / npm
- A Chromium-based browser (Chrome, Edge, …) with WebHID support
- Your ch57x keyboard plugged in over USB

Steps:

1. Clone the repository.
2. From the project directory, install dependencies:

   ```bash
   npm ci
   ```

3. Start the dev server:

   ```bash
   npm run start
   ```

4. Open Chrome (or Edge) and go to:

   `http://localhost:8080/cheese-tax.html`

5. Use **Add device** to connect the keyboard (browser permission prompt),
   name it, set buttons / knobs / layers / grid layout, **Read key-bindings**,
   then **Save device**. Open the device from the home screen to edit keys and
   **Write key-bindings** back to hardware.

### Notes

- WebHID only works in a **secure context** (`localhost` or HTTPS).
- Assign chords by clicking modifiers (Ctrl, Alt, **Win**, …) and the key
  (letter or F1–F12) in the editor, then click **Apply binding**.
- Capturing from a physical keyboard may fail for OS-reserved combos
  (Ctrl+Alt+F1, Win+…); click-to-build is more reliable for those.
