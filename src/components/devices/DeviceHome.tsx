import { Plus, Trash2 } from "lucide-react";
import React from "react";
import { twJoin } from "tailwind-merge";

import { KeyboardProfile } from "@model/keyboard_profile";
import { Button } from "@ux/Button";
import { H1, H2, Text } from "@ux/Typography";

import { Settings } from "../hooks/useSettings";
import { LayoutIcon } from "../LayoutIcon";
import { SettingsEditor } from "../settings/SettingsEditor";

export type DeviceHomeProps = {
  devices: KeyboardProfile[];
  onAddDevice: () => void;
  onOpenDevice: (device: KeyboardProfile) => void;
  onDeleteDevice: (device: KeyboardProfile) => void;
  settings: Settings;
  onChangeSettings: (update: Settings) => void;
};

export function DeviceHome({
  devices,
  onAddDevice,
  onOpenDevice,
  onDeleteDevice,
  settings,
  onChangeSettings,
}: DeviceHomeProps) {
  return (
    <div className="text-default flex max-h-screen min-h-screen flex-col gap-6 overflow-y-auto bg-neutral-100 p-8 dark:bg-neutral-800 dark:text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-row items-center gap-3">
          <LayoutIcon rows={2} columns={3} encoders={1} className="size-10" />
          <div>
            <H1 size="3xl">ch57x keyboard tool</H1>
            <Text className="text-secondary dark:text-neutral-300">
              Select a saved device or add a new one
            </Text>
          </div>
        </div>

        <div className="flex flex-row items-center justify-between">
          <H2 size="xl">Your devices</H2>
          <Button
            variant="primary"
            className="flex items-center gap-2"
            onClick={onAddDevice}
          >
            <Plus className="size-4" />
            Add device
          </Button>
        </div>

        {devices.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-400 bg-white p-8 text-center dark:border-neutral-500 dark:bg-neutral-900">
            <Text>
              No devices yet. Click <Text strong>Add device</Text> to connect
              your keyboard, name it, set layout, and read its current
              configuration.
            </Text>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {devices.map(device => (
              <li key={`${device.vendorId}-${device.productId}-${device.name}`}>
                <div
                  className={twJoin(
                    "flex flex-row items-center gap-4 rounded-xl border p-4",
                    "border-neutral-300 bg-white hover:border-neutral-500",
                    "dark:border-neutral-600 dark:bg-neutral-900 dark:hover:border-neutral-400"
                  )}
                >
                  <button
                    type="button"
                    className="flex flex-1 cursor-pointer flex-row items-center gap-4 text-left"
                    onClick={() => onOpenDevice(device)}
                  >
                    <LayoutIcon
                      {...device.layout}
                      encoders={
                        device.userKeyboardDeviceType?.encoders ??
                        device.keyboardDeviceType.encoders
                      }
                      className="size-10 shrink-0"
                    />
                    <div className="flex min-w-0 flex-col">
                      <Text strong size="lg">
                        {device.name}
                      </Text>
                      <Text
                        size="sm"
                        className="text-secondary tabular-nums dark:text-neutral-300"
                      >
                        {device.layout.rows}×{device.layout.columns}
                        {" · "}
                        {device.userKeyboardDeviceType?.buttons ??
                          device.keyboardDeviceType.buttons}{" "}
                        keys
                        {" · "}
                        {device.userKeyboardDeviceType?.encoders ??
                          device.keyboardDeviceType.encoders}{" "}
                        knobs
                        {" · "}
                        {device.userKeyboardDeviceType?.layers ??
                          device.keyboardDeviceType.layers}{" "}
                        layers
                      </Text>
                      <Text
                        size="xs"
                        className="text-secondary tabular-nums dark:text-neutral-400"
                      >
                        0x{device.vendorId.toString(16)}:0x
                        {device.productId.toString(16)}
                      </Text>
                    </div>
                  </button>
                  <Button
                    size="sm"
                    className="flex items-center gap-1"
                    description="Delete this saved device"
                    onClick={() => onDeleteDevice(device)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <SettingsEditor
          className="mt-4"
          onChange={onChangeSettings}
          {...settings}
        />
      </div>
    </div>
  );
}
