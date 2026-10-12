import { ArrowLeft, HardDriveUpload } from "lucide-react";
import React, { useMemo, useState } from "react";

import { KeyBinding, KeyboardDeviceType } from "@model/keyboard";
import { KeyboardProfile, KeyLayout } from "@model/keyboard_profile";
import { computeLayouts } from "@model/layouts";
import { Button } from "@ux/Button";
import { Input } from "@ux/Input";
import { H1, H2, Text } from "@ux/Typography";

import { SelectDevice } from "../settings/SelectDevice";
import { SelectLayout } from "../settings/SelectLayout";
import { SetDeviceType } from "../settings/SetDeviceType";

const DEFAULT_GEOMETRY: KeyboardDeviceType = {
  family: "%other",
  buttons: 6,
  encoders: 1,
  layers: 1,
};

const EDITOR_MAX_LAYERS = 3;

function preferredLayout(buttons: number): KeyLayout {
  const layouts = computeLayouts(buttons);
  return (
    layouts.find(l => l.rows === 2 && l.columns === 3) ??
    layouts.find(l => l.rows * l.columns === buttons && l.rows > 0) ??
    layouts[0] ?? { rows: 0, columns: 0 }
  );
}

export type AddDeviceWizardProps = {
  hidDevices: HIDDevice[];
  selectedHidDevice: HIDDevice | undefined;
  onSelectHidDevice: (device: HIDDevice | undefined) => void;
  onRequestHidDevice: () => void;
  keyboardDeviceType: KeyboardDeviceType;
  canRead: boolean;
  busy: boolean;
  onReadConfiguration: () => Promise<KeyBinding[]>;
  existingNames: string[];
  onCancel: () => void;
  onSave: (device: KeyboardProfile) => void;
};

