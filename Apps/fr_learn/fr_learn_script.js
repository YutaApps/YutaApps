document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');

    fetch('/YutaApps/Apps/fr_learn/fr_learn_script.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text();
        })
        .then(rawData => {
            if (!rawData.trim()) {
                throw new Error("The data file 'fr_learn_script.txt' is empty.");
            }
            const guidebooks = parseAllGuidebooks(rawData);
            renderAllGuidebooks(guidebooks);
        })
        .catch(error => {
            console.error("Error loading or parsing guidebook data:", error);
            contentArea.innerHTML = `<div class="placeholder">
                <h2>Error Loading or Parsing Guidebook!</h2>
                <p>Could not process data from <code>fr_learn_script.txt</code>.</p>
                <p>There might be a formatting error in the text file that the script can't handle.</p>
                <p>Error details: ${error.message}</p>
            </div>`;
        });

    // --- NEW, MORE ROBUST PARSING LOGIC ---

    function parseAllGuidebooks(text) {
        // This regex is safer because it looks for the full unit separator.
        const unitSeparator = /========================================\s*TITLE:/g;
        const fileSeparator = /==================== END OF FILE \d+ ====================/g;
        
        const cleanedText = text.replace(fileSeparator, '').trim();
        const unitsText = cleanedText.split(unitSeparator).filter(t => t.trim() !== '');

        return unitsText.map((unitText, index) => {
            // Find the first real content separator to distinguish header from body
            const contentSeparator = '\n------------------------------\n';
            const separatorIndex = unitText.indexOf(contentSeparator);

            const headerText = unitText.substring(0, separatorIndex).trim();
            const contentText = unitText.substring(separatorIndex).trim();
            
            const headerLines = headerText.split('\n').filter(line => line.trim() !== '');

            return {
                id: `unit-${index}`,
                title: headerLines[0] || `Unit ${index + 1}`,
                description: headerLines.slice(1).join(' ').trim(),
                content: parseUnitContent(contentText)
            };
        });
    }
    
    function parseUnitContent(content) {
        // Split content into major sections (KEY PHRASES, TIP, etc.)
        const sections = content.split('------------------------------').filter(s => s.trim() !== '');

        return sections.map(sectionText => {
            const lines = sectionText.trim().split('\n').filter(line => line.trim() !== '');
            if (lines.length === 0) return null;

            const type = lines[0].trim();
            const body = lines.slice(1);

            switch (type) {
                case 'KEY PHRASES': {
                    const titleLine = body[0] || 'Key Phrases';
                    const phraseBlocks = sectionText.split('--- Example Phrase ---').slice(1);
                    const phrases = phraseBlocks.map(block => {
                        const french = block.match(/French:\s*(.*)/)?.[1]?.trim() || '';
                        const english = block.match(/English:\s*(.*)/)?.[1]?.trim() || '';
                        return { type: 'phrase', french, english };
                    });
                    return { type: 'KEY PHRASES', title: titleLine, items: phrases };
                }
                case 'TIP': {
                    const tipTitle = body[0] || 'Tip';
                    const tipBodyText = body.slice(1).join('\n');
                    const tipContent = [];
                    // This regex is better because it splits AND keeps the delimiter type
                    const tipParts = tipBodyText.split(/(--- (?:Example Phrase|Table) ---)/);

                    // The first part is always the initial text before any blocks
                    const initialText = tipParts[0]?.trim();
                    if (initialText) {
                        tipContent.push({ type: 'paragraph', text: initialText });
                    }

                    // Process the remaining parts in pairs (delimiter, content)
                    for (let i = 1; i < tipParts.length; i += 2) {
                        const delimiter = tipParts[i];
                        const blockContent = tipParts[i + 1];
                        
                        if (delimiter.includes('Example Phrase')) {
                            const french = blockContent.match(/French:\s*(.*)/)?.[1]?.trim() || '';
                            const english = blockContent.match(/English:\s*(.*)/)?.[1]?.trim() || '';
                            tipContent.push({ type: 'phrase', french, english });
                        } else if (delimiter.includes('Table')) {
                            const tableParts = blockContent.split('-------------');
                            const tableRowsText = tableParts[0]?.trim();
                            if (tableRowsText) {
                                const tableRows = tableRowsText.split('\n');
                                const headers = (tableRows[0] || '').split('|').map(h => h.trim());
                                const rows = tableRows.slice(1).map(row => row.split('|').map(cell => cell.trim()));
                                tipContent.push({ type: 'table', headers, rows });
                            }
                            const afterTableText = tableParts[1]?.trim();
                            if (afterTableText) {
                                tipContent.push({ type: 'paragraph', text: afterTableText });
                            }
                        }
                    }
                    return { type: 'TIP', title: tipTitle, items: tipContent };
                }
                default:
                    return { type: 'UNKNOWN', content: sectionText };
            }
        }).filter(Boolean); // Remove any null sections
    }

    // --- This rendering function is the same as before ---
    function renderAllGuidebooks(guidebooks) {
        const allHtml = guidebooks.map(guidebook => {
            let html = `<div class="unit-container">`;
            html += `<h1 class="unit-title">${guidebook.title}</h1>`;
            html += `<p class="unit-description">${guidebook.description}</p>`;

            guidebook.content.forEach(section => {
                if (section.type === 'KEY PHRASES') {
                    html += `<h2 class="section-title"><i class="fa-solid fa-key"></i> ${section.title}</h2>`;
                    section.items.forEach(phrase => {
                        html += `<div class="phrase-card">
                                    <span class="phrase-lang">French</span><p class="phrase-fr">${phrase.french}</p>
                                    <span class="phrase-lang">English</span><p class="phrase-en">${phrase.english}</p>
                                </div>`;
                    });
                } else if (section.type === 'TIP') {
                    html += `<h2 class="section-title tip-section-title"><i class="fa-solid fa-lightbulb"></i> Tip: ${section.title}</h2>`;
                    html += `<div class="tip-card">`; // Removed h3 title, as it's now in the h2
                    section.items.forEach(item => {
                        if (item.type === 'paragraph') {
                            html += `<p>${item.text.replace(/\n/g, '<br>')}</p>`;
                        } else if (item.type === 'phrase') {
                            html += `<div class="phrase-card">
                                        <span class="phrase-lang">French</span><p class="phrase-fr">${item.french}</p>
                                        <span class="phrase-lang">English</span><p class="phrase-en">${item.english}</p>
                                    </div>`;
                        } else if (item.type === 'table') {
                            html += '<table><thead><tr>';
                            item.headers.forEach(header => html += `<th>${header}</th>`);
                            html += '</tr></thead><tbody>';
                            item.rows.forEach(row => {
                                html += '<tr>';
                                row.forEach(cell => html += `<td>${cell.replace(/(\w+)\s(\w+)/, '<strong>$1</strong> $2')}</td>`);
                                html += '</tr>';
                            });
                            html += '</tbody></table>';
                        }
                    });
                    html += `</div>`;
                }
            });

            html += `</div>`;
            return html;
        });

        contentArea.innerHTML = allHtml.join('');
    }
});
