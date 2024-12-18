const editor = document.getElementById('editor');
const notesDiv = document.getElementById('notes');
const submitButton = document.getElementById('submitButton');
const tocToggle = document.getElementById('tocToggle');
const toc = document.getElementById('toc');
let searchTimeout = null;

// Load TOC visibility state
const tocVisible = localStorage.getItem('tocVisible') !== 'false';
toc.classList.toggle('hidden', !tocVisible);

// Handle TOC toggle
tocToggle.addEventListener('click', () => {
    const isVisible = !toc.classList.contains('hidden');
    toc.classList.toggle('hidden');
    localStorage.setItem('tocVisible', !isVisible);
});

window.addEventListener('load', async () => {
    displayNotes();
});

function smoothScroll(target) {
    document.querySelectorAll('.note.highlight').forEach(el => {
        el.classList.remove('highlight');
    });
    target.classList.add('highlight');
    target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

async function displayNotes() {
    const params = new URLSearchParams(window.location.search);
    const searchQuery = params.get('q');
    let response = await fetch('/notes');
    if (response.ok) {
        const notes = await response.json();
        const filteredNotes = notes.filter(note => 
            !searchQuery || note.content.toLowerCase().includes(searchQuery.toLowerCase())
        );

        notesDiv.innerHTML = filteredNotes
            .map((note, i) => {
                const noteId = `note-${i}`;
                return `
                <div id="${noteId}" class="note bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
                    <div class="note-content prose dark:prose-invert max-w-none">
                        ${note.html}
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-2 flex justify-between items-center">
                        <div class="flex items-center gap-2">
                            <i class="far fa-clock"></i>
                            <time datetime="${note.timestamp}">${note.timestamp}</time>
                        </div>
                        <button onclick="deleteNote(${i})" class="text-red-600 hover:text-red-800 dark:text-red-500 dark:hover:text-red-400" title="Delete note">
                            <span class="fas fa-trash-alt"></span>
                        </button>
                    </div>
                </div>`;
            })
            .reverse()
            .join('');

        const tocContent = document.getElementById('tocContent');
        tocContent.innerHTML = filteredNotes
            .map((note, i) => {
                const title = note.content.split('\n')[0].slice(0, 20) + 
                    (note.content.split('\n')[0].length > 20 ? '...' : '');
                return `<a href="#note-${i}" class="block py-2 px-3 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" onclick="event.preventDefault(); smoothScroll(document.getElementById('note-${i}'))">${title}</a>`;
            })
            .reverse()
            .join('');
    }
}

async function saveNotes() {
    if (!editor.value) {
        return;
    }
    const saveResponse = await fetch('/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editor.value)
    });

    if (saveResponse.ok) {
        editor.value = '';
        displayNotes();
    }
}

async function deleteNote(idx) {
    event.preventDefault();
    if (!confirm('Are you sure you want to delete this note?')) {
        return;
    }

    deleteResponse = await fetch(`/notes/${idx}`, {
        method: 'DELETE'
    });

    if (deleteResponse.ok) {
        displayNotes();
    } else {
        alert('Failed to delete note');
    }
}

editor.addEventListener('input', async (e) => {
    const text = editor.value;
    if (text.startsWith('/')) {
        if (searchTimeout) {
            clearTimeout(searchTimeout);
        }
        searchTimeout = setTimeout(async () => {
            const query = text.slice(1);
            const newUrl = query
                ? `${window.location.pathname}?q=${encodeURIComponent(query)}`
                : window.location.pathname;
            window.history.replaceState({}, '', newUrl);
            displayNotes();
        }, 200);
    } else if (text === '') {
        window.history.replaceState({}, '', window.location.pathname);
    }
});

editor.addEventListener('keydown', async (e) => {
    if (e.ctrlKey && e.key === 'Enter' && !editor.value.startsWith('/')) {
        saveNotes();
    }
});

submitButton.addEventListener('click', async (e) => {
    saveNotes();
});

editor.addEventListener('dragover', (e) => {
    e.preventDefault();
});

editor.addEventListener('drop', async (e) => {
    e.preventDefault();

    const files = e.dataTransfer.files;
    for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const path = await response.json();
            const filename = path.split('/').pop();

            const position = editor.selectionStart;
            const before = editor.value.substring(0, position);
            const after = editor.value.substring(position);

            const needsBrackets = path.includes(' ') || filename.includes(' ');
            const formattedPath = needsBrackets ? `<${path}>` : path;

            if (file.type.startsWith('image/')) {
                editor.value = `${before}![${filename}](${formattedPath})${after}`;
            } else {
                editor.value = `${before}[${filename}](${formattedPath})${after}`;
            }
        }
    }
});
