export const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
        { type: 'success', background: '#28a745', icon: false },
        { type: 'error', background: '#dc3545', duration: 5000, icon: false }
    ]
});

export function initTinyMCE(selector = '#editor-container', options = {}) {
    tinymce.init({
        selector: selector,
        height: options.height || 400,
        menubar: options.menubar !== undefined ? options.menubar : true,
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'help', 'wordcount'
        ],
        toolbar: options.toolbar || 'undo redo | blocks | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | code | help',
        content_style: 'body { font-family:Inter,sans-serif; font-size:14px }',
        skin: 'oxide',
        content_css: 'default',
        setup: (editor) => {
            if (options.setup) options.setup(editor);
        },
        ...options
    });
}

let transitionTimeout = null;

export function showPage(pageId) {
    let targetPage = document.getElementById(pageId);
    if (!targetPage) {
        targetPage = document.getElementById(`page-${pageId}`);
    }

    if (!targetPage) {
        console.warn(`Page not found: ${pageId}`);
        return;
    }

    // 1. Handle Rapid Clicks / Interruptions
    if (transitionTimeout) {
        clearTimeout(transitionTimeout);
        transitionTimeout = null;
        // Instantly hide all pages to reset state
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active', 'exiting'));
        // Instantly show new page
        targetPage.classList.add('active');
        // Dispatch event immediately
        document.dispatchEvent(new CustomEvent('pageChange', { detail: { pageId } }));
        return;
    }

    // INSTANT SWITCH (No transition delay)
    // Matches 'main' branch behavior which user prefers (+ scroll fix)

    // Hide all pages first (clean slate)
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active', 'exiting'));

    // Show new page
    targetPage.classList.add('active');

    // Reset scroll immediately
    window.scrollTo(0, 0);

    // Dispatch event
    document.dispatchEvent(new CustomEvent('pageChange', { detail: { pageId } }));
}
