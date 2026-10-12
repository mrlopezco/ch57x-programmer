import { Input } from "@headlessui/react";
import { cva } from "class-variance-authority";
import React, { useCallback } from "react";

import { KeyboardDeviceType } from "@model/keyboard";
import { Text } from "@ux/Typography";

export type SetDeviceTypeProps = {
  keyboardDeviceType: KeyboardDeviceType;
  userKeyboardDeviceType: KeyboardDeviceType | undefined;
  onChange: (update: KeyboardDeviceType) => void;
  /** Upper bound for buttons; defaults to hardware-reported max when available. */
  maxButtons?: number;
  maxEncoders?: number;
  maxLayers?: number;
};

const input = cva([
  "rounded-lg border border-neutral-300 bg-neutral-100 p-2 hover:border-neutral-500",
  "p-2 dark:border-neutral-600 dark:bg-neutral-800 dark:hover:border-neutral-400",
]);

export function SetDeviceType({
  keyboardDeviceType,
  userKeyboardDeviceType,
  onChange,
  maxButtons,
  maxEncoders,
  maxLayers,
}: SetDeviceTypeProps) {
  const buttons = userKeyboardDeviceType?.buttons ?? keyboardDeviceType.buttons;
  const encoders =
    userKeyboardDeviceType?.encoders ?? keyboardDeviceType.encoders;
  const layers = userKeyboardDeviceType?.layers ?? keyboardDeviceType.layers;

  const buttonsMax = Math.max(
    maxButtons ?? keyboardDeviceType.buttons,
    buttons,
    1
  );
  const encodersMax = Math.max(
    maxEncoders ?? keyboardDeviceType.encoders,
    encoders,
    0
  );
  const layersMax = Math.max(maxLayers ?? keyboardDeviceType.layers, layers, 1);

  const onChangeButtons = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.valueAsNumber;
      if (Number.isInteger(next) && next > 0 && next <= buttonsMax) {
        onChange({
          family: keyboardDeviceType.family,
          buttons: next,
          encoders,
          layers,
        });
      }
    },
    [encoders, layers, onChange, buttonsMax, keyboardDeviceType.family]
  );
  const onChangeEncoders = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.valueAsNumber;
      if (Number.isInteger(next) && next >= 0 && next <= encodersMax) {
        onChange({
          family: keyboardDeviceType.family,
          buttons,
          encoders: next,
          layers,
        });
      }
    },
    [buttons, layers, onChange, encodersMax, keyboardDeviceType.family]
  );
  const onChangeLayers = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.valueAsNumber;
      if (Number.isInteger(next) && next > 0 && next <= layersMax) {
        onChange({
          family: keyboardDeviceType.family,
          buttons,
          encoders,
          layers: next,
        });
      }
    },
    [buttons, encoders, onChange, layersMax, keyboardDeviceType.family]
  );

  return (
    <>
      <Text strong>Buttons:</Text>
      <Input
        className={input()}
        value={buttons}
        type="number"
        min="1"
        max={buttonsMax}
        onChange={onChangeButtons}
      />
      <Text strong>Encoders (knobs):</Text>
      <Input
        className={input()}
        value={encoders}
        type="number"
        min="0"
        max={encodersMax}
        onChange={onChangeEncoders}
      />
      <Text strong>Layers:</Text>
      <Input
        className={input()}
        value={layers}
        type="number"
        min="1"
        max={layersMax}
        onChange={onChangeLayers}
      />
    </>
  );
}
