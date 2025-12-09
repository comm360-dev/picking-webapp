const fs = require('fs');
const path = require('path');

// Mapping des anciennes couleurs sombres vers les nouvelles variables CSS
const colorMap = {
  // Backgrounds sombres vers clairs
  'background: #0a0a0a': 'background: var(--bg-primary)',
  'background: #1a1a1a': 'background: var(--bg-card)',
  'background: #2a2a2a': 'background: var(--bg-secondary)',

  // Borders
  'border: 1px solid #2a2a2a': 'border: 1px solid var(--border)',
  'border: 1px solid #3a3a3a': 'border: 1px solid var(--border)',
  'border-bottom: 1px solid #2a2a2a': 'border-bottom: 1px solid var(--border)',
  'border-left: 3px solid #2a2a2a': 'border-left: 3px solid var(--border)',
  'border-top: 1px solid #2a2a2a': 'border-top: 1px solid var(--border)',

  // Text colors
  'color: #e0e0e0': 'color: var(--text-primary)',
  'color: #ffffff': 'color: var(--text-primary)',
  'color: #9e9e9e': 'color: var(--text-secondary)',
  'color: #757575': 'color: var(--text-secondary)',
  'color: #616161': 'color: var(--text-tertiary)',

  // Radius
  'border-radius: 6px': 'border-radius: var(--radius-sm)',
  'border-radius: 8px': 'border-radius: var(--radius-md)',
  'border-radius: 4px': 'border-radius: 8px',

  // Colors spécifiques
  '#4caf50': 'var(--success)',
  '#2196f3': 'var(--primary)',
  '#ff9800': 'var(--warning)',
  '#f44336': 'var(--error)',
  '#b71c1c': 'rgba(239, 68, 68, 0.1)',
  '#ef5350': 'var(--error)',
  '#1b5e20': 'rgba(16, 185, 129, 0.1)',
  '#c62828': 'rgba(239, 68, 68, 0.3)',
  '#2e7d32': 'rgba(16, 185, 129, 0.3)',

  // Transitions
  'transition: background 0.2s': 'transition: all var(--transition-fast)',
  'transition: all 0.2s': 'transition: all var(--transition-fast)',
  'transition: opacity 0.2s': 'transition: opacity var(--transition-fast)',
};

function updateStyles(content) {
  let updated = content;

  // Apply all color mappings
  for (const [oldValue, newValue] of Object.entries(colorMap)) {
    updated = updated.split(oldValue).join(newValue);
  }

  return updated;
}

// Files to update
const files = [
  'frontend/src/views/PickingView.vue',
  'frontend/src/views/LoginView.vue',
  'frontend/src/views/RegisterView.vue',
  'frontend/src/views/HistoryView.vue',
  'frontend/src/views/AdminQRView.vue',
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const updated = updateStyles(content);
    fs.writeFileSync(filePath, updated, 'utf8');
    console.log(`✅ Updated: ${file}`);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log('🎨 Style update complete!');
