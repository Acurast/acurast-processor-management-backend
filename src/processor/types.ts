export type NetworkTypeEnum = 'wifi' | 'cellular' | 'usb';
export type BatteryHealthStateEnum = 'good' | 'bad' | 'critical';

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
  batteryHealth?: BatteryHealthStateEnum;
  networkType: NetworkTypeEnum;
  ssid: string;
  temperature?: TemperatureReadings;
}

export type TemperatureType = keyof NonNullable<DeviceStatusDto['temperature']>;
