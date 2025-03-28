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
} from '@nestjs/common';
import { ProcessorService } from './processor.service';
import {
  DeviceStatusDto,
  TemperatureReadingsDto,
} from './dto/device-status.dto';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiProperty,
} from '@nestjs/swagger';
import { NetworkTypeEnum, BatteryHealthStateEnum } from './enums';
import {
  CheckInRequest,
  CheckInResponse,
  StatusResponse,
  HistoryResponse,
  DeviceListItem,
  ListResponse,
} from './types';
import * as fs from 'fs';
import * as path from 'path';

export class CheckInRequestDto implements CheckInRequest {
  @ApiProperty({ description: 'Device address' })
  deviceAddress: string;

  @ApiProperty({ description: 'Timestamp of the check-in' })
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
    required: false,
  })
  temperature?: TemperatureReadingsDto;

  @ApiProperty({ description: 'Network type', enum: NetworkTypeEnum })
  networkType: NetworkTypeEnum;

  @ApiProperty({ description: 'Network SSID' })
  ssid: string;

  @ApiProperty({ description: 'Digital signature of the check-in' })
  signature: string;
}

export class CheckInResponseDto implements CheckInResponse {
  @ApiProperty({ description: 'Whether the check-in was successful' })
  success: boolean;
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

@ApiTags('processor')
@Controller('processor')
export class ProcessorController {
  constructor(private readonly processorService: ProcessorService) {}

