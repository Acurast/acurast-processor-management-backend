// Collections of random data
const deviceAddresses = [
    'device-001', 'device-002', 'device-003', 'device-004', 'device-005',
    'device-006', 'device-007', 'device-008', 'device-009', 'device-010'
];

const ssids = [
    'Home-Network', 'Office-WiFi', 'Guest-Network', 'Mobile-Hotspot',
    'Coffee-Shop', 'Airport-WiFi', 'Hotel-Network', 'Public-WiFi'
];

const networkTypes = ['wifi', 'cellular', 'usb', 'offline'];
const batteryHealths = ['good', 'bad', 'critical'];

function getRandomElement(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateRandomTemperature() {
    return Math.floor(Math.random() * 40) + 20; // Random temperature between 20-60°C
}

function generateCheckInData() {
    return {
        deviceAddress: getRandomElement(deviceAddresses),
        timestamp: Date.now(),
        batteryLevel: Math.floor(Math.random() * 100),
        isCharging: Math.random() > 0.5,
        batteryHealth: getRandomElement(batteryHealths),
        temperature: {
            battery: generateRandomTemperature(),
            cpu: generateRandomTemperature(),
            gpu: generateRandomTemperature(),
            ambient: generateRandomTemperature()
        },
        networkType: getRandomElement(networkTypes),
        ssid: getRandomElement(ssids),
        signature: 'test-signature-' + Math.random().toString(36).substring(7)
    };
}

async function sendCheckIn() {
    try {
        const checkInData = generateCheckInData();
        const response = await fetch('http://localhost:3000/processor/check-in', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(checkInData)
        });

        const result = await response.json();
        console.log(`Check-in sent for device ${checkInData.deviceAddress}:`, result);
        return result;
    } catch (error) {
        console.error('Error sending check-in:', error);
        throw error;
    }
}

// Listen for messages from parent process
process.on('message', async (message) => {
    if (message === 'send-check-in') {
        await sendCheckIn();
    }
});

// If running directly (not imported as a module)
if (require.main === module) {
    sendCheckIn();
}

module.exports = { sendCheckIn }; 