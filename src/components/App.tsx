import { Tab, TabGroup, TabList, TabPanel, TabPanels } from "@headlessui/react";
import { cva } from "class-variance-authority";
import { Asterisk, HardDriveDownload, HardDriveUpload } from "lucide-react";
import React, {
  startTransition,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEventListener } from "usehooks-ts";

import { HidChange, useHidChange } from "@hooks/useHidChange";
import { useValueChange } from "@hooks/useValueChange";
import {
  KeyBinding,
  KeyboardDeviceType,
  keysAreEqual,
  keysCompare,
  LedSettings,
  LedStatus,
  Macro,
  NoopKeyboard,
} from "@model/keyboard";
import { makeKeyboard884x } from "@model/keyboard_884x";
import { makeKeyboard8890 } from "@model/keyboard_8890";
import {
  forceOriginsToProfile,
  KeyboardProfile,
  KeyLayout,
  loadProfiles,
  saveProfiles,
} from "@model/keyboard_profile";
import { computeLayouts } from "@model/layouts";
import { productSupportsLed, scanForKeyboard } from "@model/usb";
import { KeyboardDevice, useKeyboardDevice } from "@model/useKeyboardDevice";
import { KeyboardLayoutProvider } from "@model/useKeyboardLayout";
import { Button } from "@ux/Button";
import { H1, H2, Text } from "@ux/Typography";

import { AddDeviceWizard } from "./devices/AddDeviceWizard";
import { DeviceHome } from "./devices/DeviceHome";
import { EditKey } from "./editors/EditKey";
import { useSettings } from "./hooks/useSettings";
import { Layer } from "./Layer";
import { LayoutIcon } from "./LayoutIcon";
import { Configuration } from "./settings/Configuration";
import { Unsupported } from "./Unsupported";

type AppView = "home" | "wizard" | "editor";

const layertab = cva(
  [
    "flex flex-row items-start rounded-md border px-3 py-1",
    "border-neutral-300 hover:border-neutral-500",
    "dark:border-neutral-600 dark:hover:border-neutral-400",
  ],
  {
    variants: {
      selected: {
        true: "bg-indigo-500/30",
        false: "bg-white dark:bg-neutral-900",
      },
    },
  }
);

function cloneBindings(bindingsByLayer: KeyBinding[][]): KeyBinding[][] {
  return JSON.parse(JSON.stringify(bindingsByLayer)) as KeyBinding[][];
}

function bindingsFromDeviceRead(
  keyBindings: KeyBinding[],
  layers: number,
  buttons: number,
  encoders: number
): KeyBinding[][] {
  const result: KeyBinding[][] = Array.from({ length: layers }, () => []);
  for (const binding of keyBindings) {
    if (binding.origin === "placeholder") {
      continue;
    }
    if (binding.layer >= layers) {
      continue;
    }
    if (typeof binding.key === "number") {
      if (binding.key >= buttons) {
        continue;
      }
    } else if (binding.key[0] >= encoders) {
      continue;
    }
    result[binding.layer]!.push({ ...binding, origin: "device" });
  }
  for (const layer of result) {
    layer.sort((a, b) => keysCompare(a.key, b.key));
  }
  return result;
}

