import {
  ArrowLeft,
  HardDriveDownload,
  HardDriveUpload,
  Save,
} from "lucide-react";
import React from "react";

import { KeyboardDeviceType } from "@model/keyboard";
import { Button } from "@ux/Button";
import { Expando } from "@ux/Expando";
import { H3, Text } from "@ux/Typography";

import { Settings } from "../hooks/useSettings";
import { LedControls, LedControlsProps } from "./LedControls";
import { SelectDevice, SelectDeviceProps } from "./SelectDevice";
import { SelectLayout, SelectLayoutProps } from "./SelectLayout";
import { SetDeviceType } from "./SetDeviceType";
import { SettingsEditor } from "./SettingsEditor";

export type ConfigurationProps = {
  deviceName: string;
  canReadWriteConfiguration: boolean;
  onReadConfiguration: (() => void | Promise<unknown>) | undefined;
  onWriteConfiguration: () => void;
  onSaveDevice: () => void;
  onBack: () => void;
  userKeyboardDeviceType: KeyboardDeviceType | undefined;
  onChangeKeyboardDeviceType: (update: KeyboardDeviceType) => void;
  settings: Settings;
  onChangeSettings: (update: Settings) => void;
  /** Show full LED controls (884x family). */
  supportsLed: boolean;
  ledControls?: Omit<LedControlsProps, "canSend" | "busy"> | undefined;
  ledBusy?: boolean | undefined;
  /** Product ID for LED availability messaging when controls are hidden. */
  ledProductId?: number | undefined;
} & SelectDeviceProps &
  SelectLayoutProps;

export function Configuration(props: ConfigurationProps) {
  return (
    <Expando
      defaultOpen
      title={<H3 size="lg">{props.deviceName}</H3>}
      className="max-h-screen overflow-y-auto border-r border-neutral-400 bg-neutral-200 dark:border-neutral-500 dark:bg-neutral-700"
      openContent={<OpenConfiguration {...props} />}
      collapseDirection="left"
      aria-label="Keyboard configuration"
    />
  );
}

function OpenConfiguration({
  deviceName,
  devices,
  selectedDevice,
  onAddDevice,
  onSelectDevice,
  layouts,
  selectedLayout,
  onSelectLayout,
  keyboardDeviceType,
  userKeyboardDeviceType,
  onChangeKeyboardDeviceType,
  canReadWriteConfiguration,
  onReadConfiguration,
  onWriteConfiguration,
  onSaveDevice,
  onBack,
  settings,
  onChangeSettings,
  supportsLed,
  ledControls,
  ledBusy,
  ledProductId,
}: ConfigurationProps) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex flex-col gap-2" role="form">
        <Button
          variant="invisible"
          className="flex w-fit items-center gap-1"
          onClick={onBack}
        >
          <ArrowLeft className="size-4" />
          <Text>All devices</Text>
        </Button>

        <Text strong size="lg">
          {deviceName}
        </Text>

        <SelectDevice
          devices={devices}
          selectedDevice={selectedDevice}
          onSelectDevice={onSelectDevice}
          onAddDevice={onAddDevice}
        />

        <SetDeviceType
          keyboardDeviceType={userKeyboardDeviceType ?? keyboardDeviceType}
          userKeyboardDeviceType={userKeyboardDeviceType}
          onChange={onChangeKeyboardDeviceType}
          maxButtons={Math.max(
            userKeyboardDeviceType?.buttons ?? keyboardDeviceType.buttons,
            24
          )}
          maxEncoders={Math.max(
            userKeyboardDeviceType?.encoders ?? keyboardDeviceType.encoders,
            4
          )}
          maxLayers={3}
        />

        <SelectLayout
          keyboardDeviceType={userKeyboardDeviceType ?? keyboardDeviceType}
          layouts={layouts}
          selectedLayout={selectedLayout}
          onSelectLayout={onSelectLayout}
        />

        {supportsLed && ledControls ? (
          <LedControls
            {...ledControls}
            canSend={canReadWriteConfiguration}
            busy={ledBusy ?? false}
          />
        ) : (
          <div className="flex flex-col gap-1" aria-label="LED controls">
            <Text strong>LEDs</Text>
            <Text size="sm" className="text-secondary dark:text-neutral-300">
              {ledProductId === 0x8890
                ? "This 8890 keyboard model does not expose LED controls in this app."
                : ledProductId !== undefined
                  ? `LED controls are not available for product 0x${ledProductId.toString(16)}. Connect a 8840/8842 device, or use Add keyboard if it is already plugged in.`
                  : "Connect the keyboard (sidebar → Add keyboard) to detect whether LED commands are supported."}
            </Text>
          </div>
        )}

        <Button
          className="flex items-center gap-2"
          onClick={() => void onReadConfiguration?.()}
          disabled={!canReadWriteConfiguration || !onReadConfiguration}
          size="lg"
          description="Read the current key-bindings from the connected keyboard"
        >
          <HardDriveUpload />
          <Text>Read key-bindings</Text>
        </Button>
        <Button
          className="flex items-center gap-2"
          onClick={onWriteConfiguration}
          disabled={!canReadWriteConfiguration}
          size="lg"
          description="Write the current key-bindings to the connected keyboard"
        >
          <HardDriveDownload />
          <Text>Write key-bindings</Text>
        </Button>
        <Button
          className="flex items-center gap-2"
          onClick={onSaveDevice}
          size="lg"
          variant="primary"
          description="Save this device configuration in the browser"
        >
          <Save />
          <Text>Save device</Text>
        </Button>
      </div>

      <SettingsEditor
        className="mt-auto"
        onChange={onChangeSettings}
        {...settings}
      />
    </div>
  );
}
