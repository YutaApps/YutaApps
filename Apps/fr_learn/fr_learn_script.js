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

            // --- NEW LOGIC ---
            // Instead of populating a nav, we render all guidebooks at once.
            renderAllGuidebooks(guidebooks);
        })
        .catch(error => {
            console.error("Error loading or parsing guidebook data:", error);
            contentArea.innerHTML = `<div class="placeholder">
                <h2>Error Loading Guidebook!</h2>
                <p>Could not parse data from <code>fr_learn_script.txt</code>.</p>
                <p>Error details: ${error.message}</p>
            </div>`;
        });

    // --- NEW FUNCTION: Renders all units into the content area ---
    function renderAllGuidebooks(guidebooks) {
        // Use map to create an array of HTML strings, one for each guidebook
        const allHtml = guidebooks.map(guidebook => {
            // Re-use the render logic, but now it returns HTML instead of setting it
            let html = `<div class="unit-container">`; // Wrap each unit in a container for styling
            html += `<h1 class="unit-title">${guidebook.title}</h1>`;
            html += `<p class="unit-description">${guidebook.description}</p>`;

            guidebook.content.forEach(section => {
                if (section.type === 'KEY PHRASES') {
                    html += `<h2 class="section-title"><i class="fa-solid fa-key"></i> Key Phrases</h2>`;
                    section.items.forEach(phrase => {
                        html += `<div class="phrase-card">
                                    <span class="phrase-lang">French</span><p class="phrase-fr">${phrase.french}</p>
                                    <span class="phrase-lang">English</span><p class="phrase-en">${phrase.english}</p>
                                </div>`;
                    });
                } else if (section.type === 'TIP') {
                    html += `<h2 class="section-title tip-section-title"><i class="fa-solid fa-lightbulb"></i> Tip</h2>`;
                    html += `<div class="tip-card"><h3 class="tip-title">${section.title}</h3>`;
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

            html += `</div>`; // Close the unit-container
            return html;
        });

        // Join all the HTML strings together and put them on the page
        contentArea.innerHTML = allHtml.join('');
    }

    // (The parsing functions below do not need to be changed)

    function parseAllGuidebooks(text) {
        const unitSeparator = /========================================\nTITLE:/g;
        const fileSeparator = /==================== END OF FILE \d+ ====================/g;
        
        const cleanedText = text.replace(fileSeparator, '').trim();
        const unitsText = cleanedText.split(unitSeparator).filter(t => t.trim() !== '');

        return unitsText.map((unitText, index) => {
            const lines = ("TITLE:" + unitText).trim().split('\n');
            const titleLine = lines.find(line => line.startsWith('TITLE:'));
            const title = titleLine ? titleLine.replace('TITLE:', '').trim() : `Unit ${index + 1}`;
            const description = lines.length > 2 ? lines[2] : '';
            const content = lines.slice(3).join('\n').trim();
            
            return {
                id: `unit-${index}`,
                title,
                description,
                content: parseUnitContent(content)
            };
        });
    }
    
    function parseUnitContent(content) {
        const sections = content.split('------------------------------').filter(s => s.trim() !== '');
        return sections.map(section => {
            const lines = section.trim().split('\n');
            const type = lines[0]?.trim() || 'UNKNOWN';
            const details = lines.slice(1).join('\n').trim();

            if (type === 'KEY PHRASES') {
                const titleLine = lines[1]?.trim() || 'Key Phrases';
                const phraseBlocks = details.split('--- Example Phrase ---').filter(p => p.trim());
                const phrases = phraseBlocks.map(block => {
                    const french = block.match(/French:\s*(.*)/)?.[1]?.trim() || '';
                    const english = block.match(/English:\s*(.*)/)?.[1]?.trim() || '';
                    return { type: 'phrase', french, english };
                });
                return { type: 'KEY PHRASES', title: titleLine, items: phrases };
            }

            if (type === 'TIP') {
                const tipTitle = lines[1]?.trim() || 'Tip';
                const tipContent = [];
                const tipBody = details.split('\n').slice(1).join('\n');
                const tipBlocks = tipBody.split(/--- (?:Example Phrase|Table) ---/);
                const blockTypes = [...tipBody.matchAll(/--- (Example Phrase|Table) ---/g)].map(match => match[1]);
                const initialText = tipBlocks[0]?.trim();
                if (initialText) {
                    tipContent.push({ type: 'paragraph', text: initialText });
                }
                tipBlocks.slice(1).forEach((blockContent, i) => {
                    const blockType = blockTypes[i];
                     if (blockType === 'Example Phrase') {
                        const french = blockContent.match(/French:\s*(.*)/)?.[1]?.trim() || '';
                        const english = blockContent.match(/English:\s*(.*)/)?.[1]?.trim() || '';
                        tipContent.push({ type: 'phrase', french, english });
                    } else if (blockType === 'Table') {
                        const tableParts = blockContent.split('-------------');
                        const tableRowsText = tableParts[0]?.trim();
                        if (tableRowsText) {
                            const tableRows = tableRowsText.split('\n');
                            const headers = (tableRows[0] || '').split('|').map(h => h.trim());
                            const rows = tableRows.slice(1).map(row => row.split('|').map(cell => cell.trim()));
                            tipContent.push({ type: 'table', headers, rows });
                        }
                        const afterTableText = tableParts[1]?.trim();
                        if(afterTableText) {
                            tipContent.push({type: 'paragraph', text: afterTableText});
                        }
                    }
                });
                return { type: 'TIP', title: tipTitle, items: tipContent };
            }
            return { type: 'UNKNOWN', content: section };
        });
    }
});
