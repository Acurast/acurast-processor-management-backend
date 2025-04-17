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
      // Create the message to verify
      const message = this.createMessageToSign(request);

      // Convert the signature from hex to Uint8Array
      const signatureBytes = Buffer.from(signature, 'hex');

      const r = signatureBytes.subarray(0, 32);
      const s = signatureBytes.subarray(32, 64);

      let v = signatureBytes[64];
      if (v >= 27) v -= 27; // Normalize 27/28 to 0/1
      if (v !== 0 && v !== 1) {
        throw new Error(`Invalid recovery id: ${v}`);
      }

      // Hash the message using SHA-256
      const hash = createHash('sha256').update(message).digest('hex');

      const hashBytes = Buffer.from(hash, 'hex');

      const pubKey = this.k256r1.recoverPubKey(
        hashBytes,
        { r, s },
        v,
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
    } catch (error) {
      console.error(error);
      throw new HttpException(
        SIGNATURE_VERIFICATION_ERROR,
        SIGNATURE_VERIFICATION_STATUS,
      );
    }
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
