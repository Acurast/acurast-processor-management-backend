import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhitelistService implements OnModuleInit {
  private readonly logger = new Logger(WhitelistService.name);
  // Store the set of *lowercase* addresses. null signifies an empty/absent whitelist (allow all).
  private whitelistedProcessors: ReadonlySet<string> | null = null;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    // Provide an empty string as a default and assert the type
    const whitelistString = this.configService.get<string>(
      'PROCESSOR_WHITELIST',
      '',
    );

    if (whitelistString.trim() === '') {
      this.logger.log(
        'Processor whitelist is empty or not set. All processors will be allowed.',
      );
      this.whitelistedProcessors = null; // Explicitly null signifies allow all
    } else {
      const addresses = whitelistString
        .split(',')
        .map((addr: string) => addr.trim().toLowerCase()) // Explicitly type addr
        .filter((addr: string): addr is string => addr !== ''); // Explicitly type addr and use type guard

      if (addresses.length === 0) {
        this.logger.warn(
          'PROCESSOR_WHITELIST variable contains only whitespace or commas. Allowing all processors.',
        );
        this.whitelistedProcessors = null;
      } else {
        // Use ReadonlySet for immutability after initialization
        this.whitelistedProcessors = new Set(addresses);
        this.logger.log(
          `Initialized processor whitelist with ${this.whitelistedProcessors.size} addresses.`,
        );
        // Optional: Log the addresses themselves if needed for debugging (careful with sensitive data)
        // this.logger.debug(`Whitelisted addresses: ${[...this.whitelistedProcessors].join(', ')}`);
      }
    }
  }

  /**
   * Checks if a processor address should be handled based on the whitelist.
   * @param processorAddress The address of the processor to check.
   * @returns True if the processor should be handled, false otherwise.
   */
  shouldHandleProcessor(processorAddress: string): boolean {
    // If the whitelist is null (empty or not configured), allow all processors.
    if (this.whitelistedProcessors === null) {
      return true;
    }

    // Ensure the input address is also normalized to lowercase for comparison.
    const normalizedAddress = processorAddress.toLowerCase();

    // Check if the normalized address is in the set.
    return this.whitelistedProcessors.has(normalizedAddress);
  }
}
