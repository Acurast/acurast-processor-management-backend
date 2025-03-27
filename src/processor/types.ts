export type NetworkType = 'wifi' | 'cellular' | 'usb' | 'offline';
export type BatteryHealthState = 'good' | 'bad' | 'critical';

export interface TemperatureReadings {
  battery?: number;
  cpu?: number;
  gpu?: number;
  ambient?: number;
}

export interface DeviceStatusDto {
  address: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: BatteryHealthState;
  networkType: NetworkType;
  ssid: string;
  temperature?: TemperatureReadings;
}

export type TemperatureType = keyof NonNullable<DeviceStatusDto['temperature']>;
