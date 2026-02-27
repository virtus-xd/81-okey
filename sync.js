const fs = require('fs');
const path = require('path');

const frontendFiles = [
    'bot.js', 'config.js', 'game.js', 'gameEngine.js', 'gameMultiplayer.js',
    'index.html', 'multiplayer.html', 'renderer.js', 'sounds.js', 'style.css'
];

const backendFiles = [
    'gameEngine.js', 'server.js'
];

console.log('🔄 Sincronizing files from root to frontend/ and backend/...');

// Ensure directories exist
if (!fs.existsSync(path.join(__dirname, 'frontend'))) {
    fs.mkdirSync(path.join(__dirname, 'frontend'));
}
if (!fs.existsSync(path.join(__dirname, 'backend'))) {
    fs.mkdirSync(path.join(__dirname, 'backend'));
}

frontendFiles.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(__dirname, 'frontend', file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied to frontend: ${file}`);
    } else {
        console.warn(`⚠️ Warning: Source file missing: ${file}`);
    }
});

backendFiles.forEach(file => {
    const src = path.join(__dirname, file);
    const dest = path.join(__dirname, 'backend', file);
    if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✅ Copied to backend: ${file}`);
    }
});

console.log('✅ Sincronization complete!');
