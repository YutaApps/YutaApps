document.addEventListener('DOMContentLoaded', () => {
    const contentArea = document.getElementById('content-area');

    fetch('/YutaApps/Apps/fr_learn/fr_learn_script.txt')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.text();
        })
        .then(rawData => {
            if (!rawData.trim()) throw new Error("The data file is empty.");
            
            const guidebooks = parseAllGuidebooks(rawData);
            renderAllGuidebooks(guidebooks);
        })
        .catch(error => {
            console.error("Error loading or parsing guidebook data:", error);
            contentArea.innerHTML = `<div class="placeholder">
                <h2>Error Loading or Parsing Guidebook!</h2>
                <p>Could not process data from <code>fr_learn_script.txt</code>.</p>
                <p><b>Please try a hard refresh (Ctrl+Shift+R).</b> If the problem persists, there may be a script error.</p>
                <p>Error details: ${error.message}</p>
            </div>`;
        });

    function parseAllGuidebooks(text) {
        const fileSeparator = /==================== END OF FILE \d+ ====================/g;
        const cleanedText = text.replace(fileSeparator, '').trim();
        
        // Split the entire text file into unit blocks
        const unitBlocks = cleanedText.split('========================================').filter(block => block.trim());

        return unitBlocks.map((unitBlock, index) => {
            const lines = unitBlock.trim().split('\n');
            const title = lines[0].replace('TITLE:', '').trim();
            const description = lines[2] || ''; // The line after the '======' separator
            
            // The rest of the block is content
            const contentText = lines.slice(4).join('\n');

            return {
                id: `unit-${index}`,
                title,
                description,
                content: parseUnitContent(contentText)
            };
        });
    }
    
    function parseUnitContent(contentText) {
        // Split content into major sections (KEY PHRASES, TIP, etc.)
        const sections = contentText.split('------------------------------').filter(s => s.trim());

        return sections.map(sectionText => {
            const lines = sectionText.trim().split('\n');
            if (lines.length < 2) return null; // A valid section needs at least a type and a subtitle/content

            const type = lines[0].trim();
            
            if (type === 'KEY PHRASES') {
                const titleLine = lines[1].trim();
                const phraseBlocks = sectionText.split('--- Example Phrase ---').slice(1);
                const phrases = phraseBlocks.map(block => {
                    const french = block.match(/French:\s*(.*)/)?.[1]?.trim() || '';
                    const english = block.match(/English:\s*(.*)/)?.[1]?.trim() || '';
                    return { type: 'phrase', french, english };
                });
                return { type: 'KEY PHRASES', title: titleLine, items: phrases };
            }

            if (type === 'TIP') {
                const tipTitle = lines[1].trim();
                const tipBodyText = lines.slice(2).join('\n');
                const tipContent = [];
                const tipParts = tipBodyText.split(/(--- (?:Example Phrase|Table) ---)/);

                const initialText = tipParts[0]?.trim();
                if (initialText) {
                    tipContent.push({ type: 'paragraph', text: initialText });
                }

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
                            const tableRows = tableRowsText.split('\n').filter(r => r.trim());
                            const headers = (tableRows[0] || '').split('|').map(h => h.trim());
                            const rows = tableRows.slice(1).map(row => row.split('|').map(cell => cell.trim()));
                            tipContent.push({ type: 'table', headers, rows });
                        }
                        const afterTableText = tableParts[1]?.trim();
                        if(afterTableText) {
                            tipContent.push({ type: 'paragraph', text: afterTableText });
                        }
                    }
                }
                return { type: 'TIP', title: tipTitle, items: tipContent };
            }
            return null;
        }).filter(Boolean); // Remove any null/unrecognized sections
    }

    function renderAllGuidebooks(guidebooks) {
        const allHtml = guidebooks.map(guidebook => {
            let html = `<div class="unit-container">`;
            html += `<h1 class="unit-title">${guidebook.title}</h1>`;
            html += `<p class="unit-description">${guidebook.description}</p>`;

            guidebook.content.forEach(section => {
                if (section.type === 'KEY PHRASES') {
                    // Use the parsed subtitle here
                    html += `<h2 class="section-title"><i class="fa-solid fa-key"></i> ${section.title}</h2>`;
                    section.items.forEach(phrase => {
                        html += `<div class="phrase-card">
                                    <span class="phrase-lang">French</span><p class="phrase-fr">${phrase.french}</p>
                                    <span class="phrase-lang">English</span><p class="phrase-en">${phrase.english}</p>
                                </div>`;
                    });
                } else if (section.type === 'TIP') {
                    // Use the parsed tip title here
                    html += `<h2 class="section-title tip-section-title"><i class="fa-solid fa-lightbulb"></i> Tip: ${section.title}</h2>`;
                    html += `<div class="tip-card">`;
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