export function AddDeviceWizard({
  hidDevices,
  selectedHidDevice,
  onSelectHidDevice,
  onRequestHidDevice,
  keyboardDeviceType,
  canRead,
  busy,
  onReadConfiguration,
  existingNames,
  onCancel,
  onSave,
}: AddDeviceWizardProps) {
  const [name, setName] = useState("");
  const [userDeviceType, setUserDeviceType] = useState<
    KeyboardDeviceType | undefined
  >();
  const [selectedLayout, setSelectedLayout] = useState<KeyLayout | undefined>();
  const [readBindings, setReadBindings] = useState<KeyBinding[]>([]);
  const [hasRead, setHasRead] = useState(false);
  const [reading, setReading] = useState(false);

  const hardwareType =
    keyboardDeviceType.buttons > 0
      ? {
          ...keyboardDeviceType,
          layers: Math.min(
            Math.max(keyboardDeviceType.layers || 1, 1),
            EDITOR_MAX_LAYERS
          ),
        }
      : DEFAULT_GEOMETRY;
  const effectiveType = userDeviceType ?? hardwareType;
  const layouts = useMemo(
    () => computeLayouts(effectiveType.buttons),
    [effectiveType.buttons]
  );
  const layout =
    selectedLayout &&
    selectedLayout.rows * selectedLayout.columns === effectiveType.buttons
      ? selectedLayout
      : preferredLayout(effectiveType.buttons);

  const nameTaken =
    name.trim().length > 0 && existingNames.includes(name.trim());
  const nameOk = name.trim().length > 0 && !nameTaken;
  const geometryOk =
    effectiveType.buttons > 0 &&
    layout.rows > 0 &&
    layout.columns > 0 &&
    layout.rows * layout.columns === effectiveType.buttons;

  const canSave =
    selectedHidDevice !== undefined &&
    nameOk &&
    geometryOk &&
    (!canRead || hasRead) &&
    !busy &&
    !reading;

  const handleRead = async () => {
    setReading(true);
    try {
      const bindings = await onReadConfiguration();
      setReadBindings(bindings);
      setHasRead(true);
    } finally {
      setReading(false);
    }
  };

  const handleSave = () => {
    if (!selectedHidDevice || !canSave) {
      return;
    }

    const layers = effectiveType.layers || 1;
    const bindingsByLayer: KeyBinding[][] = Array.from(
      { length: layers },
      () => []
    );

    for (const binding of readBindings) {
      if (binding.origin === "placeholder") {
        continue;
      }
      if (binding.layer >= layers) {
        continue;
      }
      bindingsByLayer[binding.layer]!.push({
        ...binding,
        origin: "profile",
      });
    }

    const device: KeyboardProfile = {
      name: name.trim(),
      vendorId: 4489,
      productId: selectedHidDevice.productId,
      keyboardDeviceType: { ...effectiveType },
      userKeyboardDeviceType: { ...effectiveType },
      layout: { ...layout },
      bindingsByLayer,
    };

    onSave(device);
  };

  return (
    <div className="text-default flex max-h-screen min-h-screen flex-col gap-6 overflow-y-auto bg-neutral-100 p-8 dark:bg-neutral-800 dark:text-white">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <div className="flex flex-row items-center gap-3">
          <Button
            variant="invisible"
            className="flex items-center gap-1"
            onClick={onCancel}
          >
            <ArrowLeft className="size-4" />
            Back
          </Button>
        </div>

        <div>
          <H1 size="3xl">Add device</H1>
          <Text className="text-secondary dark:text-neutral-300">
            Connect your keyboard, name it, set its layout, then read the
            current configuration.
          </Text>
        </div>

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-white p-4 dark:border-neutral-600 dark:bg-neutral-900">
          <H2 size="lg">1. Connect keyboard</H2>
          <SelectDevice
            devices={hidDevices}
            selectedDevice={selectedHidDevice}
            onSelectDevice={onSelectHidDevice}
            onAddDevice={onRequestHidDevice}
          />
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-white p-4 dark:border-neutral-600 dark:bg-neutral-900">
          <H2 size="lg">2. Name</H2>
          <Input
            name="device_name"
            type="text"
            placeholder="e.g. Desk macropad"
            value={name}
            onChange={event => setName(event.target.value)}
            size="md"
            disabled={selectedHidDevice === undefined}
          />
          {nameTaken && (
            <Text size="sm" danger>
              A device with this name already exists.
            </Text>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-white p-4 dark:border-neutral-600 dark:bg-neutral-900">
          <H2 size="lg">3. Layout &amp; knobs</H2>
          <Text size="sm" className="text-secondary dark:text-neutral-300">
            Set how many keys, knobs (encoders), and layers this keyboard has,
            then pick the grid layout (e.g. 2×3 for two rows of three). Layers
            are alternate keymaps (usually 1 is enough).
          </Text>
          <SetDeviceType
            keyboardDeviceType={hardwareType}
            userKeyboardDeviceType={userDeviceType}
            onChange={update => {
              setUserDeviceType({
                ...update,
                layers: Math.min(
                  Math.max(update.layers || 1, 1),
                  EDITOR_MAX_LAYERS
                ),
              });
              setSelectedLayout(preferredLayout(update.buttons));
            }}
            maxButtons={Math.max(hardwareType.buttons, 24)}
            maxEncoders={Math.max(hardwareType.encoders, 4)}
            maxLayers={EDITOR_MAX_LAYERS}
          />
          <SelectLayout
            keyboardDeviceType={effectiveType}
            layouts={layouts}
            selectedLayout={layout}
            onSelectLayout={setSelectedLayout}
          />
          {!geometryOk && selectedHidDevice && (
            <Text size="sm" danger>
              Choose a layout whose rows × columns equals the button count (
              {effectiveType.buttons}).
            </Text>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-neutral-300 bg-white p-4 dark:border-neutral-600 dark:bg-neutral-900">
          <H2 size="lg">4. Read current configuration</H2>
          {canRead ? (
            <>
              <Text size="sm" className="text-secondary dark:text-neutral-300">
                Read the key bindings currently stored on the keyboard. This
                becomes the starting point for this device.
              </Text>
              <Button
                className="flex w-fit items-center gap-2"
                onClick={() => void handleRead()}
                disabled={!selectedHidDevice || busy || reading}
                size="lg"
                variant={hasRead ? "default" : "primary"}
              >
                <HardDriveUpload />
                <Text>
                  {reading
                    ? "Reading…"
                    : hasRead
                      ? "Read again"
                      : "Read key-bindings"}
                </Text>
              </Button>
              {hasRead && (
                <Text size="sm">
                  Configuration loaded ({readBindings.length} bindings from
                  keyboard).
                </Text>
              )}
            </>
          ) : (
            <Text size="sm" className="text-secondary dark:text-neutral-300">
              This keyboard model cannot read configuration from hardware. You
              can still save the device and assign keys manually.
            </Text>
          )}
        </section>

        <div className="flex flex-row justify-end gap-3">
          <Button variant="default" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!canSave}
            onClick={handleSave}
            description={
              canRead && !hasRead
                ? "Read the keyboard configuration before saving"
                : undefined
            }
          >
            Save device
          </Button>
        </div>
      </div>
    </div>
  );
}
