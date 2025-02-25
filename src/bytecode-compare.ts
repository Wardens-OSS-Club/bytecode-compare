import * as fs from 'fs';

/**
 * Compares two bytecode files and highlights differences, with options to ignore specific sections
 * @param file1Path Path to the first bytecode file
 * @param file2Path Path to the second bytecode file
 * @param options Comparison options
 */
function compareBytecode(
  file1Path: string, 
  file2Path: string, 
  options: {
    ignoreBytecodeHash?: boolean,
    ignoreCborMetadata?: boolean,
    bytecodeHashPattern?: RegExp,
    cborMetadataPattern?: RegExp,
  } = {}
): void {
  try {
    // Default patterns for bytecode hash and CBOR metadata
    const bytecodeHashPattern = options.bytecodeHashPattern || /a264697066735822[0-9a-fA-F]{68}/g;
    const cborMetadataPattern = options.cborMetadataPattern || /a2644970667358[0-9a-fA-F]+?6673/g;

    /**
     * 
     * For a more generic pattern, you might want to look for:
      CBOR-encoded hashes:
      Copy/a[1-9][0-9a-f]*58[0-9a-f]{2}[0-9a-fA-F]{40,128}/g
      This would match CBOR maps with byte strings that are between 20-64 bytes long (typical hash lengths).
      Raw hashes without encoding:
      Copy/(?<![0-9a-fA-F])[0-9a-fA-F]{64}(?![0-9a-fA-F])/g
      This would match standalone 32-byte (64 hex character) sequences typical of SHA-256/Keccak-256.
      Metadata identifier with hash:
      Bytecode might have specific prefixes before hash values that identify what they are. For example, in Solidity contracts, you might see patterns like:
      Copy/metadata([0-9a-fA-F]{64})/g


      The specific patterns would depend on:
     * 
     */


    // Read files
    let bytecode1 = fs.readFileSync(file1Path, 'utf8').replace(/\s+/g, '');
    let bytecode2 = fs.readFileSync(file2Path, 'utf8').replace(/\s+/g, '');

    // Original length before any replacements
    const originalLength1 = bytecode1.length;
    const originalLength2 = bytecode2.length;

    console.log(`File 1: ${file1Path} (${originalLength1} chars)`);
    console.log(`File 2: ${file2Path} (${originalLength2} chars)`);
    
    // Create copies for analysis that can be modified
    let analyzedBytecode1 = bytecode1;
    let analyzedBytecode2 = bytecode2;

    // Maps to track replaced sections for reporting
    const replacedSections1: {type: string, position: number, length: number, content: string}[] = [];
    const replacedSections2: {type: string, position: number, length: number, content: string}[] = [];

    // Replace bytecode hash if requested
    if (options.ignoreBytecodeHash) {
      // Find and replace bytecode hash in first file
      let match;
      while ((match = bytecodeHashPattern.exec(analyzedBytecode1)) !== null) {
        const hashContent = match[0];
        replacedSections1.push({
          type: 'Bytecode Hash',
          position: match.index,
          length: hashContent.length,
          content: hashContent
        });
      }
      
      // Find and replace bytecode hash in second file
      bytecodeHashPattern.lastIndex = 0; // Reset regex index
      while ((match = bytecodeHashPattern.exec(analyzedBytecode2)) !== null) {
        const hashContent = match[0];
        replacedSections2.push({
          type: 'Bytecode Hash',
          position: match.index,
          length: hashContent.length,
          content: hashContent
        });
      }

      // Replace the hashes with placeholders for comparison
      analyzedBytecode1 = analyzedBytecode1.replace(bytecodeHashPattern, '[BYTECODE_HASH]');
      analyzedBytecode2 = analyzedBytecode2.replace(bytecodeHashPattern, '[BYTECODE_HASH]');
    }

    // Replace CBOR metadata if requested
    if (options.ignoreCborMetadata) {
      // Find and replace CBOR metadata in first file
      let match;
      while ((match = cborMetadataPattern.exec(analyzedBytecode1)) !== null) {
        const metadataContent = match[0];
        replacedSections1.push({
          type: 'CBOR Metadata',
          position: match.index,
          length: metadataContent.length,
          content: metadataContent
        });
      }
      
      // Find and replace CBOR metadata in second file
      cborMetadataPattern.lastIndex = 0; // Reset regex index
      while ((match = cborMetadataPattern.exec(analyzedBytecode2)) !== null) {
        const metadataContent = match[0];
        replacedSections2.push({
          type: 'CBOR Metadata',
          position: match.index,
          length: metadataContent.length,
          content: metadataContent
        });
      }

      // Replace the metadata with placeholders for comparison
      analyzedBytecode1 = analyzedBytecode1.replace(cborMetadataPattern, '[CBOR_METADATA]');
      analyzedBytecode2 = analyzedBytecode2.replace(cborMetadataPattern, '[CBOR_METADATA]');
    }

    // Report on replaced sections
    if (replacedSections1.length > 0 || replacedSections2.length > 0) {
      console.log("\nReplaced sections for comparison:");
      
      if (replacedSections1.length > 0) {
        console.log(`\nFile 1 (${replacedSections1.length} sections):`);
        replacedSections1.forEach((section, i) => {
          console.log(`  ${i+1}. ${section.type} at position ${section.position}-${section.position + section.length - 1}`);
          console.log(`     Content: ${section.content.substring(0, 30)}${section.content.length > 30 ? '...' : ''}`);
        });
      }
      
      if (replacedSections2.length > 0) {
        console.log(`\nFile 2 (${replacedSections2.length} sections):`);
        replacedSections2.forEach((section, i) => {
          console.log(`  ${i+1}. ${section.type} at position ${section.position}-${section.position + section.length - 1}`);
          console.log(`     Content: ${section.content.substring(0, 30)}${section.content.length > 30 ? '...' : ''}`);
        });
      }
    }

    // Check if bytecodes are identical after replacements
    if (analyzedBytecode1 === analyzedBytecode2) {
      console.log('\n✅ The bytecodes are functionally identical (ignoring specified metadata sections).');
      return;
    }

    console.log('\n❌ The bytecodes are different, even ignoring specified metadata sections.');
    
    // Find differences in the analyzed bytecode
    const differences: {start: number, end: number, content1: string, content2: string}[] = [];
    let currentDiffStart: number | null = null;
    
    for (let i = 0; i < Math.max(analyzedBytecode1.length, analyzedBytecode2.length); i++) {
      if (analyzedBytecode1[i] !== analyzedBytecode2[i]) {
        // Start of a new difference
        if (currentDiffStart === null) {
          currentDiffStart = i;
        }
      } else if (currentDiffStart !== null) {
        // End of a difference
        differences.push({
          start: currentDiffStart,
          end: i - 1,
          content1: analyzedBytecode1.substring(currentDiffStart, i),
          content2: analyzedBytecode2.substring(currentDiffStart, i)
        });
        currentDiffStart = null;
      }
    }
    
    // Check if there's still an open difference at the end
    if (currentDiffStart !== null) {
      differences.push({
        start: currentDiffStart,
        end: Math.max(analyzedBytecode1.length, analyzedBytecode2.length) - 1,
        content1: analyzedBytecode1.substring(currentDiffStart),
        content2: analyzedBytecode2.substring(currentDiffStart)
      });
    }
    
    // Output differences
    console.log(`\nFound ${differences.length} difference${differences.length !== 1 ? 's' : ''}:`);
    
    differences.forEach((diff, index) => {
      console.log(`\nDifference #${index + 1}:`);
      console.log(`Position: ${diff.start} to ${diff.end} (length: ${diff.end - diff.start + 1})`);
      console.log(`File 1: ${diff.content1 || '(missing)'}`);
      console.log(`File 2: ${diff.content2 || '(missing)'}`);
      
      // Get some context around the difference
      const contextSize = 16; // Number of characters to show before and after
      const contextStart = Math.max(0, diff.start - contextSize);
      const contextEnd = Math.min(Math.max(analyzedBytecode1.length, analyzedBytecode2.length), diff.end + contextSize + 1);
      
      const context1 = analyzedBytecode1.substring(contextStart, contextEnd);
      const context2 = analyzedBytecode2.substring(contextStart, contextEnd);
      
      console.log('\nContext:');
      console.log(`File 1: ${context1.substring(0, diff.start - contextStart)}[${diff.content1}]${context1.substring(diff.end - contextStart + 1)}`);
      console.log(`File 2: ${context2.substring(0, diff.start - contextStart)}[${diff.content2}]${context2.substring(diff.end - contextStart + 1)}`);
    });
    
    // Summary statistics
    const totalDiffLength = differences.reduce((sum, diff) => sum + (diff.end - diff.start + 1), 0);
    const percentDiff = (totalDiffLength / Math.max(analyzedBytecode1.length, analyzedBytecode2.length) * 100).toFixed(2);
    
    console.log(`\nSummary: ${totalDiffLength} different characters (${percentDiff}% of the analyzed bytecode)`);
    
  } catch (error) {
    console.error('Error comparing bytecode files:', error);
  }
}

