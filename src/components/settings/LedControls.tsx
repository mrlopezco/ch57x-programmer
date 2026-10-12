import { Lightbulb } from "lucide-react";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  LED_COLORS,
  LedBacklightColor,
  LedColor,
  LedMode,
  LedSettings,
  LedStatus,
} from "@model/keyboard";
import { Button } from "@ux/Button";
import { Select, SelectOption } from "@ux/Select";
import { Text } from "@ux/Typography";

const MODE_OPTIONS: SelectOption<LedMode["type"]>[] = [
  { value: "Off", label: "Off" },
  { value: "Backlight", label: "Backlight" },
  { value: "Shock", label: "Shock" },
  { value: "Shock2", label: "Shock 2" },
  { value: "Press", label: "Press" },
];

const LAYER_OPTIONS: SelectOption[] = [
  { value: "0", label: "Layer 1" },
  { value: "1", label: "Layer 2" },
  { value: "2", label: "Layer 3" },
];

const COLOR_OPTIONS: SelectOption<LedColor>[] = LED_COLORS.map(color => ({
  value: color,
  label: color,
}));

const BACKLIGHT_COLOR_OPTIONS: SelectOption<LedBacklightColor>[] = [
  { value: "White", label: "White" },
  ...COLOR_OPTIONS,
];

const DEFAULT_SETTINGS: LedSettings = {
  layer: 0,
  mode: { type: "Backlight", color: "White" },
};

function modeFromParts(
  type: LedMode["type"],
  color: LedBacklightColor
): LedMode {
  switch (type) {
    case "Off":
      return { type: "Off" };
    case "Backlight":
      return { type: "Backlight", color };
    case "Shock":
    case "Shock2":
    case "Press":
      return {
        type,
        color: color === "White" ? "Red" : color,
      };
  }
}

export type LedControlsProps = {
  productId?: number | undefined;
  ledStatus: LedStatus;
  ledSettings?: LedSettings | undefined;
  busy: boolean;
  canSend: boolean;
  onChangeLedStatus: (status: LedStatus) => void;
  onChangeLedSettings: (settings: LedSettings) => void;
  onSetLed: (settings: LedSettings) => Promise<boolean>;
};

