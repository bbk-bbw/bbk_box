// FILE: js/renderer.js (REPLACE entire file)

// --- Debounce Utility ---
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// --- Firestore Save Logic ---
const debouncedSave = debounce(async (userUid, payload) => {
    try {
        // Access the globally available 'firebase' object
        const db = firebase.firestore();
        const submissionRef = db.collection('submissions').doc(userUid);
        
        await submissionRef.set(payload, { merge: true });
        console.log("Saved to Firestore:", payload);
    } catch (error) {
        console.error("Error saving to Firestore:", error);
    }
}, 1500);

/**
 * Renders the static structure of a page.
 */
export function renderPage(pageObject, container) {
    container.innerHTML = '';

    if (pageObject.helpText) {
        const details = document.createElement('details');
        details.innerHTML = `<summary>Weitere Informationen</summary>${pageObject.helpText}`;
        container.appendChild(details);
    }

    pageObject.elements.forEach(element => {
        if (element.type === 'text') {
            renderTextBlock(element, container);
        } else if (element.type === 'quill') {
            renderQuillEditorStructure(element, container);
        }
    });
}

/**
 * Loads data from Firestore and populates the Quill editors.
 */
export async function loadAndRenderAnswers(userUid, pageObject) {
    const db = firebase.firestore();
    const submissionRef = db.collection('submissions').doc(userUid);
    const doc = await submissionRef.get();
    const data = doc.exists ? doc.data() : {};

    pageObject.elements.forEach(element => {
        if (element.type === 'quill') {
            const editorDiv = document.getElementById(`quill-editor-${element.id}`);
            if (editorDiv && editorDiv.__quill) {
                const answer = data?.[pageObject.id]?.[element.id] || '';
                if (answer) {
                    editorDiv.__quill.root.innerHTML = answer;
                }
            }
        }
    });
}

/**
 * Attaches 'text-change' event listeners to all Quill editors on the page.
 */
export function setupQuillListeners(userUid, pageObject) {
    pageObject.elements.forEach(element => {
        if (element.type === 'quill') {
            const editorDiv = document.getElementById(`quill-editor-${element.id}`);
            if (editorDiv && editorDiv.__quill) {
                editorDiv.__quill.on('text-change', () => {
                    const content = editorDiv.__quill.root.innerHTML;
                    const payload = {
                        [pageObject.id]: { [element.id]: content }
                    };
                    debouncedSave(userUid, payload);
                });
            }
        }
    });
}

function renderTextBlock(element, container) {
    const div = document.createElement('div');
    div.className = 'text-element';
    div.innerHTML = element.content;
    container.appendChild(div);
}

function renderQuillEditorStructure(element, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'quill-element';
    const prompt = document.createElement('p');
    prompt.className = 'question-prompt';
    prompt.textContent = element.question;
    wrapper.appendChild(prompt);
    const editorDiv = document.createElement('div');
    editorDiv.id = `quill-editor-${element.id}`;
    wrapper.appendChild(editorDiv);
    container.appendChild(wrapper);
    new Quill(editorDiv, {
        theme: 'snow',
        modules: {
            toolbar: [['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], ['clean']]
        }
    });
}