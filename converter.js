document.addEventListener('DOMContentLoaded', () => {
    const dataviewInput = document.getElementById('dataview-input');
    const datacoreOutput = document.getElementById('datacore-output');
    const convertBtn = document.getElementById('convert-btn');

    // Conversion rules
    const conversionRules = {
        // Basic query patterns
        'FROM (.*?)$': "const pages = dc.useQuery('@page and $1');",
        'WHERE': 'WHERE',
        'SORT': 'ORDER BY',
        'GROUP BY': 'GROUP BY',
        'FLATTEN': 'FLATTEN',
        
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
        'dataview': 'datacorejsx'
    };

    const returnRules = {
        'LIST': 'return <dc.List rows={pages} renderer={pages => pages.$link} />;',
        'TABLE\\s*(.*?)$': (match, columns) => {
            // Start with the default File column
            let columnsArray = ['\t{ name: "File", value: page => page.$link }'];
            
            // If additional columns were specified, add them
            if (columns && columns.trim()) {
                const additionalColumns = columns.split(',').map(col => col.trim());
                additionalColumns.forEach(col => {
                    columnsArray.push(`\t{ name: "${col}", value: page => page.value("${col}") }`);
                });
            }
            
            return `const columns = [\n${columnsArray.join(',\n')},\n];\nreturn <dc.Table rows={pages} columns={columns} />;`;
        }
    }

    function convertDataviewToDatacore(input) {
        let output = input;
        let hasReturnCommand = false;
        let append = '';
        
        // First handle the FROM pattern separately since it's more complex
        const queryRegex = /FROM\s+(.*?)$/gmi;
        output = output.replace(queryRegex, (match, group1) => {
            return `const pages = dc.useQuery('@page and ${group1.trim()}');`;
        });

        // Check for return commands
        for (const [match, returnRule] of Object.entries(returnRules)) {
            const regex = new RegExp(match, 'gmi');
            if (regex.test(output)) {
                hasReturnCommand = true;
                if (typeof returnRule === 'function') {
                    // For TABLE command, use the function to generate the return statement
                    output = output.replace(regex, (fullMatch, group1) => {
                        append = returnRule(fullMatch, group1);
                        return '';
                    });
                } else {
                    // For other commands (like LIST), use the static return statement
                    output = output.replace(regex, '');
                    append = returnRule;
                }
            }
        }
        
        // Then handle other conversion rules
        for (const [dataview, datacore] of Object.entries(conversionRules)) {
            if (dataview.startsWith('FROM')) continue; // Skip FROM as we handled it above
            
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

        // If we have a return statement, wrap everything in a function
        if (hasReturnCommand) {
            // Check if we have code fences
            const hasCodeFences = output.includes('```');
            if (hasCodeFences) {
                // Extract the content between the fences
                const content = output.replace(/```.*?\n|\n```/g, '').trim();
                output = '```datacorejsx\n' +
                         'return function View() {\n' +
                         '	' + content + '\n' +
                         '	' + append + '\n' +
                         '}\n' +
                         '```';
            } else {
                // If no code fences, just wrap the content
                output = 'return function View() {\n' + 
                         '	' + output + '\n' +
                         '	' + append + '\n' +
                         '}';
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