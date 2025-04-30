document.addEventListener('DOMContentLoaded', () => {
    const dataviewInput = document.getElementById('dataview-input');
    const datacoreOutput = document.getElementById('datacore-output');
    const convertBtn = document.getElementById('convert-btn');

    // Conversion rules
    const conversionRules = {
        // Basic query patterns
        'FROM (.*?)$': 'const pages = dc.useQuery("@page and $1");',
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
        // 'TABLE': 'return <dc.Table rows={pages} />;'
    }

    function convertDataviewToDatacore(input) {
        let output = input;
        let hasReturnCommand = false;
        let append = '';
        
        // First handle the FROM pattern separately since it's more complex
        const queryRegex = /FROM\s+(.*?)$/gmi;
        output = output.replace(queryRegex, (match, group1) => {
            return `const pages = dc.useQuery("@page and ${group1.trim()}");`;
        });

        // Check for return commands
        for (const [match, returnRule] of Object.entries(returnRules)) {
            const listRegex = new RegExp(match, 'gi');
            if (listRegex.test(output)) {
                hasReturnCommand = true;
                output = output.replace(listRegex, '');
                append = returnRule;
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
                         output + '\n' +
                         append + '\n' +
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