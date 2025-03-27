import { createHash } from 'crypto';

// Get command line arguments
const [address, timestamp] = process.argv.slice(2);

if (!address || !timestamp) {
  console.error('Usage: ts-node sign.ts <address> <timestamp>');
  process.exit(1);
}

// Create a deterministic signature based on address and timestamp
function generateSignature(address: string, timestamp: string): string {
  const data = `${address}:${timestamp}`;
  return createHash('sha256').update(data).digest('hex');
}

// Generate and output the signature
const signature = generateSignature(address, timestamp);
console.log(signature);
