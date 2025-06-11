import { Injectable, HttpException } from '@nestjs/common';
import bs58 from 'bs58';
import * as blake from 'blakejs';
import { createHash } from 'crypto';

import { CheckInRequest } from './types';
import {
  EC_INSTANCE,
  SIGNATURE_VERIFICATION_ERROR,
  SIGNATURE_VERIFICATION_STATUS,
} from './constants';

@Injectable()
export class SignatureService {
  private k256r1 = EC_INSTANCE;

  constructor() {}

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
      if (request.platform === 1) {
        return this.verifyIOSSignature(request, signature);
      } else {
        return this.verifyAndroidSignature(request, signature);
      }
    } catch (error) {
      console.error(error);
      throw new HttpException(
        SIGNATURE_VERIFICATION_ERROR,
        SIGNATURE_VERIFICATION_STATUS,
      );
    }
  }

  private encodeCompactInt(value: number): Uint8Array {
    if (value < 64) {
      return new Uint8Array([value << 2]);
    } else if (value < 16384) {
      return new Uint8Array([
        ((value << 2) | 0x01) & 0xff,
        (value >> 6) & 0xff,
      ]);
    } else if (value < 1073741824) {
      return new Uint8Array([
        ((value << 2) | 0x02) & 0xff,
        (value >> 6) & 0xff,
        (value >> 14) & 0xff,
        (value >> 22) & 0xff,
      ]);
    } else {
      throw new Error('Value too large for compact encoding');
    }
  }

  private decodeCompactInt(
    bytes: Buffer,
    offset: number,
  ): { value: number; bytesRead: number } {
    const firstByte = bytes[offset];
    const mode = firstByte & 0x03;

    if (mode === 0) {
      // Single-byte mode: 0b00
      return { value: firstByte >> 2, bytesRead: 1 };
    } else if (mode === 1) {
      // Two-byte mode: 0b01
      const value = ((firstByte & 0xfc) >> 2) | (bytes[offset + 1] << 6);
      return { value, bytesRead: 2 };
    } else if (mode === 2) {
      // Four-byte mode: 0b10
      const value =
        ((firstByte & 0xfc) >> 2) |
        (bytes[offset + 1] << 6) |
        (bytes[offset + 2] << 14) |
        (bytes[offset + 3] << 22);
      return { value, bytesRead: 4 };
    } else {
      // Multi-byte mode: 0b11
      const bytesCount = (firstByte >> 2) + 4;
      if (bytesCount > 8) {
        throw new Error('Compact integer too large');
      }
      let value = 0;
      for (let i = 0; i < bytesCount; i++) {
        value |= bytes[offset + 1 + i] << (i * 8);
      }
      return { value, bytesRead: bytesCount + 1 };
    }
  }

  private async verifyIOSSignature(
    request: CheckInRequest,
    signature: string,
  ): Promise<boolean> {
    const rawMessage = this.createMessageToSign(request);

    // Extract components from the signature
    const signatureBytes = Buffer.from(signature, 'hex');
    let offset = 0;

    // First extract the P256 signature (r, s, v)
    if (signatureBytes.length < 65) {
      throw new Error(
        `Invalid signature length: ${signatureBytes.length} bytes, need at least 65`,
      );
    }
    const r = signatureBytes.slice(offset, offset + 32);
    const s = signatureBytes.slice(offset + 32, offset + 64);
    const v = signatureBytes[offset + 64];
    offset += 65;

    // Then extract AuthenticatorData (scale encoded byte array)
    const authLength = this.decodeCompactInt(signatureBytes, offset);
    // The authenticator data starts with 84c97b...
    const authenticatorData = signatureBytes.slice(
      offset + 1,
      offset + authLength.value + 1,
    );
    offset += authLength.value + 1;

    // Finally extract ClientDataContext (Option)
    const hasClientDataContext = signatureBytes[offset] !== 0x00;
    offset += 1;

    let clientDataContext: Buffer | undefined;
    if (hasClientDataContext) {
      const contextLength = this.decodeCompactInt(signatureBytes, offset);
      offset += contextLength.bytesRead;
      clientDataContext = signatureBytes.slice(
        offset,
        offset + contextLength.value,
      );
      offset += contextLength.value;
    }

    // Construct the message to verify
    let message: Uint8Array;
    if (clientDataContext) {
      // If we have client data context, prepend it to the raw message
      message = new Uint8Array(clientDataContext.length + rawMessage.length);
      message.set(new Uint8Array(clientDataContext));
      message.set(rawMessage, clientDataContext.length);
    } else {
      message = rawMessage;
    }

    // Preprocess message for iOS
    const payload = this.preprocessMessage(message);

    // Hash the payload
    const hashedPayload = createHash('sha256').update(payload).digest();

    // Create the final message by prepending the authenticator data
    const finalMessage = new Uint8Array(
      authenticatorData.length + hashedPayload.length,
    );
    finalMessage.set(new Uint8Array(authenticatorData));
    finalMessage.set(hashedPayload, authenticatorData.length);

    // Hash the final message
    const hashedFinalMessage = createHash('sha256')
      .update(finalMessage)
      .digest('hex');

    // Hash it again
    const doubleHash = createHash('sha256')
      .update(Buffer.from(hashedFinalMessage, 'hex'))
      .digest('hex');

    // For P256, normalize recovery id to 0 or 1
    let normalizedV = v;
    if (normalizedV >= 27) {
      normalizedV -= 27;
    }
    if (normalizedV !== 0 && normalizedV !== 1) {
      throw new Error(`Invalid recovery id: ${v} (normalized: ${normalizedV})`);
    }

    const pubKey = this.k256r1.recoverPubKey(
      Buffer.from(doubleHash, 'hex'),
      { r, s },
      normalizedV,
    ) as string;
    const compressedKey = this.k256r1
      .keyFromPublic(pubKey)
      .getPublic()
      .encodeCompressed('hex');

    // Compare the recovered public key with the device address
    return (
      this.computeSubstrateAddressFromPublicKey(
        Buffer.from(compressedKey, 'hex'),
      ) === request.deviceAddress
    );
  }

  private async verifyAndroidSignature(
    request: CheckInRequest,
    signature: string,
  ): Promise<boolean> {
    const rawMessage = this.createMessageToSign(request);
    const hash = createHash('sha256').update(rawMessage).digest('hex');
    return this.verifySignatureWithHash(
      request,
      signature,
      Buffer.from(hash, 'hex'),
    );
  }

  private async verifySignatureWithHash(
    request: CheckInRequest,
    signature: string,
    hashBytes: Buffer,
  ): Promise<boolean> {
    // Convert the signature from hex to Uint8Array
    const signatureBytes = Buffer.from(signature, 'hex');

    const r = signatureBytes.subarray(0, 32);
    const s = signatureBytes.subarray(32, 64);

    let v = signatureBytes[64];
    // For P256, normalize recovery id to 0 or 1
    if (v >= 27) {
      v -= 27;
    }
    if (v !== 0 && v !== 1) {
      throw new Error(`Invalid recovery id: ${v}`);
    }

    const pubKey = this.k256r1.recoverPubKey(hashBytes, { r, s }, v) as string;
    const compressedKey = this.k256r1
      .keyFromPublic(pubKey)
      .getPublic()
      .encodeCompressed('hex');

    // Compare the recovered public key with the device address
    return (
      this.computeSubstrateAddressFromPublicKey(
        Buffer.from(compressedKey, 'hex'),
      ) === request.deviceAddress
    );
  }

  private preprocessMessage(message: Uint8Array): Uint8Array {
    return message.length > 256
      ? blake.blake2b(message, undefined, 16) // blake2b_128
      : message;
  }

  private createMessageToSign(request: CheckInRequest): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(request));
  }

  private computeSubstrateAddressFromPublicKey(compressedKey: Buffer): string {
    const publicKeyHash = blake.blake2b(compressedKey, undefined, 32);
    const substrateId = new Uint8Array([42]);
    const body = new Uint8Array(substrateId.length + publicKeyHash.length);
    body.set(substrateId);
    body.set(publicKeyHash, substrateId.length);

    const prefix = Buffer.from('SS58PRE', 'utf8');

    const context = blake.blake2bInit(64);

    blake.blake2bUpdate(context, prefix);
    blake.blake2bUpdate(context, body);

    const checksum = blake.blake2bFinal(context);

    const address = new Uint8Array(body.length + 2);
    address.set(body);
    address.set(checksum.slice(0, 2), body.length);

    return bs58.encode(address);
  }
}
