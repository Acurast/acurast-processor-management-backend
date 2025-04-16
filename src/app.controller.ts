import { Controller, Get, Res } from '@nestjs/common';
import { AppService } from './app.service';
import { Response } from 'express';
import { CacheService } from './processor/cache.service';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { FAVICON_BASE64 } from './processor/constants';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly cacheService: CacheService,
  ) {}

  @Get()
  async getHomePage(@Res() res: Response): Promise<void> {
    const stats = await this.appService.getStats();

    const html = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Acurast Processor Management</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
              line-height: 1.6;
              max-width: 800px;
              margin: 0 auto;
              padding: 2rem;
              color: #333;
            }
            h1 {
              color: #2c3e50;
              border-bottom: 2px solid #eee;
              padding-bottom: 0.5rem;
            }
            .endpoint {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 4px;
              margin: 1rem 0;
            }
            code {
              background: #e9ecef;
              padding: 0.2rem 0.4rem;
              border-radius: 3px;
              font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
            }
            .method {
              font-weight: bold;
              color: #2c3e50;
            }
            .stats {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 1rem;
              margin: 2rem 0;
              width: 100%;
            }
            .stat-card {
              background: #fff;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              padding: 1rem;
              text-align: center;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              min-height: 120px;
            }
            .stat-value {
              font-size: 2rem;
              font-weight: bold;
              color: #2c3e50;
              margin: 0.5rem 0;
            }
            .stat-label {
              color: #6c757d;
              font-size: 0.9rem;
            }
            .last-updated {
              text-align: right;
              color: #6c757d;
              font-size: 0.8rem;
              margin-top: 1rem;
            }
            .cache-stats {
              background: #fff;
              border: 1px solid #e9ecef;
              border-radius: 8px;
              padding: 1rem;
              margin: 2rem 0;
            }
            .cache-stats h2 {
              color: #2c3e50;
              margin-top: 0;
            }
            .cache-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
              gap: 1rem;
            }
            .cache-item {
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 4px;
            }
            .cache-item h3 {
              margin: 0 0 0.5rem 0;
              color: #2c3e50;
            }
            .cache-item p {
              margin: 0;
              color: #6c757d;
            }
          </style>
        </head>
        <body>
          <h1>Acurast Processor Management API</h1>
          <p>Welcome to the Acurast Processor Management API. This service manages device statuses and check-ins for Acurast processors.</p>
          
          <div class="stats">
            <div class="stat-card">
              <div class="stat-value">${stats.totalCheckIns}</div>
              <div class="stat-label">Total Check-ins</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.totalDevices}</div>
              <div class="stat-label">Total Devices</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.lastHourCheckIns}</div>
              <div class="stat-label">Check-ins (Last Hour)</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${stats.last24HoursCheckIns}</div>
              <div class="stat-label">Check-ins (Last 24 Hours)</div>
            </div>
          </div>

          <div class="cache-stats">
            <h2>Cache Statistics</h2>
            <div class="cache-grid">
              <div class="cache-item">
                <h3>Device Status Cache</h3>
                <p>Size: ${this.cacheService.getDeviceStatusCacheSize()} / ${this.cacheService.getDeviceStatusCacheCapacity()}</p>
              </div>
              <div class="cache-item">
                <h3>Processor Cache</h3>
                <p>Size: ${this.cacheService.getProcessorCacheSize()} / ${this.cacheService.getProcessorCacheCapacity()}</p>
              </div>
              <div class="cache-item">
                <h3>Network Type Cache</h3>
                <p>Size: ${this.cacheService.getNetworkTypeCacheSize()} / ${this.cacheService.getNetworkTypeCacheCapacity()}</p>
              </div>
              <div class="cache-item">
                <h3>SSID Cache</h3>
                <p>Size: ${this.cacheService.getSsidCacheSize()} / ${this.cacheService.getSsidCacheCapacity()}</p>
              </div>
              <div class="cache-item">
                <h3>Battery Health Cache</h3>
                <p>Size: ${this.cacheService.getBatteryHealthCacheSize()} / ${this.cacheService.getBatteryHealthCacheCapacity()}</p>
              </div>
            </div>
          </div>
          
          <h2>Available Endpoints</h2>
          
          <div class="endpoint">
            <span class="method">POST</span> <code>/processor/check-in</code>
            <p>Register a new device check-in with status information.</p>
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/processor/list</code>
            <p>View a list of all devices with their latest status.</p>
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/processor/devices/:deviceAddress/status</code>
            <p>Get the current status of a specific device.</p>
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/processor/devices/:deviceAddress/history</code>
            <p>Get the history of status updates for a specific device.</p>
          </div>
          
          <div class="endpoint">
            <span class="method">GET</span> <code>/processor/devices/status</code>
            <p>Get all device statuses across all devices.</p>
          </div>

          <div class="last-updated">
            Last updated: ${new Date(stats.timestamp).toLocaleString()}
          </div>
        </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  @Get('favicon.ico')
  @ApiOperation({ summary: 'Get the favicon' })
  @ApiResponse({
    status: 200,
    description: 'Favicon returned successfully',
    content: {
      'image/x-icon': {
        schema: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Favicon not found' })
  getFavicon(@Res() res: Response): void {
    try {
      const faviconBuffer = Buffer.from(FAVICON_BASE64, 'base64');
      res.set('Content-Type', 'image/x-icon');
      res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.send(faviconBuffer);
    } catch (error) {
      console.error('Error serving favicon:', error);
      res.status(404).send('Favicon not found');
    }
  }
}
