import {
  NetworkTypeEnum,
  BatteryHealthStateEnum,
  TemperatureReadings,
} from '../types';

export class DeviceStatusDto {
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
