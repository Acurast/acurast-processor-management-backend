import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  Res,
  HttpException,
  HttpStatus,
  Headers,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ProcessorService } from './processor.service';
import {
  DeviceStatusDto,
  TemperatureReadingsDto,
  BulkStatusResponseDto,
} from './dto/device-status.dto';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
  ApiHeader,
} from '@nestjs/swagger';
import { NetworkTypeEnum, BatteryHealthState } from './enums';
import {
  CheckInRequest,
  CheckInResponse,
  StatusResponse,
  HistoryResponse,
  DeviceListItem,
  ListResponse,
  BulkStatusResponse,
} from './types';
import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { WhitelistService } from '../whitelist/whitelist.service';
import { ConfigService } from '@nestjs/config';

export class CheckInRequestDto implements CheckInRequest {
  @ApiProperty({ description: 'Device address' })
  deviceAddress: string;

  @ApiProperty({ description: 'Platform (0 = Android, 1 = iOS)' })
  platform: number;

  @ApiProperty({ description: 'Timestamp of the check-in' })
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

  @ApiProperty({
    description: 'Temperature readings',
    type: TemperatureReadingsDto,
    required: false,
  })
  temperatures?: TemperatureReadingsDto;

  @ApiProperty({ description: 'Network type', enum: NetworkTypeEnum })
  networkType: NetworkTypeEnum;

  @ApiProperty({ description: 'Network SSID', required: false })
  ssid: string;
}

export class CheckInResponseDto implements CheckInResponse {
  @ApiProperty({ description: 'Whether the check-in was successful' })
  success: boolean;

  @ApiProperty({
    description: 'Recommended refresh interval in seconds',
    required: true,
  })
  refreshIntervalInSeconds?: number;
}

export class StatusResponseDto implements StatusResponse {
  @ApiProperty({
    description: 'Device status information',
    type: DeviceStatusDto,
  })
  deviceStatus: DeviceStatusDto;
}

export class HistoryResponseDto implements HistoryResponse {
  @ApiProperty({
    description: 'List of historical device statuses',
    type: [DeviceStatusDto],
  })
  history: DeviceStatusDto[];
}

export class DeviceListItemDto implements DeviceListItem {
  @ApiProperty({ description: 'Device address' })
  address: string;

  @ApiProperty({ description: 'Last seen timestamp' })
  lastSeen: number;

  @ApiProperty({ description: 'Battery level percentage' })
  batteryLevel: number;

  @ApiProperty({ description: 'Whether the device is currently charging' })
  isCharging: boolean;

  @ApiProperty({ description: 'Network type', enum: NetworkTypeEnum })
  networkType: NetworkTypeEnum;

  @ApiProperty({ description: 'Network SSID' })
  ssid: string;
}

export class ListResponseDto implements ListResponse {
  @ApiProperty({ description: 'List of devices', type: [DeviceListItemDto] })
  devices: DeviceListItemDto[];
}

// Define template data interfaces
interface DeviceListTemplateData {
  devices?: DeviceListItem[];
  error?: string;
}

interface DeviceStatusTemplateData {
  deviceStatus?: DeviceStatusDto;
  error?: string;
}

interface DeviceHistoryTemplateData {
  deviceAddress: string;
  history?: DeviceStatusDto[];
  error?: string;
}

interface DeviceGraphTemplateData {
  deviceAddress: string;
  error?: string;
}

@ApiTags('processor')
@Controller('processor')
export class ProcessorController {
  private readonly logger = new Logger(ProcessorController.name);
  private deviceListTemplate: HandlebarsTemplateDelegate<DeviceListTemplateData>;
  private deviceStatusTemplate: HandlebarsTemplateDelegate<DeviceStatusTemplateData>;
  private deviceHistoryTemplate: HandlebarsTemplateDelegate<DeviceHistoryTemplateData>;
  private deviceGraphTemplate: HandlebarsTemplateDelegate<DeviceGraphTemplateData>;

  constructor(
    private readonly processorService: ProcessorService,
    private readonly whitelistService: WhitelistService,
    private readonly configService: ConfigService,
  ) {
    try {
      // Try both development and production paths
      const possiblePaths = [
        path.join(__dirname, 'templates'),
        path.join(process.cwd(), 'dist', 'src', 'processor', 'templates'),
      ];

      let templatePath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          templatePath = p;
          break;
        }
      }