// Process command line arguments
const args = process.argv.slice(2);
let file1Path = '';
let file2Path = '';
const options: {
  ignoreBytecodeHash: boolean,
  ignoreCborMetadata: boolean,
  help: boolean
} = {
  ignoreBytecodeHash: false,
  ignoreCborMetadata: false,
  help: false
};

// Parse arguments
for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--ignore-hash') {
    options.ignoreBytecodeHash = true;
  } else if (arg === '--ignore-cbor' || arg === '--ignore-metadata') {
    options.ignoreCborMetadata = true;
  } else if (arg === '--help' || arg === '-h') {
    options.help = true;
  } else if (!file1Path) {
    file1Path = arg;
  } else if (!file2Path) {
    file2Path = arg;
  }
}

// Show help
if (options.help || !file1Path || !file2Path) {
  console.log(`
Bytecode Comparison Tool
------------------------
Usage: ts-node bytecode-compare.ts [options] <file1> <file2>

Options:
  --ignore-hash       Ignore bytecode hash differences
  --ignore-cbor       Ignore CBOR metadata differences
  --help, -h          Show this help message

Example:
  ts-node bytecode-compare.ts --ignore-hash --ignore-cbor bytecode1.hex bytecode2.hex
  `);
  process.exit(1);
}

// Run the comparison
console.log('Bytecode Comparison:');
console.log('-------------------');
console.log(`Options: ${options.ignoreBytecodeHash ? 'Ignoring bytecode hash, ' : ''}${options.ignoreCborMetadata ? 'Ignoring CBOR metadata' : ''}`);
compareBytecode(file1Path, file2Path, {
  ignoreBytecodeHash: options.ignoreBytecodeHash,
  ignoreCborMetadata: options.ignoreCborMetadata
});