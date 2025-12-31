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

export function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    let targetPage = document.getElementById(pageId);
    if (!targetPage) {
        targetPage = document.getElementById(`page-${pageId}`);
    }

    if (targetPage) {
        targetPage.classList.add('active');
        // If the target is a container wrapping the content, ensure the content is visible
        // (This is redundant if the CSS handles it, but good for safety)
    } else {
        console.warn(`Page not found: ${pageId}`);
    }

    // Trigger specific page logic if needed (handled in main/other modules)
    const event = new CustomEvent('pageChange', { detail: { pageId } });
    document.dispatchEvent(event);
}
