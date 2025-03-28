import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { CheckInRequest } from './types';

@Injectable()
export class SignatureService {
  private ed25519: any;

  constructor() {
    // Initialize ed25519 module
    this.initEd25519();
  }

  private async initEd25519() {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.ed25519 = await eval('import("@noble/ed25519")');
  }

  /**
   * Verifies the signature of a check-in request
   * The signature should be over the following fields concatenated in order:
   * - deviceAddress
   * - timestamp
   * - batteryLevel
   * - isCharging
   * - networkType
   * - ssid
   */
  async verifySignature(
    request: CheckInRequest,
    signature: string,
  ): Promise<boolean> {
    try {
      // Ensure ed25519 is initialized
      if (!this.ed25519) {
        await this.initEd25519();
      }

      // Create the message to verify
      const message = this.createMessageToSign(request);

      // Convert the signature from hex to Uint8Array
      const signatureBytes = Buffer.from(signature, 'hex');

      // Get the public key from the device address
      const publicKey = this.getPublicKeyFromAddress(request.deviceAddress);

      // Verify the signature
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      return await this.ed25519.verifyAsync(signatureBytes, message, publicKey);
    } catch (error) {
      console.error(error);
      throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
    }
  }

  private createMessageToSign(request: CheckInRequest): Uint8Array {
    // Create a deterministic string representation of the data to sign
    const messageStr = [
      request.deviceAddress,
      request.timestamp.toString(),
      request.batteryLevel.toString(),
      request.isCharging.toString(),
      request.networkType,
      request.ssid || '',
    ].join(':');

    // Convert to Uint8Array for signing
    return new TextEncoder().encode(messageStr);
  }

  private getPublicKeyFromAddress(address: string): Uint8Array {
    console.log('address', address);
    // TODO: Implement proper public key derivation from device address
    // For now, we'll use a placeholder that needs to be replaced with actual implementation
    // This should map the device address to its corresponding public key
    throw new Error('Public key derivation not implemented');
  }
}
