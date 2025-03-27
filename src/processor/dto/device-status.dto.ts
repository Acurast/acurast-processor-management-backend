export class DeviceStatusDto {
  address: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: 'good' | 'bad' | 'critical';
  networkType: 'wifi' | 'cellular' | 'usb' | 'offline';
  ssid: string;
  temperature?: {
    battery?: number;
    cpu?: number;
    gpu?: number;
    ambient?: number;
  };
}

export type TemperatureType = keyof NonNullable<DeviceStatusDto['temperature']>;
