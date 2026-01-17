/**
 * Compiler Utility
 */
const { compileTargetImage, validateTargetImage } = require('../services/compiler');
const path = require('path');

// CLI usage: node utils/compiler.js <input> <output>
if (require.main === module) {
    const [,, input, output] = process.argv;
    if (!input || !output) { console.log('Usage: node compiler.js <input.jpg> <output.mind>'); process.exit(1); }
    const validation = validateTargetImage(input);
    if (!validation.valid) { console.error('Validation failed:', validation.error); process.exit(1); }
    compileTargetImage(input, output).then(() => console.log('Compiled:', output)).catch(e => { console.error(e); process.exit(1); });
}

module.exports = { compileTargetImage, validateTargetImage };