      if (!templatePath) {
        throw new Error('Template directory not found');
      }

      // Load and compile templates
      this.deviceListTemplate = Handlebars.compile<DeviceListTemplateData>(
        fs.readFileSync(path.join(templatePath, 'device-list.html'), 'utf-8'),
      );
      this.deviceStatusTemplate = Handlebars.compile<DeviceStatusTemplateData>(
        fs.readFileSync(path.join(templatePath, 'device-status.html'), 'utf-8'),
      );
      this.deviceHistoryTemplate =
        Handlebars.compile<DeviceHistoryTemplateData>(
          fs.readFileSync(
            path.join(templatePath, 'device-history.html'),
            'utf-8',
          ),
        );
      this.deviceGraphTemplate = Handlebars.compile<DeviceGraphTemplateData>(
        fs.readFileSync(path.join(templatePath, 'device-graph.html'), 'utf-8'),
      );

      // Register helper for timestamp formatting
      Handlebars.registerHelper('formatTimestamp', (timestamp: number) => {
        return new Date(timestamp * 1000).toLocaleString();
      });
    } catch (error) {
      console.error('Error loading templates:', error);
      throw new HttpException(
        'Failed to initialize templates',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('check-in')
  @ApiOperation({ summary: 'Submit a device check-in' })
  @ApiHeader({
    name: 'X-Device-Signature',
    description: 'Digital signature of the check-in request',
    required: true,
  })
  @ApiResponse({
    status: 200,
    description: 'Check-in successful',
    type: CheckInResponseDto,
  })
  @ApiResponse({ status: 403, description: 'Processor not whitelisted' })
  async checkIn(
    @Body() checkInRequest: CheckInRequestDto,
    @Headers('x-device-signature') signature: string,
  ): Promise<CheckInResponseDto> {
    if (
      !this.whitelistService.shouldHandleProcessor(checkInRequest.deviceAddress)
    ) {
      this.logger.warn(
        `Rejecting check-in from non-whitelisted processor: ${checkInRequest.deviceAddress}`,
      );
      throw new ForbiddenException(
        `Processor ${checkInRequest.deviceAddress} is not whitelisted.`,
      );
    }

    this.logger.log(
      `New check-in received from ${checkInRequest.deviceAddress}`,
    );
    try {
      const serviceResponse = await this.processorService.handleCheckIn(
        checkInRequest,
        signature,
      );

      const refreshInterval = parseInt(
        this.configService.get<string>('REFRESH_INTERVAL_IN_SECONDS', '60'),
        10,
      );

      const response: CheckInResponseDto = {
        success: serviceResponse.success,
        refreshIntervalInSeconds: isNaN(refreshInterval) ? 60 : refreshInterval,
      };

      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      if (error instanceof Error) {
        this.logger.error(
          `Error during check-in for ${checkInRequest.deviceAddress}: ${error.message}`,
          error.stack,
        );
        throw new HttpException(
          error.message,
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      } else {
        this.logger.error(
          `Unknown error type during check-in for ${checkInRequest.deviceAddress}: ${JSON.stringify(error)}`,
        );
        throw new HttpException(
          'Unknown server error during check-in',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }
    }
  }

  @Get('api/devices/:address/status')
  @ApiOperation({ summary: 'Get device status' })
  @ApiParam({ name: 'address', description: 'Device address' })
  @ApiResponse({
    status: 200,
    description: 'Device status retrieved successfully',
    type: StatusResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getDeviceStatusApi(
    @Param('address') address: string,
  ): Promise<StatusResponseDto> {
    const response = await this.processorService.getDeviceStatus(address);
    return response as StatusResponseDto;
  }

  @Get('api/devices/:address/history')
  @ApiOperation({ summary: 'Get device history' })
  @ApiParam({ name: 'address', description: 'Device address' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of history entries to return',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Device history retrieved successfully',
    type: HistoryResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Device not found' })
  async getDeviceHistoryApi(
    @Param('address') address: string,
    @Query('limit') limit: number = 10,
  ): Promise<HistoryResponseDto> {
    const response = await this.processorService.getDeviceHistory(
      address,
      limit,
    );
    return response as HistoryResponseDto;
  }

  @Get('api/devices/status')
  @ApiOperation({ summary: 'Get all device statuses' })
  @ApiResponse({
    status: 200,
    description: 'All device statuses retrieved successfully',
    type: HistoryResponseDto,
  })
  async getAllDeviceStatusesApi(): Promise<HistoryResponseDto> {
    const response = await this.processorService.getAllDeviceStatuses();
    return response as HistoryResponseDto;
  }

  @Get('api/devices/status/bulk')
  @ApiOperation({ summary: 'Get status for multiple devices' })
  @ApiQuery({
    name: 'addresses',
    description: 'Comma-separated list of device addresses',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Device statuses retrieved successfully',
    type: BulkStatusResponseDto,
  })
  async getBulkDeviceStatusApi(
    @Query('addresses') addresses: string,
  ): Promise<BulkStatusResponse> {
    const addressList = addresses.split(',').map((addr) => addr.trim());
    return this.processorService.getBulkDeviceStatus(addressList);
  }

  @Get('web/list')
  async getDeviceList(@Res() res: Response): Promise<void> {
    try {
      const response = await this.processorService.getDeviceList();
      const html = this.deviceListTemplate({
        devices: response.devices,
      });
      res.send(html);
    } catch (error) {
      const html = this.deviceListTemplate({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch device list',
      });
      res.send(html);
    }
  }

  @Get('web/:address/status')
  async getDeviceStatus(
    @Param('address') address: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const response = await this.processorService.getDeviceStatus(address);
      const html = this.deviceStatusTemplate({
        deviceStatus: response.deviceStatus,
      });
      res.send(html);
    } catch (error) {
      const html = this.deviceStatusTemplate({
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch device status',
      });
      res.send(html);
    }
  }

  @Get('web/:address/history')
  async getDeviceHistory(
    @Param('address') address: string,
    @Query('limit') limit: string = '60',
    @Res() res: Response,
  ): Promise<void> {
    try {
      const response = await this.processorService.getDeviceHistory(
        address,
        parseInt(limit),
      );
      const html = this.deviceHistoryTemplate({
        deviceAddress: address,
        history: response.history,
      });
      res.send(html);
    } catch (error) {
      const html = this.deviceHistoryTemplate({
        deviceAddress: address,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to fetch device history',
      });
      res.send(html);
    }
  }

  @Get('web/:address/graph')
  async getDeviceGraph(
    @Param('address') address: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const html = this.deviceGraphTemplate({
        deviceAddress: address,
      });
      res.send(html);
    } catch (error) {
      const html = this.deviceGraphTemplate({
        deviceAddress: address,
        error:
          error instanceof Error ? error.message : 'Failed to load graph page',
      });
      res.send(html);
    }
  }

  @Get('debug/cache/status')
  @ApiOperation({ summary: 'Get cache status information' })
  @ApiResponse({
    status: 200,
    description: 'Cache status information',
  })
  async getCacheStatus() {
    return {
      processorCache: {
        size: this.processorService.cacheService.getProcessorCacheSize(),
        capacity:
          this.processorService.cacheService.getProcessorCacheCapacity(),
      },
      deviceStatusCache: {
        size: this.processorService.cacheService.getDeviceStatusCacheSize(),
        capacity:
          this.processorService.cacheService.getDeviceStatusCacheCapacity(),
      },
      networkTypeCache: {
        size: this.processorService.cacheService.getNetworkTypeCacheSize(),
        capacity:
          this.processorService.cacheService.getNetworkTypeCacheCapacity(),
      },
      batteryHealthCache: {
        size: this.processorService.cacheService.getBatteryHealthCacheSize(),
        capacity:
          this.processorService.cacheService.getBatteryHealthCacheCapacity(),
      },
    };
  }

  @Get('debug/cache/contents')
  @ApiOperation({ summary: 'Get cache contents' })
  @ApiResponse({
    status: 200,
    description: 'Cache contents',
  })
  async getCacheContents() {
    return {
      processorCache:
        this.processorService.cacheService.getProcessorCacheContents(),
      deviceStatusCache:
        this.processorService.cacheService.getDeviceStatusCacheContents(),
      networkTypeCache:
        this.processorService.cacheService.getNetworkTypeCacheContents(),
      batteryHealthCache:
        this.processorService.cacheService.getBatteryHealthCacheContents(),
      ssidCache: this.processorService.cacheService.getSsidCacheContents(),
    };
  }
}
