import { ApiProperty } from '@nestjs/swagger';
import { NetworkTypeEnum, BatteryHealthStateEnum } from '../enums';
import { TemperatureReadings, DeviceStatus } from '../types';

export class TemperatureReadingsDto implements TemperatureReadings {
  @ApiProperty({
    description: 'Battery temperature in Celsius',
    required: false,
  })
  battery?: number;

  @ApiProperty({ description: 'CPU temperature in Celsius', required: false })
  cpu?: number;

  @ApiProperty({ description: 'GPU temperature in Celsius', required: false })
  gpu?: number;

  @ApiProperty({
    description: 'Ambient temperature in Celsius',
    required: false,
  })
  ambient?: number;
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
    enum: BatteryHealthStateEnum,
    required: false,
  })
  batteryHealth?: BatteryHealthStateEnum;

  @ApiProperty({
    description: 'Temperature readings',
    type: TemperatureReadingsDto,
  })
  temperature: TemperatureReadingsDto;

  @ApiProperty({ description: 'Network type', enum: NetworkTypeEnum })
  networkType: NetworkTypeEnum;

  @ApiProperty({ description: 'Network SSID' })
  ssid: string;
}

export type TemperatureType = keyof NonNullable<DeviceStatusDto['temperature']>;
