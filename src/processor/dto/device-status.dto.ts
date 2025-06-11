import { ApiProperty } from '@nestjs/swagger';
import { NetworkTypeEnum, BatteryHealthState } from '../enums';
import {
  TemperatureReadings,
  DeviceStatus,
  BulkStatusResponse,
} from '../types';

export class TemperatureReadingsDto implements TemperatureReadings {
  @ApiProperty({
    description: 'Battery temperature in Celsius',
    required: false,
  })
  battery?: number;

  @ApiProperty({
    description: 'Ambient temperature in Celsius',
    required: false,
  })
  ambient?: number;

  @ApiProperty({
    description: 'Forecast temperature in Celsius',
    required: false,
  })
  forecast?: number;
}

export class DeviceStatusDto implements DeviceStatus {
  @ApiProperty({ description: 'Device address' })
  address: string;

  @ApiProperty({
    description: 'Timestamp of the status update as reported by the processor',
  })
  timestamp: number;

  @ApiProperty({ description: 'Battery level percentage' })
  batteryLevel: number;

  @ApiProperty({ description: 'Whether the device is currently charging' })
  isCharging: boolean;

  @ApiProperty({
    description: 'Battery health state',
    type: String,
    required: false,
  })
  batteryHealth?: BatteryHealthState;

  @ApiProperty({ description: 'Network type', enum: NetworkTypeEnum })
  networkType: NetworkTypeEnum;

  @ApiProperty({
    description: 'Temperature readings',
    type: TemperatureReadingsDto,
    required: false,
  })
  temperatures?: TemperatureReadingsDto;

  @ApiProperty({ description: 'Network SSID', required: false })
  ssid?: string;
}

export type TemperatureType = keyof NonNullable<
  DeviceStatusDto['temperatures']
>;

export class BulkStatusResponseDto implements BulkStatusResponse {
  @ApiProperty({
    description: 'Device status information for multiple devices',
    type: 'object',
    additionalProperties: {
      type: 'object',
      $ref: '#/components/schemas/DeviceStatusDto',
    },
  })
  deviceStatuses: Record<string, DeviceStatusDto>;
}
