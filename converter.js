document.addEventListener('DOMContentLoaded', () => {
    const dataviewInput = document.getElementById('dataview-input');
    const datacoreOutput = document.getElementById('datacore-output');
    const convertBtn = document.getElementById('convert-btn');

    const standardFields = [
        '$file',
        '$ordinal',
        '$name',
        '$path',
        '$folder',
        '$link',
        '$size',
        '$ctime',
        '$mtime',
        '$tags',
        '$links',
        '$blocks'
    ];

    // Conversion rules
    const conversionRules = {
        // Basic query patterns
        'FROM (.*?)$': "const pages = dc.useQuery('@page and $1');",
        'WHERE': 'WHERE',
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
        'TABLE\\s*$': () => {
            return `const columns = [\n\t{ name: "File", value: page => page.$link },\n];\nreturn <dc.Table rows={pages} columns={columns} />;`;
        },
        'TABLE\\s+(.*?)$': (match, columns) => {
            // Start with the default File column
            let columnsArray = ['\t{ name: "File", value: page => page.$link }'];
            
            // If additional columns were specified, add them
            if (columns && columns.trim()) {
                const additionalColumns = columns.split(',').map(col => col.trim());
                additionalColumns.forEach(col => {
                    columnsArray.push(`\t{ name: "${col}", value: page => page.` + getdata(col) + ` }`);
                });
            }
            
            return `const columns = [\n${columnsArray.join(',\n')},\n];\nreturn <dc.Table rows={pages} columns={columns} />;`;
        }
    }

    function getdata(field) {
        if (standardFields.includes(field)) {
            return `${field}`;
        }
        return `value("${field}")`;
    }

    function convertDataviewToDatacore(input) {
        let output = input;
        let hasReturnCommand = false;
        let append = '';
        let sortField = '';
        let sortDirection = 'asc';
        let hasSort = false;
        
        // First check for SORT command
        const sortRegex = /SORT\s+(.*?)(?:\s+(asc|desc))?$/gmi;
        if (sortRegex.test(output)) {
            hasSort = true;
            output = output.replace(sortRegex, (match, field, direction) => {
                sortField = field.trim();
                if (direction) sortDirection = direction.toLowerCase();
                return '';
            });
        }
        
        // Then check for return commands
        for (const [match, returnRule] of Object.entries(returnRules)) {
            const regex = new RegExp(match, 'gmi');
            if (regex.test(output)) {
                hasReturnCommand = true;
                if (typeof returnRule === 'function') {
                    // For TABLE command, use the function to generate the return statement
                    output = output.replace(regex, (fullMatch, group1) => {
                        append = returnRule(fullMatch, group1);
                        if (hasSort) {
                            append = append.replace(/rows={pages}/g, 'rows={sortedPages}');
                        }
                        return '';
                    });
                } else {
                    // For other commands (like LIST), use the static return statement
                    output = output.replace(regex, '');
                    append = returnRule;
                    if (hasSort) {
                        append = append.replace(/rows={pages}/g, 'rows={sortedPages}');
                    }
                }
            }
        }

        // Then handle the FROM pattern
        const queryRegex = /FROM\s+(.*?)$/gmi;
        output = output.replace(queryRegex, (match, group1) => {
            let query = `const pages = dc.useQuery('@page and ${group1.trim()}');`;
            if (sortField) {
                // Convert the field name to the correct Datacore format
                const fieldName = sortField.startsWith('file.') ? sortField.replace('file.', '$') : sortField;
                const sortFunction = 
                    `array.sort((a) => a.${getdata(fieldName)}, "${sortDirection}")`;
                query += `\nconst sortedPages = dc.useArray(pages, array => ${sortFunction});`;
            }
            return query;
        });
        
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