export const notyf = new Notyf({
    duration: 3000,
    position: { x: 'right', y: 'top' },
    types: [
        { type: 'success', background: '#28a745', icon: false },
        { type: 'error', background: '#dc3545', duration: 5000, icon: false }
    ]
});

export function initTinyMCE() {
    tinymce.init({
        selector: '#editor-container',
        height: 400,
        menubar: true,
        plugins: [
            'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
            'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
            'insertdatetime', 'media', 'table', 'help', 'wordcount'
        ],
        toolbar: 'undo redo | blocks | bold italic backcolor | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | removeformat | code | help',
        content_style: 'body { font-family:Inter,sans-serif; font-size:14px }',
        skin: 'oxide',
        content_css: 'default'
    });
}

export function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }

    // Trigger specific page logic if needed (handled in main/other modules)
    const event = new CustomEvent('pageChange', { detail: { pageId } });
    document.dispatchEvent(event);
}
