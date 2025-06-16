import { ApiProperty } from '@nestjs/swagger';
import { NetworkTypeEnum, BatteryHealthState } from '../enums';
import {
  TemperatureReadings,
  ProcessorStatus,
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

export class ProcessorStatusDto implements ProcessorStatus {
  @ApiProperty({ description: 'Processor address' })
  address: string;

  @ApiProperty({
    description: 'Timestamp of the status update as reported by the processor',
  })
  timestamp: number;

  @ApiProperty({ description: 'Battery level percentage' })
  batteryLevel: number;

  @ApiProperty({ description: 'Whether the processor is currently charging' })
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
  ProcessorStatusDto['temperatures']
>;

export class BulkStatusResponseDto implements BulkStatusResponse {
  @ApiProperty({
    description: 'Processor status information for multiple processors',
    type: 'object',
    additionalProperties: {
      type: 'object',
      $ref: '#/components/schemas/ProcessorStatusDto',
    },
  })
  processorStatuses: Record<string, ProcessorStatusDto>;
}
