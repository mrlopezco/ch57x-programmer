import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { useDebounceCallback } from "usehooks-ts";

import { useValueChange } from "@hooks/useValueChange";

import { WELL_KNOWN_CODES } from "./key_codes";
import {
  EncoderAction,
  isKeyboardFamily,
  KeyBinding,
  Keyboard,
  KeyboardCapabilities,
  KeyboardDeviceType,
  keysAreEqual,
  UNKNOWN_KEYBOARD_DEVICE,
} from "./keyboard";

export type KeyboardDevice = {
  keyboard: Keyboard;
  device?: HIDDevice;
};

export type ActiveKeyboardDevice = {
  name: string;
  keyboardDeviceType: KeyboardDeviceType;
  keyBindings: KeyBinding[];
  errors: Error[];
  busy: boolean;
  readDeviceType: () => void;
  readConfiguration: () => Promise<KeyBinding[]>;
  writeKeyBindings: (bindings: KeyBinding[]) => Promise<boolean>;
  capabilities: KeyboardCapabilities;
};

const DEBOUNCE_PARAMS = { leading: false, trailing: true };
const READ_SETTLE_MS = 150;
const READ_TIMEOUT_MS = 2500;

export function useKeyboardDevice({
  keyboard,
  device,
}: KeyboardDevice): ActiveKeyboardDevice {
  const [deviceType, setDeviceType] = useState<KeyboardDeviceType>(
    UNKNOWN_KEYBOARD_DEVICE
  );
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Error[]>([]);
  const pendingBindings = useRef<KeyBinding[]>([]);
  const [keyBindings, setKeyBindings] = useState<KeyBinding[]>([]);
  const pauseUpdate = useRef<boolean>(false);

  const defaultBindings = useMemo(() => {
    const defaultBindings: KeyBinding[] = [];
    for (let layer = 0; layer != 3; layer++) {
      for (let button = 0; button < deviceType.buttons; button++) {
        defaultBindings.push({
          layer,
          key: button,
          expansion: {
            type: "Keyboard",
            options: {
              delay: 0,
            },
            keyChords: [{ modifiers: [], code: WELL_KNOWN_CODES[button]! }],
          },
          origin: "placeholder",
        });
      }
      for (let encoder = 0; encoder < deviceType.encoders; encoder++) {
        defaultBindings.push(
          ...["ccw", "press", "cw"].map<KeyBinding>((action, i) => ({
            layer,
            key: [encoder, action as EncoderAction],
            expansion: {
              type: "Keyboard",
              options: { delay: 0 },
              keyChords: [
                {
                  modifiers: [],
                  code: WELL_KNOWN_CODES[deviceType.buttons + encoder * 3 + i]!,
                },
              ],
            },
            origin: "placeholder",
          }))
        );
      }
    }

    return defaultBindings;
  }, [deviceType.buttons, deviceType.encoders]);

  const actuallyUpdateKeyBindings = useCallback(() => {
    if (pauseUpdate.current || pendingBindings.current.length === 0) {
      return;
    }
    const newBindings = pendingBindings.current;
    pendingBindings.current = [];

    setKeyBindings(bindings => {
      const update = [...bindings];

      for (const binding of newBindings) {
        const existingIndex = update.findIndex(
          b => b.layer === binding.layer && keysAreEqual(b.key, binding.key)
        );
        if (existingIndex >= 0) {
          update[existingIndex] = binding;
        } else {
          update.push(binding);
        }
      }

      return update;
    });
    // Do not grow deviceType.layers from config packets — that reflows the editor UI.
  }, []);

  const updateKeyBindings = useDebounceCallback(
    actuallyUpdateKeyBindings,
    100,
    DEBOUNCE_PARAMS
  );
  const [_inTransition, startTransition] = useTransition();

  const readDeviceType = useCallback(() => {
    if (!device || pending) {
      return;
    }
    if (!keyboard.capabilities.readConfiguration) {
      const family = keyboard.name;
      if (isKeyboardFamily(family)) {
        setDeviceType({
          family,
          buttons: keyboard.capabilities.maxButtons,
          encoders: keyboard.capabilities.maxEncoders,
          layers: keyboard.capabilities.maxLayers,
        });
      }
      return;
    }
    setPending(true);
    const packet = makeBuffer(keyboard.getDeviceType());
    device
      .sendReport(3, packet)
      .catch(error => setErrors(prev => [...prev, error]))
      .finally(() => setPending(false));
  }, [keyboard, device, pending]);

  const onDeviceChange = useCallback(
    (device: HIDDevice | undefined) => {
      if (!device) {
        startTransition(() => {
          setDeviceType(prev =>
            prev.buttons === 0 && prev.encoders === 0
              ? prev
              : UNKNOWN_KEYBOARD_DEVICE
          );
          setPending(false);
          setErrors(prev => (prev.length === 0 ? prev : []));
          if (pendingBindings.current.length !== 0) {
            pendingBindings.current = [];
          }
          setKeyBindings(prev => (prev.length === 0 ? prev : []));
        });
        return;
      }
      const listener = (event: HIDInputReportEvent) => {
        const data = event.data;
        const array = new Uint8Array(
          data.buffer,
          data.byteOffset,
          data.byteLength
        );

        switch (keyboard.checkPacketType(array)) {
          case "device": {
            const parsed = keyboard.parseDeviceTypePacket(array);
            if (parsed !== undefined) {
              setDeviceType(prev => {
                if (
                  prev.family === parsed.family &&
                  prev.buttons === parsed.buttons &&
                  prev.encoders === parsed.encoders
                ) {
                  return prev;
                }
                // Keep layers from previous user/firmware state if parse omits them.
                return {
                  ...parsed,
                  layers: parsed.layers > 0 ? parsed.layers : prev.layers || 3,
                };
              });
            }
            break;
          }
          case "config": {
            const keyBinding = keyboard.parseConfigPacket(array);
            if (keyBinding) {
              pendingBindings.current.push(keyBinding);
              if (!pauseUpdate.current) {
                updateKeyBindings();
              }
            } else {
              console.warn("Unable to parse config packet", array.slice(0, 16));
            }
            break;
          }
          default:
            console.warn("Unknown packet", array);
        }
      };

      device.addEventListener("inputreport", listener);
      startTransition(() => {
        readDeviceType();
      });
      return () => device.removeEventListener("inputreport", listener);
    },
    [keyboard, readDeviceType, updateKeyBindings]
  );
  useValueChange(device, onDeviceChange);

  const waitForSettledBindings = useCallback((): Promise<KeyBinding[]> => {
    const started = performance.now();
    let lastCount = -1;
    let stableSince = performance.now();

    return new Promise(resolve => {
      const poll = () => {
        const count = pendingBindings.current.length;
        if (count !== lastCount) {
          lastCount = count;
          stableSince = performance.now();
        }
        const settled =
          count > 0 && performance.now() - stableSince >= READ_SETTLE_MS;
        const timedOut = performance.now() - started >= READ_TIMEOUT_MS;
        if (settled || timedOut) {
          const unique = dedupeBindings([...pendingBindings.current]);
          pendingBindings.current = [];
          resolve(unique);
          return;
        }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    });
  }, []);

  const readConfiguration = useCallback(async (): Promise<KeyBinding[]> => {
    if (!device || pending || !keyboard.capabilities.readConfiguration) {
      return [];
    }

    setPending(true);
    pauseUpdate.current = true;
    pendingBindings.current = [];

    try {
      await device.sendReport(3, makeBuffer(keyboard.readConfig(0)));
      await device.sendReport(3, makeBuffer(keyboard.readConfig(1)));
      await device.sendReport(3, makeBuffer(keyboard.readConfig(2)));
      await device.sendReport(3, makeBuffer(keyboard.readConfig(3)));

      const snapshot = await waitForSettledBindings();
      const withOrigin = snapshot.map(binding => ({
        ...binding,
        origin: "device" as const,
      }));
      setKeyBindings(withOrigin);
      return withOrigin;
    } catch (error) {
      setErrors(prev => [...prev, error as Error]);
      return [];
    } finally {
      pauseUpdate.current = false;
      setPending(false);
    }
  }, [keyboard, device, pending, waitForSettledBindings]);

  const writeKeyBindings = useCallback(
    async (bindings: KeyBinding[]): Promise<boolean> => {
      if (!device || pending || pauseUpdate.current) {
        return false;
      }

      setPending(true);
      pauseUpdate.current = true;
      try {
        const packets = bindings.flatMap(({ layer, key, expansion }) =>
          keyboard.bindKey(layer, key, expansion)
        );

        for (const packet of packets) {
          await device.sendReport(3, makeBuffer(packet));
        }

        setKeyBindings(
          bindings.map(binding => ({ ...binding, origin: "device" as const }))
        );
        return true;
      } catch (error) {
        setErrors(prev => [...prev, error as Error]);
        return false;
      } finally {
        pauseUpdate.current = false;
        setPending(false);
      }
    },
    [device, keyboard, pending]
  );

  return {
    name: keyboard.name,
    capabilities: keyboard.capabilities,
    keyboardDeviceType: deviceType,
    keyBindings: keyBindings.length === 0 ? defaultBindings : keyBindings,
    errors,
    busy: pending,
    readDeviceType,
    readConfiguration,
    writeKeyBindings,
  };
}

function dedupeBindings(bindings: KeyBinding[]): KeyBinding[] {
  const result: KeyBinding[] = [];
  for (const binding of bindings) {
    const index = result.findIndex(
      b => b.layer === binding.layer && keysAreEqual(b.key, binding.key)
    );
    if (index < 0) {
      result.push(binding);
    } else {
      result[index] = binding;
    }
  }
  return result;
}

function makeBuffer(data: number[]): Uint8Array<ArrayBuffer> {
  const buffer = new Uint8Array(64);

  for (let i = 0; i < 64 && i < data.length; i++) {
    const value = data[i];
    if (value === undefined || !Number.isInteger(value)) {
      continue;
    }
    if (value >= 0 && value < 0x100) {
      buffer[i] = value;
    }
    if (value < 0 && value > -127) {
      buffer[i] = 0x100 + value;
    }
  }
  return buffer;
}
