const { spawn } = require('child_process');
const path = require('path');

const NUM_PROCESSES = () => Math.floor(Math.random() * 10) + 1; // Number of concurrent processes to spawn
const CHECK_IN_INTERVAL = () => Math.floor(Math.random() * 1000) + 100; // Interval between check-ins in milliseconds

function spawnCheckInProcess() {
    const checkInScript = path.join(__dirname, 'check-in.js');
    const childProcess = spawn('node', [checkInScript], {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc']
    });

    childProcess.on('error', (error) => {
        console.error(`Failed to start process: ${error.message}`);
    });

    return childProcess;
}

function startBatch() {
    const numProcesses = NUM_PROCESSES();
    console.log(`Starting ${numProcesses} check-in processes...`);
    const processes = [];

    // Spawn processes
    for (let i = 0; i < numProcesses; i++) {
        const process = spawnCheckInProcess();
        processes.push(process);
        console.log(`Started process ${i + 1}/${numProcesses}`);
    }

    // Set up interval for each process to send check-ins
    processes.forEach((process, index) => {
        setInterval(() => {
            if (!process.killed) {
                process.send('send-check-in');
            }
        }, CHECK_IN_INTERVAL());
    });

    // Handle cleanup on script termination
    process.on('SIGINT', () => {
        console.log('\nShutting down processes...');
        processes.forEach((process, index) => {
            process.kill();
            console.log(`Terminated process ${index + 1}`);
        });
        process.exit(0);
    });
}

// Start the batch process
startBatch(); 