import { spawn } from 'child_process';
import { sleep } from './utils';

interface CheckInProcess {
  process: ReturnType<typeof spawn>;
  address: string;
}

const CHECK_IN_PROCESSES: CheckInProcess[] = [];

async function startCheckIn(address: string) {
  const checkInProcess = spawn('node', ['dist/scripts/check-in.js', address], {
    stdio: 'inherit',
  });

  CHECK_IN_PROCESSES.push({
    process: checkInProcess,
    address,
  });

  checkInProcess.on('error', (error) => {
    console.error(`Failed to start check-in process for ${address}:`, error);
  });

  checkInProcess.on('exit', (code) => {
    console.log(`Check-in process for ${address} exited with code ${code}`);
    const index = CHECK_IN_PROCESSES.findIndex((p) => p.address === address);
    if (index !== -1) {
      CHECK_IN_PROCESSES.splice(index, 1);
    }
  });
}

async function stopAllCheckIns() {
  for (const { process, address } of CHECK_IN_PROCESSES) {
    console.log(`Stopping check-in process for ${address}`);
    process.kill();
  }
  CHECK_IN_PROCESSES.length = 0;
}

async function main() {
  const addresses = [
    '5GqHh2K9mNpQ4rT7vX3wY8zL1jF6cB9nM',
    '3KjL8mN5pQ2rT9vX4wY7zB1cF6nM9hG2',
    '7MpN2kL5qR8tV3xY4wZ9bC1fH6nJ9gD2',
    '4NqM8kL2pR5tV7xY3wZ6bC9fH1nJ4gD7',
    '2PmN5kL8qR3tV9xY6wZ4bC7fH2nJ1gD5',
    '6KjL9mN4pQ3rT8vX5wY2zB1fH7nJ8gD3',
    '8MpN3kL7qR4tV2xY5wZ1bC9fH4nJ7gD2',
    '1PmN4kL7qR2tV5xY8wZ3bC6fH9nJ2gD5',
    '9KjL6mN3pQ4rT7vX2wY5zB8fH1nJ5gD4',
  ];

  // Handle process termination
  process.on('SIGINT', () => {
    console.log('Stopping all check-in processes...');
    void stopAllCheckIns().then(() => process.exit(0));
  });

  process.on('SIGTERM', () => {
    console.log('Stopping all check-in processes...');
    void stopAllCheckIns().then(() => process.exit(0));
  });

  // Start check-in processes with delays
  for (const address of addresses) {
    await startCheckIn(address);
    await sleep(100); // Wait 1 second between starting each process
  }

  // Keep the main process running
  while (true) {
    await sleep(1000);
  }
}

main().catch((error) => {
  console.error('Error in main process:', error);
  process.exit(1);
});
