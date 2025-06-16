import { NetworkTypeEnum, BatteryHealthState } from './enums';

export interface TemperatureReadings {
  battery?: number;
  cpu?: number;
  gpu?: number;
  ambient?: number;
}

export interface ProcessorStatus {
  address: string;
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: BatteryHealthState;
  temperatures?: TemperatureReadings;
  networkType: NetworkTypeEnum;
  ssid?: string;
}

export interface CheckInRequest {
  deviceAddress: string;
  platform: number; // 0 = Android, 1 = iOS
  timestamp: number;
  batteryLevel: number;
  isCharging: boolean;
  batteryHealth?: BatteryHealthState;
  temperatures?: TemperatureReadings;
  networkType: NetworkTypeEnum;
  ssid?: string;
}

export interface CheckInResponse {
  success: boolean;
}

export interface StatusesResponse {
  processorStatuses: ProcessorStatus[];
}

export interface StatusResponse {
  processorStatus: ProcessorStatus;
}

export interface HistoryResponse {
  history: ProcessorStatus[];
}

export interface ProcessorListItem {
  address: string;
  lastSeen: number;
  batteryLevel: number;
  isCharging: boolean;
  networkType: NetworkTypeEnum;
  ssid?: string;
}

export interface ListResponse {
  devices: ProcessorListItem[];
}

export interface BulkStatusResponse {
  processorStatuses: Record<string, ProcessorStatus>;
}
