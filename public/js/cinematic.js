// Inject styles dynamically if not present
if (!document.getElementById('cinematic-css')) {
    const link = document.createElement('link');
    link.id = 'cinematic-css';
    link.rel = 'stylesheet';
    link.href = '/css/components/cinematic.css';
    document.head.appendChild(link);
}

export function playProfessorCinematic(profImage, messages, themeColor = '#2563eb') {
    return new Promise((resolve) => {
        if (!messages || messages.length === 0) {
            resolve();
            return;
        }

        // Create DOM elements
        const overlay = document.createElement('div');
        overlay.className = 'cinematic-overlay';

        // Professor Image Container
        const profContainer = document.createElement('div');
        profContainer.className = 'cinematic-prof-container';

        const img = document.createElement('img');
        img.src = profImage;
        img.className = 'cinematic-prof-img';
        profContainer.appendChild(img);

        // Dialogue Box
        const dialogueBox = document.createElement('div');
        dialogueBox.className = 'cinematic-dialogue-box';
        dialogueBox.style.setProperty('--theme-color', themeColor);

        const content = document.createElement('div');
        content.className = 'cinematic-content';
        dialogueBox.appendChild(content);

        const nextIcon = document.createElement('div');
        nextIcon.className = 'cinematic-next-icon';
        nextIcon.innerHTML = '▼';
        dialogueBox.appendChild(nextIcon);

        // Append to overlay
        overlay.appendChild(profContainer);
        overlay.appendChild(dialogueBox);
        document.body.appendChild(overlay);

        // Animation Logic
        let currentMsgIndex = 0;
        let isTyping = false;
        let typeTimeout;

        const showMessage = (text) => {
            content.textContent = '';
            nextIcon.style.opacity = '0';
            isTyping = true;

            let i = 0;
            const speed = 25; // ms per char

            const typeChar = () => {
                if (i < text.length) {
                    content.textContent += text.charAt(i);
                    i++;
                    typeTimeout = setTimeout(typeChar, speed);
                } else {
                    isTyping = false;
                    if (currentMsgIndex < messages.length - 1) {
                        nextIcon.innerHTML = '▼';
                        nextIcon.style.opacity = '1';
                    } else {
                        nextIcon.innerHTML = '✖'; // Close icon
                        nextIcon.style.opacity = '1';
                    }
                }
            };
            typeChar();
        };

        // Initial play
        // Force reflow
        overlay.offsetHeight;

        setTimeout(() => {
            overlay.classList.add('active');
            setTimeout(() => {
                showMessage(messages[0]);
            }, 600); // Wait for prof slide-in
        }, 50);

        // Interaction
        const advance = (e) => {
            // Prevent fast clicking issues
            e.stopPropagation();

            if (isTyping) {
                // Instant finish current message
                clearTimeout(typeTimeout);
                content.textContent = messages[currentMsgIndex];
                isTyping = false;
                if (currentMsgIndex < messages.length - 1) {
                    nextIcon.innerHTML = '▼';
                    nextIcon.style.opacity = '1';
                } else {
                    nextIcon.innerHTML = '✖';
                    nextIcon.style.opacity = '1';
                }
                return;
            }

            if (currentMsgIndex < messages.length - 1) {
                currentMsgIndex++;
                showMessage(messages[currentMsgIndex]);
            } else {
                closeCinematic();
            }
        };

        const closeCinematic = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                overlay.remove();
                resolve();
            }, 500);
        };

        // Click anywhere to advance
        overlay.addEventListener('click', advance);
    });
}
