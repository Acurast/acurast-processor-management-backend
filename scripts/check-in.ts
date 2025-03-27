import { execSync } from 'child_process';
import { sleep } from './utils';

interface DeviceState {
  batteryLevel: number;
  isCharging: boolean;
  networkType: 'wifi' | 'cellular' | 'usb' | 'offline';
  ssid: string;
  temperature: {
    battery: number;
    cpu: number;
    gpu: number;
    ambient: number;
  };
  lastChargingChange: number;
  lastSsidChange: number;
}

const DEVICE_STATES = new Map<string, DeviceState>();

const NETWORK_TYPES: ('wifi' | 'cellular' | 'usb' | 'offline')[] = [
  'wifi',
  'cellular',
  'usb',
  'offline',
];
const SSIDS = [
  'Home WiFi',
  'Office Network',
  'Mobile Hotspot',
  'Guest Network',
  'Coffee Shop WiFi',
  'Airport WiFi',
  'Hotel Network',
  'Conference Room',
  'Library WiFi',
  'Public WiFi',
];

const TEMPERATURE_RANGES = {
  battery: { min: 35, max: 45 },
  cpu: { min: 40, max: 65 },
  gpu: { min: 45, max: 75 },
  ambient: { min: 20, max: 30 },
};

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function getRandomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function initializeDeviceState(): DeviceState {
  return {
    batteryLevel: getRandomInt(20, 100),
    isCharging: Math.random() < 0.3, // 30% chance of charging
    networkType: getRandomElement(NETWORK_TYPES),
    ssid: getRandomElement(SSIDS),
    temperature: {
      battery: getRandomFloat(
        TEMPERATURE_RANGES.battery.min,
        TEMPERATURE_RANGES.battery.max,
      ),
      cpu: getRandomFloat(
        TEMPERATURE_RANGES.cpu.min,
        TEMPERATURE_RANGES.cpu.max,
      ),
      gpu: getRandomFloat(
        TEMPERATURE_RANGES.gpu.min,
        TEMPERATURE_RANGES.gpu.max,
      ),
      ambient: getRandomFloat(
        TEMPERATURE_RANGES.ambient.min,
        TEMPERATURE_RANGES.ambient.max,
      ),
    },
    lastChargingChange: Date.now(),
    lastSsidChange: Date.now(),
  };
}

function updateDeviceState(address: string): DeviceState {
  const state = DEVICE_STATES.get(address) || initializeDeviceState();
  const now = Date.now();

  // Update battery level based on charging status
  if (state.isCharging) {
    // When charging, battery increases by 0.1-0.5%
    state.batteryLevel = Math.min(
      100,
      state.batteryLevel + getRandomFloat(0.1, 0.5),
    );
    console.log(
      `[${address}] Charging: Battery level increased to ${state.batteryLevel.toFixed(1)}%`,
    );
  } else {
    // When not charging, battery decreases by 0.05-0.2%
    state.batteryLevel = Math.max(
      0,
      state.batteryLevel - getRandomFloat(0.05, 0.2),
    );
    console.log(
      `[${address}] Not charging: Battery level decreased to ${state.batteryLevel.toFixed(1)}%`,
    );
  }

  // More frequently change charging status (every 5-15 minutes)
  if (
    now - state.lastChargingChange >
    getRandomInt(5 * 60 * 1000, 15 * 60 * 1000)
  ) {
    state.isCharging = !state.isCharging;
    state.lastChargingChange = now;
    console.log(
      `[${address}] Charging status changed to: ${state.isCharging ? 'charging' : 'not charging'}`,
    );
  }

  // Very rarely change SSID (every 2-4 hours)
  if (
    now - state.lastSsidChange >
    getRandomInt(2 * 60 * 60 * 1000, 4 * 60 * 60 * 1000)
  ) {
    state.ssid = getRandomElement(SSIDS);
    state.lastSsidChange = now;
  }

  // Slightly fluctuate temperatures
  state.temperature.battery += getRandomFloat(-0.5, 0.5);
  state.temperature.cpu += getRandomFloat(-1, 1);
  state.temperature.gpu += getRandomFloat(-1, 1);
  state.temperature.ambient += getRandomFloat(-0.2, 0.2);

  // Keep temperatures within ranges
  state.temperature.battery = Math.max(
    TEMPERATURE_RANGES.battery.min,
    Math.min(TEMPERATURE_RANGES.battery.max, state.temperature.battery),
  );
  state.temperature.cpu = Math.max(
    TEMPERATURE_RANGES.cpu.min,
    Math.min(TEMPERATURE_RANGES.cpu.max, state.temperature.cpu),
  );
  state.temperature.gpu = Math.max(
    TEMPERATURE_RANGES.gpu.min,
    Math.min(TEMPERATURE_RANGES.gpu.max, state.temperature.gpu),
  );
  state.temperature.ambient = Math.max(
    TEMPERATURE_RANGES.ambient.min,
    Math.min(TEMPERATURE_RANGES.ambient.max, state.temperature.ambient),
  );

  DEVICE_STATES.set(address, state);
  return state;
}

async function checkIn(address: string) {
  const state = updateDeviceState(address);
  const timestamp = Date.now();

  const checkInData = {
    deviceAddress: address,
    timestamp,
    batteryLevel: state.batteryLevel,
    isCharging: state.isCharging,
    batteryHealth:
      state.batteryLevel < 20
        ? 'critical'
        : state.batteryLevel < 50
          ? 'bad'
          : 'good',
    temperature: state.temperature,
    networkType: state.networkType,
    ssid: state.ssid,
    signature: execSync(`ts-node scripts/sign.ts ${address} ${timestamp}`)
      .toString()
      .trim(),
  };

  try {
    const response = await fetch('http://localhost:3000/processor/check-in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(checkInData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorText}`,
      );
    }

    console.log(`Check-in successful for ${address}`);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('fetch failed')) {
        console.error(
          `Check-in failed for ${address}: Network error - Is the server running? Error: ${error.message}`,
        );
        console.error(error);
      } else {
        console.error(`Check-in failed for ${address}: ${error.message}`);
        console.error(error);
      }
    } else {
      console.error(`Check-in failed for ${address}: ${String(error)}`);
      console.error(error);
    }
  }
}

async function main() {
  // Get device address from command line arguments
  const address = process.argv[2];
  if (!address) {
    console.error('Please provide a device address as a command line argument');
    process.exit(1);
  }

  // Handle process termination
  process.on('SIGINT', () => {
    console.log(`Stopping check-in process for ${address}`);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log(`Stopping check-in process for ${address}`);
    process.exit(0);
  });

  while (true) {
    await checkIn(address);
    await sleep(Math.floor(Math.random() * 1000)); // Wait 1 second before next check-in
  }
}

main().catch((error) => {
  console.error('Error in main process:', error);
  process.exit(1);
});
