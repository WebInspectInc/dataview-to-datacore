document.addEventListener('DOMContentLoaded', () => {
    const dataviewInput = document.getElementById('dataview-input');
    const datacoreOutput = document.getElementById('datacore-output');
    const convertBtn = document.getElementById('convert-btn');

    // Conversion rules
    const conversionRules = {
        // Basic query patterns
        'FROM (.*?)$': 'const pages = dc.useQuery("$1");',
        'WHERE': 'WHERE',
        'SORT': 'ORDER BY',
        'GROUP BY': 'GROUP BY',
        'FLATTEN': 'FLATTEN',
        'LIST': 'return <dc.List rows={pages} renderer={pages => pages.$link} />;',
        
        // Field patterns
        'file.name': 'file.name',
        'file.path': 'file.path',
        'file.folder': 'file.folder',
        'file.link': 'file.link',
        'file.size': 'file.size',
        'file.ctime': 'file.created',
        'file.mtime': 'file.modified',
        'file.tags': 'file.tags',
        
        // Function patterns
        'date': 'date',
        'contains': 'contains',
        'regexmatch': 'regexmatch',
        'length': 'length',
        'sum': 'sum',
        'average': 'avg',
        'min': 'min',
        'max': 'max',
        
        // Special patterns
        '```dataview': '```datacorejsx',
        '```': '```'
    };

    function convertDataviewToDatacore(input) {
        let output = input;
        let hasListCommand = false;
        
        // First handle the FROM pattern separately since it's more complex
        const fromRegex = /FROM\s+(.*?)$/gmi;
        output = output.replace(fromRegex, (match, group1) => {
            console.log('FROM match:', match);
            console.log('FROM group1:', group1);
            return `const pages = dc.useQuery("${group1.trim()}");`;
        });

        // Check for LIST command
        const listRegex = /LIST/gmi;
        if (listRegex.test(output)) {
            hasListCommand = true;
            output = output.replace(listRegex, '');
        }
        
        // Then handle other conversion rules
        for (const [dataview, datacore] of Object.entries(conversionRules)) {
            if (dataview.startsWith('FROM') || dataview === 'LIST') continue; // Skip FROM and LIST as we handled them above
            
            const regex = new RegExp(dataview, 'gi');
            output = output.replace(regex, (match, group1) => {
                if (group1 !== undefined) {
                    return datacore.replace('$1', group1);
                }
                return datacore;
            });
        }
        
        // Handle special cases
        output = output.replace(/\[\[(.*?)\]\]/g, '[[$1]]'); // Keep links as is
        output = output.replace(/`(.*?)`/g, '`$1`'); // Keep inline code as is

        // Add LIST return statement before the closing code block if it was present
        if (hasListCommand) {
            // Find the last occurrence of the closing code block
            const lastCodeBlockIndex = output.lastIndexOf('```');
            if (lastCodeBlockIndex !== -1) {
                // Insert the return statement before the closing code block
                output = output.slice(0, lastCodeBlockIndex) + 
                         '\nreturn <dc.List rows={pages} renderer={pages => pages.$link} />;\n' + 
                         output.slice(lastCodeBlockIndex);
            } else {
                // If no code block markers found, just append at the end
                output += '\nreturn <dc.List rows={pages} renderer={pages => pages.$link} />;';
            }
        }
        
        return output;
    }

    convertBtn.addEventListener('click', () => {
        const input = dataviewInput.value;
        const output = convertDataviewToDatacore(input);
        datacoreOutput.value = output;
    });

    // Add auto-conversion on input change
    dataviewInput.addEventListener('input', () => {
        const input = dataviewInput.value;
        const output = convertDataviewToDatacore(input);
        datacoreOutput.value = output;
    });
}); 