export function App() {
  const { settings, changeSettings } = useSettings();
  const [view, setView] = useState<AppView>("home");
  const [hidDevices, setHidDevices] = useState<HIDDevice[]>([]);
  const [selectedHidIndex, setSelectedHidIndex] = useState(-1);
  const [keyboardDevice, setKeyboardDevice] = useState<KeyboardDevice>({
    keyboard: NoopKeyboard,
  });
  const [savedDevices, setSavedDevices] = useState<KeyboardProfile[]>(() =>
    loadProfiles()
  );
  const [activeDevice, setActiveDevice] = useState<
    KeyboardProfile | undefined
  >();
  const [selectedLayout, setSelectedLayout] = useState<KeyLayout>({
    rows: 0,
    columns: 0,
  });
  const [userKeyboardDeviceType, setUserKeyboardDeviceType] = useState<
    KeyboardDeviceType | undefined
  >();
  const [baseBindings, setBaseBindings] = useState<KeyBinding[][]>([]);
  const [editedBindings, setEditedBindings] = useState<KeyBinding[]>([]);

  const currentHidDevice = useMemo(
    () => (selectedHidIndex >= 0 ? hidDevices[selectedHidIndex] : undefined),
    [hidDevices, selectedHidIndex]
  );

  const {
    readConfiguration,
    keyboardDeviceType,
    busy,
    errors: keyboardErrors,
    writeKeyBindings,
    setLed,
    capabilities,
  } = useKeyboardDevice(keyboardDevice);

  const [ledStatus, setLedStatus] = useState<LedStatus>("unknown");
  const [ledSettings, setLedSettings] = useState<LedSettings | undefined>();

  // Always prefer the user's saved geometry so HID packets cannot reset the grid.
  const effectiveDeviceType = useMemo<KeyboardDeviceType>(() => {
    if (userKeyboardDeviceType && userKeyboardDeviceType.buttons > 0) {
      return userKeyboardDeviceType;
    }
    if (keyboardDeviceType.buttons > 0) {
      return {
        ...keyboardDeviceType,
        layers: Math.min(Math.max(keyboardDeviceType.layers || 1, 1), 3),
      };
    }
    return {
      family: keyboardDeviceType.family,
      buttons: 6,
      encoders: 1,
      layers: 1,
    };
  }, [userKeyboardDeviceType, keyboardDeviceType]);

  const bindingsByLayer = useMemo(() => {
    const layers: KeyBinding[][] = Array(effectiveDeviceType.layers || 1)
      .fill(null)
      .map(() => []);

    const buttons = effectiveDeviceType.buttons;
    const encoders = effectiveDeviceType.encoders;

    for (const binding of baseBindings.flat()) {
      if (binding.layer >= layers.length) {
        continue;
      }
      if (typeof binding.key === "number") {
        if (binding.key >= buttons) {
          continue;
        }
      } else if (binding.key[0] >= encoders) {
        continue;
      }
      const layer = layers[binding.layer]!;
      if (!layer.some(({ key }) => keysAreEqual(key, binding.key))) {
        layer.push(binding);
      }
    }

    for (const edited of editedBindings) {
      const layer = layers[edited.layer];
      if (!layer) {
        continue;
      }
      const index = layer.findIndex(({ key }) => keysAreEqual(key, edited.key));
      if (index < 0) {
        layer.push(edited);
      } else {
        layer[index] = edited;
      }
    }

    for (const layer of layers) {
      layer.sort((a, b) => keysCompare(a.key, b.key));
    }
    return layers;
  }, [baseBindings, editedBindings, effectiveDeviceType]);

  const attachHidKeyboard = useCallback((workingDevice: HIDDevice) => {
    if ((workingDevice.productId & 0x884f) === workingDevice.productId) {
      setKeyboardDevice(prev =>
        prev.device === workingDevice &&
        prev.keyboard.name !== NoopKeyboard.name
          ? prev
          : { keyboard: makeKeyboard884x(), device: workingDevice }
      );
      return;
    }
    if (workingDevice.productId === 0x8890) {
      setKeyboardDevice(prev =>
        prev.device === workingDevice &&
        prev.keyboard.name !== NoopKeyboard.name
          ? prev
          : { keyboard: makeKeyboard8890(), device: workingDevice }
      );
    }
  }, []);

  const onHidDeviceChange = useCallback(
    (workingDevice: HIDDevice | undefined) => {
      if (workingDevice === undefined) {
        startTransition(() => {
          setKeyboardDevice(prev => {
            if (prev.keyboard.name === NoopKeyboard.name) {
              return prev;
            }
            return { keyboard: NoopKeyboard };
          });
        });
        return;
      }

      if (workingDevice.opened) {
        attachHidKeyboard(workingDevice);
        return;
      }

      workingDevice
        .open()
        .then(() => attachHidKeyboard(workingDevice))
        .catch(error =>
          console.error("Error opening device:", workingDevice, error)
        );
    },
    [attachHidKeyboard]
  );
  useValueChange(currentHidDevice, onHidDeviceChange);

  const scan = useCallback(
    (force: boolean) => {
      scanForKeyboard(force)
        .then(devices => {
          setHidDevices(devices);
          if (devices.length === 0) {
            setSelectedHidIndex(-1);
          } else if (
            selectedHidIndex === -1 ||
            selectedHidIndex >= devices.length
          ) {
            setSelectedHidIndex(0);
          }
        })
        .catch(error => console.error(error));
    },
    [selectedHidIndex]
  );

  const onVisibilityChange = useCallback(() => {
    if (document.hidden) {
      saveProfiles(savedDevices);
    } else {
      scan(false);
    }
  }, [savedDevices, scan]);
  const documentRef = useRef(document);
  useEventListener("visibilitychange", onVisibilityChange, documentRef);

  const [started, setStarted] = useState(false);
  const onStarted = useCallback(
    (value: boolean) => {
      if (!value) {
        setStarted(true);
        scan(false);
      }
    },
    [scan]
  );
  useValueChange(started, onStarted, { callOnMount: true });

  const onHidChange = useCallback(
    (change: HidChange) => {
      if (change === "Connected" || change === "Disconnected") {
        scan(false);
      }
    },
    [scan]
  );
  const hidChange = useHidChange(onHidChange);

  const layouts = useMemo(
    () => computeLayouts(effectiveDeviceType.buttons),
    [effectiveDeviceType.buttons]
  );

  const [selectedBinding, setSelectedBinding] = useState<
    Omit<KeyBinding, "expansion" | "origin">
  >({
    key: -1,
    layer: -1,
  });

  const [workingMacro, setWorkingMacro] = useState<Macro | undefined>();

  const selectBinding = useCallback(
    ({ key, layer }: Omit<KeyBinding, "expansion" | "origin">) => {
      setSelectedBinding(prev => {
        if (keysAreEqual(prev.key, key) && prev.layer === layer) {
          return prev;
        }
        return { key, layer };
      });
      setWorkingMacro(undefined);
    },
    []
  );

  const currentBinding = useMemo(() => {
    if (selectedBinding.key === -1 || selectedBinding.layer === -1) {
      return;
    }
    const layer = bindingsByLayer[selectedBinding.layer] ?? [];
    return layer.find(binding =>
      keysAreEqual(binding.key, selectedBinding.key)
    );
  }, [bindingsByLayer, selectedBinding]);

  const commitWorkingMacro = useCallback(() => {
    if (!workingMacro) {
      return;
    }
    if (selectedBinding.key === -1 || selectedBinding.layer === -1) {
      return;
    }
    const target = currentBinding ?? {
      key: selectedBinding.key,
      layer: selectedBinding.layer,
      expansion: workingMacro,
      origin: "editor" as const,
    };
    const updated = [...editedBindings];
    const index = updated.findIndex(
      ({ key, layer }) =>
        target.layer === layer && keysAreEqual(target.key, key)
    );
    if (index < 0) {
      updated.push({
        ...target,
        expansion: workingMacro,
        origin: "editor",
      });
    } else {
      updated[index] = {
        ...target,
        expansion: workingMacro,
        origin: "editor",
      };
    }
    setEditedBindings(updated);
    setWorkingMacro(undefined);
  }, [workingMacro, currentBinding, editedBindings, selectedBinding]);

  const onClearLayerEdits = useCallback((layer: number) => {
    setEditedBindings(prev => prev.filter(binding => binding.layer !== layer));
  }, []);

  const persistDevices = useCallback((devices: KeyboardProfile[]) => {
    setSavedDevices(devices);
    saveProfiles(devices);
  }, []);

  const applyReadBindings = useCallback(
    (bindings: KeyBinding[]) => {
      const next = bindingsFromDeviceRead(
        bindings,
        effectiveDeviceType.layers || 1,
        effectiveDeviceType.buttons,
        effectiveDeviceType.encoders
      );
      setBaseBindings(next);
      setEditedBindings([]);
      setActiveDevice(prev =>
        prev
          ? {
              ...prev,
              layout: { ...selectedLayout },
              userKeyboardDeviceType: userKeyboardDeviceType
                ? { ...userKeyboardDeviceType }
                : prev.userKeyboardDeviceType,
              bindingsByLayer: cloneBindings(next),
            }
          : prev
      );
      return next;
    },
    [effectiveDeviceType, selectedLayout, userKeyboardDeviceType]
  );

  const onReadConfiguration = useCallback(async (): Promise<KeyBinding[]> => {
    if (!capabilities.readConfiguration) {
      return [];
    }
    const bindings = await readConfiguration();
    if (view === "editor" && bindings.length > 0) {
      applyReadBindings(bindings);
    }
    return bindings;
  }, [
    readConfiguration,
    capabilities.readConfiguration,
    view,
    applyReadBindings,
  ]);

  const [writing, setWriting] = useState(false);
  const onWriteConfiguration = useCallback(() => {
    if (writing) {
      return;
    }
    setWriting(true);
    const writtenLayers = cloneBindings(bindingsByLayer);
    writeKeyBindings(writtenLayers.flat())
      .then(succeeded => {
        if (!succeeded) {
          return;
        }
        // Keep showing exactly what we wrote — do not auto-read from HID.
        const asDevice = writtenLayers.map(layer =>
          layer.map(binding => ({ ...binding, origin: "device" as const }))
        );
        setBaseBindings(asDevice);
        setEditedBindings([]);

        if (!activeDevice) {
          return;
        }
        const persisted: KeyboardProfile = {
          ...activeDevice,
          layout: { ...selectedLayout },
          userKeyboardDeviceType: userKeyboardDeviceType
            ? { ...userKeyboardDeviceType }
            : activeDevice.userKeyboardDeviceType,
          keyboardDeviceType: userKeyboardDeviceType
            ? { ...userKeyboardDeviceType }
            : { ...activeDevice.keyboardDeviceType },
          bindingsByLayer: cloneBindings(asDevice),
        };
        forceOriginsToProfile(persisted.bindingsByLayer);
        setActiveDevice(persisted);
        const next = [...savedDevices];
        const index = next.findIndex(d => d.name === persisted.name);
        if (index < 0) {
          next.push(persisted);
        } else {
          next[index] = persisted;
        }
        persistDevices(next);
      })
      .catch(error => console.error(error))
      .finally(() => setWriting(false));
  }, [
    writing,
    writeKeyBindings,
    bindingsByLayer,
    activeDevice,
    selectedLayout,
    userKeyboardDeviceType,
    savedDevices,
    persistDevices,
  ]);

  const buildActiveProfile = useCallback((): KeyboardProfile | undefined => {
    if (!activeDevice) {
      return;
    }
    const bindings = cloneBindings(bindingsByLayer);
    forceOriginsToProfile(bindings);
    const geometry = { ...effectiveDeviceType };
    return {
      ...activeDevice,
      keyboardDeviceType: geometry,
      userKeyboardDeviceType: geometry,
      layout: { ...selectedLayout },
      bindingsByLayer: bindings,
      ledStatus,
      ledSettings,
    };
  }, [
    activeDevice,
    bindingsByLayer,
    effectiveDeviceType,
    selectedLayout,
    ledStatus,
    ledSettings,
  ]);

  const onChangeLedStatus = useCallback((status: LedStatus) => {
    setLedStatus(status);
    setActiveDevice(prev => (prev ? { ...prev, ledStatus: status } : prev));
  }, []);

  const onChangeLedSettings = useCallback((settings: LedSettings) => {
    setLedSettings(settings);
    setActiveDevice(prev =>
      prev ? { ...prev, ledSettings: settings } : prev
    );
  }, []);

  const onSaveDevice = useCallback(() => {
    const updated = buildActiveProfile();
    if (!updated) {
      return;
    }
    setActiveDevice(updated);
    const next = [...savedDevices];
    const index = next.findIndex(d => d.name === updated.name);
    if (index < 0) {
      next.push(updated);
    } else {
      next[index] = updated;
    }
    persistDevices(next);
    setEditedBindings([]);
    setBaseBindings(cloneBindings(updated.bindingsByLayer));
  }, [buildActiveProfile, savedDevices, persistDevices]);

  const onOpenDevice = useCallback(
    (device: KeyboardProfile) => {
      setActiveDevice(device);
      setSelectedLayout({ ...device.layout });
      const geometry = {
        ...(device.userKeyboardDeviceType ?? device.keyboardDeviceType),
      };
      geometry.layers = Math.min(Math.max(geometry.layers || 1, 1), 3);
      setUserKeyboardDeviceType(geometry);
      setBaseBindings(cloneBindings(device.bindingsByLayer));
      setEditedBindings([]);
      setLedStatus(device.ledStatus ?? "unknown");
      setLedSettings(device.ledSettings ?? undefined);
      setSelectedBinding({ key: -1, layer: -1 });
      setWorkingMacro(undefined);

      const matchIndex = hidDevices.findIndex(
        d => d.vendorId === device.vendorId && d.productId === device.productId
      );
      if (matchIndex >= 0) {
        setSelectedHidIndex(matchIndex);
        const matched = hidDevices[matchIndex];
        if (matched) {
          onHidDeviceChange(matched);
        }
      } else {
        setSelectedHidIndex(-1);
        // No granted HID yet — prompt the browser picker.
        scanForKeyboard(true)
          .then(devices => {
            setHidDevices(devices);
            const index = devices.findIndex(
              d =>
                d.vendorId === device.vendorId &&
                d.productId === device.productId
            );
            if (index >= 0) {
              setSelectedHidIndex(index);
            } else if (devices.length > 0) {
              setSelectedHidIndex(0);
            }
          })
          .catch(error => console.error(error));
      }

      setView("editor");
    },
    [hidDevices, onHidDeviceChange]
  );

  const onDeleteDevice = useCallback(
    (device: KeyboardProfile) => {
      const next = savedDevices.filter(d => d.name !== device.name);
      persistDevices(next);
    },
    [savedDevices, persistDevices]
  );

  const onWizardSave = useCallback(
    (device: KeyboardProfile) => {
      const next = [...savedDevices];
      const index = next.findIndex(d => d.name === device.name);
      if (index < 0) {
        next.push(device);
      } else {
        next[index] = device;
      }
      persistDevices(next);
      setView("home");
    },
    [savedDevices, persistDevices]
  );

  const onSelectHidDevice = useCallback(
    (device: HIDDevice | undefined) => {
      setSelectedHidIndex(device ? hidDevices.indexOf(device) : -1);
    },
    [hidDevices]
  );

  if (hidChange === "NotSupported") {
    return <Unsupported />;
  }

  if (view === "home") {
    return (
      <KeyboardLayoutProvider>
        <DeviceHome
          devices={savedDevices}
          onAddDevice={() => setView("wizard")}
          onOpenDevice={onOpenDevice}
          onDeleteDevice={onDeleteDevice}
          settings={settings}
          onChangeSettings={changeSettings}
        />
      </KeyboardLayoutProvider>
    );
  }

  if (view === "wizard") {
    return (
      <KeyboardLayoutProvider>
        <AddDeviceWizard
          hidDevices={hidDevices}
          selectedHidDevice={currentHidDevice}
          onSelectHidDevice={onSelectHidDevice}
          onRequestHidDevice={() => scan(true)}
          keyboardDeviceType={keyboardDeviceType}
          canRead={capabilities.readConfiguration}
          busy={busy}
          onReadConfiguration={onReadConfiguration}
          existingNames={savedDevices.map(d => d.name)}
          onCancel={() => setView("home")}
          onSave={onWizardSave}
        />
      </KeyboardLayoutProvider>
    );
  }

  return (
    <KeyboardLayoutProvider>
      <div className="text-default flex max-h-screen min-h-screen flex-row gap-2 overflow-hidden bg-neutral-100 dark:bg-neutral-800 dark:text-white">
        <Configuration
          deviceName={activeDevice?.name ?? "Device"}
          devices={hidDevices}
          selectedDevice={currentHidDevice}
          onSelectDevice={onSelectHidDevice}
          onAddDevice={() => scan(true)}
          layouts={layouts}
          selectedLayout={selectedLayout}
          onSelectLayout={update => setSelectedLayout(update)}
          keyboardDeviceType={effectiveDeviceType}
          userKeyboardDeviceType={userKeyboardDeviceType ?? effectiveDeviceType}
          onChangeKeyboardDeviceType={update => {
            setUserKeyboardDeviceType({
              ...update,
              layers: Math.min(Math.max(update.layers || 1, 1), 3),
            });
          }}
          canReadWriteConfiguration={currentHidDevice !== undefined && !busy}
          onReadConfiguration={
            capabilities.readConfiguration ? onReadConfiguration : undefined
          }
          onWriteConfiguration={onWriteConfiguration}
          onSaveDevice={onSaveDevice}
          onBack={() => {
            setView("home");
            setActiveDevice(undefined);
          }}
          settings={settings}
          onChangeSettings={changeSettings}
          supportsLed={
            capabilities.supportsLed ||
            productSupportsLed(
              currentHidDevice?.productId ?? activeDevice?.productId ?? 0
            )
          }
          ledBusy={busy}
          ledProductId={
            currentHidDevice?.productId ?? activeDevice?.productId
          }
          ledControls={
            capabilities.supportsLed ||
            productSupportsLed(
              currentHidDevice?.productId ?? activeDevice?.productId ?? 0
            )
              ? {
                  productId:
                    currentHidDevice?.productId ?? activeDevice?.productId,
                  ledStatus,
                  ledSettings,
                  onChangeLedStatus,
                  onChangeLedSettings,
                  onSetLed: setLed,
                }
              : undefined
          }
        />
        <div className="flex flex-1 flex-col items-center gap-4 overflow-y-scroll">
          <div className="flex flex-col gap-2">
            <H1 className="m-4 inline-flex items-center gap-2">
              <LayoutIcon
                rows={selectedLayout.rows || 2}
                columns={selectedLayout.columns || 3}
                encoders={effectiveDeviceType.encoders}
              />
              {activeDevice?.name ?? "Device"}
            </H1>
            {currentHidDevice === undefined && (
              <Text
                size="sm"
                className="mx-4 text-amber-700 dark:text-amber-400"
              >
                Keyboard not connected. Use the sidebar Keyboard dropdown → Add
                keyboard, then Read becomes available.
              </Text>
            )}
            <TabGroup className="flex flex-row gap-2" defaultIndex={0} vertical>
              <div className="flex flex-col gap-4">
                <TabList className="flex flex-col gap-1">
                  {({ selectedIndex }) => (
                    <>
                      {bindingsByLayer.map((_, layer) => {
                        const isDirty = editedBindings.some(
                          b => b.layer === layer
                        );
                        return (
                          <Tab
                            key={layer}
                            className={layertab({
                              selected: selectedIndex === layer,
                            })}
                          >
                            <Text>Layer {layer + 1}</Text>
                            {isDirty ? (
                              <Asterisk className="size-3 text-red-500" />
                            ) : (
                              <div className="size-3" />
                            )}
                          </Tab>
                        );
                      })}
                    </>
                  )}
                </TabList>
                <Button
                  className="flex w-24 items-center justify-around gap-2"
                  description={
                    currentHidDevice === undefined
                      ? "Connect the keyboard in the sidebar first"
                      : "Read the current key-bindings from the selected device"
                  }
                  onClick={() => void onReadConfiguration()}
                  disabled={
                    currentHidDevice === undefined ||
                    busy ||
                    !capabilities.readConfiguration
                  }
                >
                  <HardDriveUpload className="size-6" />
                  <Text size="sm">Read</Text>
                </Button>
                <Button
                  disabled={currentHidDevice === undefined || writing || busy}
                  onClick={onWriteConfiguration}
                  className="flex size-24 flex-col items-center justify-around gap-2"
                  description={
                    currentHidDevice === undefined
                      ? "Connect the keyboard in the sidebar first"
                      : "Write the current key-bindings to the selected device"
                  }
                >
                  <HardDriveDownload className="size-8" />
                  <Text size="sm">Write</Text>
                </Button>
              </div>
              <div className="flex flex-col gap-4">
                <TabPanels>
                  {bindingsByLayer.map((bindings, layer) => (
                    <TabPanel
                      key={layer}
                      className="rounded-lg border border-transparent bg-white p-4 shadow-xl dark:bg-neutral-900"
                    >
                      <Layer
                        layer={layer}
                        keyBindings={bindings}
                        keyboardDeviceType={effectiveDeviceType}
                        selectedBinding={selectedBinding}
                        onSelectBinding={selectBinding}
                        keyLayout={selectedLayout}
                        onClearLayerEdits={onClearLayerEdits}
                      />
                    </TabPanel>
                  ))}
                </TabPanels>
                {bindingsByLayer.length > 0 && (
                  <div className="rounded-lg border border-transparent bg-white p-4 shadow-xl dark:bg-neutral-900">
                    <EditKey
                      initialBinding={currentBinding}
                      updatedMacro={workingMacro}
                      onChange={setWorkingMacro}
                      onCommit={commitWorkingMacro}
                      maxKeySequence={capabilities.maxKeySequence}
                    />
                  </div>
                )}
              </div>
            </TabGroup>
          </div>
          {keyboardErrors.length > 0 && (
            <div className="flex flex-col gap-2 rounded-xl bg-red-100 p-4 shadow-xl">
              <H2 className="text-red-700">Errors</H2>
              {keyboardErrors.map((err, i) => (
                <Text key={i}>{err.toString()}</Text>
              ))}
            </div>
          )}
        </div>
      </div>
    </KeyboardLayoutProvider>
  );
}