  @Post('check-in')
  @ApiOperation({ summary: 'Submit a device check-in' })
  @ApiResponse({
    status: 200,
    description: 'Check-in successful',
    type: CheckInResponseDto,
  })
  async checkIn(
    @Body() checkInRequest: CheckInRequestDto,
  ): Promise<CheckInResponseDto> {
    console.log(`New check-in received from ${checkInRequest.deviceAddress}`);
    try {
      const response =
        await this.processorService.handleCheckIn(checkInRequest);
      return response;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        error instanceof Error ? error.message : 'Unknown error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
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

  @Get('web/list')
  async getDeviceList(@Res() res: Response) {
    const response = await this.processorService.getDeviceList();
    const devices = response.devices as DeviceListItemDto[];
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Device List</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f8f9fa;
              font-weight: 600;
            }
            tr:hover {
              background-color: #f8f9fa;
            }
            .status-link {
              color: #007bff;
              text-decoration: none;
            }
            .status-link:hover {
              text-decoration: underline;
            }
            .charging {
              color: #28a745;
              font-weight: 500;
            }
            .not-charging {
              color: #dc3545;
            }
            .network-type {
              text-transform: capitalize;
            }
            .unknown-network {
              color: #6c757d;
              font-style: italic;
            }
            .battery-good {
              color: #28a745;
              font-weight: 500;
            }
            .battery-warning {
              color: #ffc107;
              font-weight: 500;
            }
            .battery-critical {
              color: #dc3545;
              font-weight: 500;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Device List</h1>
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Battery Level</th>
                  <th>Charging</th>
                  <th>Network</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${devices
                  .sort(
                    (
                      a: ListResponseDto['devices'][0],
                      b: ListResponseDto['devices'][0],
                    ) => a.address.localeCompare(b.address),
                  )
                  .map((device: ListResponseDto['devices'][0]) => {
                    const batteryClass =
                      device.batteryLevel >= 40 && device.batteryLevel <= 70
                        ? 'battery-good'
                        : device.batteryLevel > 70
                          ? 'battery-warning'
                          : 'battery-critical';
                    return `
                    <tr>
                      <td>${device.address}</td>
                      <td class="${batteryClass}">${device.batteryLevel}%</td>
                      <td class="${device.isCharging ? 'charging' : 'not-charging'}">
                        ${device.isCharging ? 'Charging' : 'Not Charging'}
                      </td>
                      <td>
                        ${
                          device.networkType === NetworkTypeEnum.UNKNOWN
                            ? '<span class="unknown-network">Unknown</span>'
                            : `<span class="network-type">${device.networkType}</span>`
                        }
                      </td>
                      <td>
                        <a href="/processor/web/${device.address}/status" class="status-link">Status</a> |
                        <a href="/processor/web/${device.address}/history" class="status-link">History</a> |
                        <a href="/processor/web/${device.address}/graph" class="status-link">Graph</a>
                      </td>
                    </tr>
                  `;
                  })
                  .join('')}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  }

  @Get('web/:address/status')
  async getDeviceStatus(
    @Param('address') address: string,
    @Res() res: Response,
  ): Promise<void> {
    const response = await this.processorService.getDeviceStatus(address);
    const deviceStatus = response.deviceStatus as DeviceStatusDto;
    if (!deviceStatus) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Device Status - ${address}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 800px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .status-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 20px;
              margin-top: 20px;
            }
            .status-card {
              background: #f8f9fa;
              padding: 15px;
              border-radius: 6px;
              border: 1px solid #dee2e6;
            }
            .status-card h3 {
              margin-top: 0;
              color: #495057;
            }
            .status-value {
              font-size: 1.2em;
              font-weight: 500;
              color: #212529;
            }
            .timestamp {
              color: #6c757d;
              font-size: 0.9em;
              margin-top: 10px;
            }
            .back-link {
              display: inline-block;
              margin-top: 20px;
              color: #007bff;
              text-decoration: none;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Device Status</h1>
            <p>Address: ${address}</p>
            <div class="status-grid">
              <div class="status-card">
                <h3>Battery Level</h3>
                <div class="status-value">${deviceStatus.batteryLevel}%</div>
                <div>Charging: ${deviceStatus.isCharging ? 'Yes' : 'No'}</div>
                <div>Health: ${deviceStatus.batteryHealth || 'Unknown'}</div>
              </div>
              <div class="status-card">
                <h3>Network</h3>
                <div class="status-value">${deviceStatus.networkType}</div>
                <div>SSID: ${deviceStatus.ssid || 'N/A'}</div>
              </div>
              <div class="status-card">
                <h3>Temperature</h3>
                <div>Battery: ${deviceStatus.temperature?.battery}°C</div>
                <div>CPU: ${deviceStatus.temperature?.cpu}°C</div>
                <div>GPU: ${deviceStatus.temperature?.gpu}°C</div>
                <div>Ambient: ${deviceStatus.temperature?.ambient}°C</div>
              </div>
              <div class="status-card">
                <h3>Last Update</h3>
                <div class="timestamp">${new Date(deviceStatus.timestamp).toLocaleString()}</div>
              </div>
            </div>
            <a href="/processor/web/list" class="back-link">← Back to Device List</a>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  }

  @Get('web/:address/history')
  async getDeviceHistory(
    @Param('address') address: string,
    @Res() res: Response,
  ): Promise<void> {
    const response = await this.processorService.getDeviceHistory(address, 10);
    const history = response.history as DeviceStatusDto[];
    if (!history || history.length === 0) {
      res.status(404).json({ error: 'No history found for device' });
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Device History - ${address}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              background: #f5f5f5;
            }
            .container {
              max-width: 1200px;
              margin: 0 auto;
              background: white;
              padding: 20px;
              border-radius: 8px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
            }
            th, td {
              padding: 12px;
              text-align: left;
              border-bottom: 1px solid #ddd;
            }
            th {
              background-color: #f8f9fa;
              font-weight: 600;
            }
            tr:hover {
              background-color: #f8f9fa;
            }
            .back-link {
              display: inline-block;
              margin-top: 20px;
              color: #007bff;
              text-decoration: none;
            }
            .back-link:hover {
              text-decoration: underline;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Device History</h1>
            <p>Address: ${address}</p>
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Battery Level</th>
                  <th>Charging</th>
                  <th>Network</th>
                  <th>Temperature</th>
                </tr>
              </thead>
              <tbody>
                ${history
                  .map(
                    (status: DeviceStatusDto) => `
                    <tr>
                      <td>${new Date(status.timestamp).toLocaleString()}</td>
                      <td>${status.batteryLevel}%</td>
                      <td>${status.isCharging ? 'Yes' : 'No'}</td>
                      <td>${status.networkType}</td>
                      <td>
                        Battery: ${status.temperature?.battery}°C<br>
                        CPU: ${status.temperature?.cpu}°C<br>
                        GPU: ${status.temperature?.gpu}°C<br>
                        Ambient: ${status.temperature?.ambient}°C
                      </td>
                    </tr>
                  `,
                  )
                  .join('')}
              </tbody>
            </table>
            <a href="/processor/web/list" class="back-link">← Back to Device List</a>
          </div>
        </body>
      </html>
    `;
    res.send(html);
  }

  @Get('web/:address/graph')
  async getDeviceHistoryGraph(
    @Param('address') address: string,
    @Res() res: Response,
  ) {
    try {
      // Try both development and production paths
      const possiblePaths = [
        path.join(__dirname, 'templates', 'device-history.html'),
        path.join(
          process.cwd(),
          'dist',
          'src',
          'processor',
          'templates',
          'device-history.html',
        ),
      ];

      let templatePath = null;
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          templatePath = p;
          break;
        }
      }

      if (!templatePath) {
        throw new Error('Template file not found');
      }

      const template = fs.readFileSync(templatePath, 'utf-8');
      res.setHeader('Content-Type', 'text/html');
      res.send(template);
    } catch (error) {
      console.error('Error serving template:', error);
      res.status(500).send('Error loading template');
    }
  }
}
