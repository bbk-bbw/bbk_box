// FILE: js/printer.js (REPLACE entire file)

/**
 * Fetches the student's complete submission from Firestore.
 * @param {string} userUid The Firebase user's unique ID.
 * @returns {Promise<object>} The student's submission data.
 */
async function getSubmissionData(userUid) {
    try {
        const db = firebase.firestore();
        const submissionRef = db.collection('submissions').doc(userUid);
        const doc = await submissionRef.get();
        return doc.exists ? doc.data() : {};
    } catch (error) {
        console.error("Error fetching submission for printing:", error);
        return {};
    }
}

/**
 * Generates the complete HTML content for the print window.
 * @param {object} assignmentData The assignment structure from assignment.json.
 * @param {object} submissionData The student's answers from Firestore.
 * @returns {string} The complete HTML for the print window.
 */
function generatePrintHTML(assignmentData, submissionData) {
    let bodyContent = `<h1>${assignmentData.assignmentTitle}</h1><hr>`;

    assignmentData.pages.forEach(page => {
        bodyContent += `<div class="page-section"><h2>${page.title}</h2>`;
        
        page.elements.forEach(element => {
            if (element.type === 'quill') {
                const answer = submissionData?.[page.id]?.[element.id] || '<p><i>Keine Antwort abgegeben.</i></p>';
                bodyContent += `
                    <div class="question-answer-pair">
                        <p class="question-text">${element.question}</p>
                        <div class="answer-box">${answer}</div>
                    </div>
                `;
            }
        });
        bodyContent += `</div>`;
    });

    const css = `
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; line-height: 1.5; margin: 2em; }
        h1 { font-size: 2em; border-bottom: 2px solid #ccc; padding-bottom: 0.5em; margin-bottom: 1em; }
        h2 { font-size: 1.5em; background-color: #f0f0f0; padding: 0.5em; margin-top: 2em; border-left: 5px solid #007bff; }
        .page-section { page-break-inside: avoid; margin-bottom: 2em; }
        .question-answer-pair { margin-bottom: 1.5em; padding-left: 1em; border-left: 3px solid #e9ecef; }
        .question-text { font-weight: bold; color: #333; }
        .answer-box { padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-top: 0.5em; background-color: #f9f9f9; }
        .answer-box p:first-child { margin-top: 0; }
        .answer-box p:last-child { margin-bottom: 0; }
        hr { border: 0; border-top: 1px solid #ccc; }
        @media print { 
            h2 { background-color: #f0f0f0 !important; -webkit-print-color-adjust: exact; } 
        }
    `;

    return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Druckansicht: ${assignmentData.assignmentTitle}</title><style>${css}</style></head><body>${bodyContent}</body></html>`;
}

/**
 * Main function to orchestrate the printing process.
 * @param {object} assignmentData The main assignment structure.
 * @param {string} userUid The current user's ID.
 */
export async function printAnswers(assignmentData, userUid) {
    if (!assignmentData || !userUid) {
        alert("Fehler: Aufgabendaten oder Benutzer-ID fehlen.");
        return;
    }

    const submissionData = await getSubmissionData(userUid);
    const htmlContent = generatePrintHTML(assignmentData, submissionData);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Popup-Fenster wurde blockiert. Bitte erlaube Popups für diese Seite.");
        return;
    }

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    setTimeout(() => {
        printWindow.focus();
        printWindow.print();
    }, 500);
}