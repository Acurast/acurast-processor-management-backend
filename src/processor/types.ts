import { NetworkTypeEnum, BatteryHealthStateEnum } from './enums';

export interface TemperatureReadings {
  battery?: number;
  cpu?: number;
  gpu?: number;
  ambient?: number;
}

export interface DeviceStatus {
  address: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: BatteryHealthStateEnum;
  temperature?: TemperatureReadings;
  networkType: NetworkTypeEnum;
  ssid?: string;
}

export interface CheckInRequest {
  deviceAddress: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: BatteryHealthStateEnum;
  temperature?: TemperatureReadings;
  networkType: NetworkTypeEnum;
  ssid?: string;
}

export interface CheckInResponse {
  success: boolean;
}

export interface StatusResponse {
  deviceStatus: DeviceStatus;
}

export interface HistoryResponse {
  history: DeviceStatus[];
}

export interface DeviceListItem {
  address: string;
  lastSeen: number;
  batteryLevel: number;
  isCharging: boolean;
  networkType: NetworkTypeEnum;
  ssid?: string;
}

export interface ListResponse {
  devices: DeviceListItem[];
}