export function LedControls({
  productId,
  ledStatus,
  ledSettings,
  busy,
  canSend,
  onChangeLedStatus,
  onChangeLedSettings,
  onSetLed,
}: LedControlsProps) {
  const [draft, setDraft] = useState<LedSettings>(
    () => ledSettings ?? DEFAULT_SETTINGS
  );
  const [testing, setTesting] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (ledSettings) {
      setDraft(ledSettings);
    }
  }, [ledSettings]);

  const modeType = draft.mode.type;
  const color: LedBacklightColor =
    draft.mode.type === "Off" ? "White" : draft.mode.color;

  const modeOption = useMemo(
    () => MODE_OPTIONS.find(o => o.value === modeType) ?? MODE_OPTIONS[0]!,
    [modeType]
  );

  const layerOption = useMemo(
    () =>
      LAYER_OPTIONS.find(o => o.value === String(draft.layer)) ??
      LAYER_OPTIONS[0]!,
    [draft.layer]
  );

  const colorOptions =
    modeType === "Backlight" ? BACKLIGHT_COLOR_OPTIONS : COLOR_OPTIONS;

  const colorOption = useMemo(() => {
    const options =
      modeType === "Backlight" ? BACKLIGHT_COLOR_OPTIONS : COLOR_OPTIONS;
    return options.find(o => o.value === color) ?? options[0]!;
  }, [modeType, color]);

  const updateDraft = useCallback(
    (next: LedSettings) => {
      setDraft(next);
      onChangeLedSettings(next);
    },
    [onChangeLedSettings]
  );

  const onTest = useCallback(async () => {
    if (!canSend || testing || busy) {
      return;
    }
    setTesting(true);
    try {
      await onSetLed({
        layer: draft.layer,
        mode: { type: "Backlight", color: "White" },
      });
    } finally {
      setTesting(false);
    }
  }, [canSend, testing, busy, onSetLed, draft.layer]);

  const onApply = useCallback(async () => {
    if (!canSend || applying || busy) {
      return;
    }
    setApplying(true);
    try {
      const ok = await onSetLed(draft);
      if (ok) {
        onChangeLedSettings(draft);
      }
    } finally {
      setApplying(false);
    }
  }, [canSend, applying, busy, onSetLed, draft, onChangeLedSettings]);

  const showCustomize = ledStatus !== "none";

  return (
    <div className="flex flex-col gap-3" role="form" aria-label="LED controls">
      <div className="flex flex-col gap-1">
        <Text strong>LEDs</Text>
        <Text size="sm" className="text-secondary dark:text-neutral-300">
          LED commands are available on this 884x device
          {productId !== undefined
            ? ` (0x${productId.toString(16)})`
            : ""}
          . Watch the hardware during a test — software cannot tell whether
          lights sit under keys or on the controller.
        </Text>
      </div>

      {!canSend && (
        <Text size="sm" className="text-amber-700 dark:text-amber-400">
          Connect this keyboard in the sidebar to run LED tests and apply
          settings.
        </Text>
      )}

      <Button
        className="flex items-center gap-2"
        onClick={() => void onTest()}
        disabled={!canSend || busy || testing}
        size="lg"
        description="Send a white backlight command so you can check for LEDs"
      >
        <Lightbulb className="size-4" />
        <Text>{testing ? "Testing…" : "Test LEDs"}</Text>
      </Button>

      <div className="flex flex-col gap-2">
        <Text size="sm">Did you see lights?</Text>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={ledStatus === "confirmed" ? "primary" : "default"}
            onClick={() => onChangeLedStatus("confirmed")}
            description="Confirm this keyboard has working LEDs"
          >
            Lights worked
          </Button>
          <Button
            size="sm"
            variant={ledStatus === "none" ? "primary" : "default"}
            onClick={() => onChangeLedStatus("none")}
            description="Mark that this keyboard has no visible LEDs"
          >
            No lights
          </Button>
        </div>
        {ledStatus === "unknown" && (
          <Text size="sm" className="text-secondary dark:text-neutral-300">
            Status: not confirmed yet
          </Text>
        )}
        {ledStatus === "confirmed" && (
          <Text size="sm" className="text-secondary dark:text-neutral-300">
            Status: LEDs confirmed
          </Text>
        )}
        {ledStatus === "none" && (
          <Text size="sm" className="text-secondary dark:text-neutral-300">
            Status: no LEDs observed — customize stays hidden; you can still
            retest
          </Text>
        )}
      </div>

      {showCustomize && (
        <div className="flex flex-col gap-2">
          <Text size="sm">Mode</Text>
          <Select
            value={modeOption}
            options={MODE_OPTIONS}
            onChange={option =>
              updateDraft({
                layer: draft.layer,
                mode: modeFromParts(option.value, color),
              })
            }
          />

          {modeType !== "Off" && (
            <>
              <Text size="sm">Color</Text>
              <Select
                value={colorOption}
                options={colorOptions}
                onChange={option =>
                  updateDraft({
                    layer: draft.layer,
                    mode: modeFromParts(modeType, option.value),
                  })
                }
              />
            </>
          )}

          <Text size="sm">Layer</Text>
          <Select
            value={layerOption}
            options={LAYER_OPTIONS}
            onChange={option =>
              updateDraft({
                layer: Number(option.value),
                mode: draft.mode,
              })
            }
          />

          <Button
            className="flex items-center gap-2"
            onClick={() => void onApply()}
            disabled={!canSend || busy || applying}
            size="lg"
            variant="primary"
            description="Write the selected LED mode to the keyboard"
          >
            <Text>{applying ? "Applying…" : "Apply LED settings"}</Text>
          </Button>
        </div>
      )}
    </div>
  );
}
