const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '../src/processor/templates');
const targetDir = path.join(__dirname, '../dist/src/processor/templates');

// Create target directory if it doesn't exist
if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
}

// Copy all template files
fs.readdirSync(sourceDir).forEach(file => {
    if (file.endsWith('.html')) {
        fs.copyFileSync(
            path.join(sourceDir, file),
            path.join(targetDir, file)
        );
    }
});

console.log('Templates copied successfully'); 