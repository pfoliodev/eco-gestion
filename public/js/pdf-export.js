/**
 * PDF Export Module
 * Handles course content export to PDF using html2pdf.js
 */

import { state } from './state.js';

/**
 * Download the current course as PDF
 * @param {string} courseId - ID of the course to export
 */
export async function downloadCourseAsPdf(courseId) {
    const course = state.courses.find(c => c.id === courseId);
    if (!course) {
        console.error('Course not found:', courseId);
        return;
    }

    // Get the button and show loading state
    const downloadBtn = document.getElementById('download-pdf-btn');
    if (downloadBtn) {
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = '<span class="pdf-spinner"></span> Génération...';
    }

    try {
        // Create a temporary container for PDF content
        const pdfContainer = document.createElement('div');
        pdfContainer.className = 'pdf-export-container';

        // Format date
        const dateStr = course.createdAt
            ? new Date(course.createdAt.seconds * 1000).toLocaleDateString('fr-FR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })
            : new Date().toLocaleDateString('fr-FR');

        // Build PDF content with proper styling
        pdfContainer.innerHTML = `
            <style>
                .pdf-export-container {
                    font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                    color: #1a1a2e;
                    padding: 40px;
                    line-height: 1.6;
                }
                .pdf-header {
                    border-bottom: 3px solid #6366f1;
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .pdf-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: #1a1a2e;
                    margin: 0 0 15px 0;
                }
                .pdf-meta {
                    display: flex;
                    gap: 20px;
                    flex-wrap: wrap;
                    font-size: 14px;
                    color: #64748b;
                }
                .pdf-meta-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .pdf-tag {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                }
                .pdf-tag-subject {
                    background: #e0e7ff;
                    color: #4338ca;
                }
                .pdf-tag-type {
                    background: #dcfce7;
                    color: #166534;
                }
                .pdf-content {
                    font-size: 14px;
                }
                .pdf-content h1, .pdf-content h2, .pdf-content h3 {
                    color: #1a1a2e;
                    margin-top: 25px;
                    margin-bottom: 15px;
                }
                .pdf-content h1 { font-size: 24px; }
                .pdf-content h2 { font-size: 20px; }
                .pdf-content h3 { font-size: 16px; }
                .pdf-content p { margin-bottom: 12px; }
                .pdf-content ul, .pdf-content ol {
                    margin-bottom: 15px;
                    padding-left: 25px;
                }
                .pdf-content li { margin-bottom: 6px; }
                .pdf-content table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    font-size: 13px;
                }
                .pdf-content th, .pdf-content td {
                    border: 1px solid #e2e8f0;
                    padding: 10px 12px;
                    text-align: left;
                }
                .pdf-content th {
                    background: #f1f5f9;
                    font-weight: 600;
                }
                .pdf-footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #e2e8f0;
                    font-size: 11px;
                    color: #94a3b8;
                    text-align: center;
                }
            </style>
            <div class="pdf-header">
                <h1 class="pdf-title">${escapeHtml(course.title)}</h1>
                <div class="pdf-meta">
                    <span class="pdf-tag pdf-tag-subject">${escapeHtml(course.subject)}</span>
                    <span class="pdf-tag pdf-tag-type">${escapeHtml((course.type || 'cours').charAt(0).toUpperCase() + (course.type || 'cours').slice(1))}</span>
                </div>
                <div class="pdf-meta" style="margin-top: 15px;">
                    <span class="pdf-meta-item">👤 ${escapeHtml(course.author || 'Anonyme')}</span>
                    <span class="pdf-meta-item">📅 ${dateStr}</span>
                </div>
            </div>
            <div class="pdf-content">
                ${course.content}
            </div>
            <div class="pdf-footer">
                Généré depuis Cours B1C2 - Économie • ${new Date().toLocaleDateString('fr-FR')}
            </div>
        `;

        // Style the container - MUST be in document flow for html2canvas
        // Using position: relative keeps it in flow so height is calculated correctly
        // Container will be visible briefly during capture, then removed
        pdfContainer.style.cssText = `
            position: relative;
            width: 190mm;
            min-height: 297mm;
            padding: 35px;
            background: white;
            box-sizing: border-box;
        `;

        // Temporarily add to DOM for rendering
        document.body.appendChild(pdfContainer);

        // Force a reflow to ensure styles are applied
        pdfContainer.offsetHeight;

        // Configure html2pdf options
        const options = {
            margin: [10, 10, 10, 10],
            filename: `${sanitizeFilename(course.title)}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                logging: false
            },
            jsPDF: {
                unit: 'mm',
                format: 'a4',
                orientation: 'portrait'
            },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        // Generate and download PDF
        await html2pdf().set(options).from(pdfContainer).save();

        // Clean up
        document.body.removeChild(pdfContainer);

        // Show success notification
        if (window.notyf) {
            window.notyf.success('PDF téléchargé avec succès !');
        }

    } catch (error) {
        console.error('Error generating PDF:', error);
        if (window.notyf) {
            window.notyf.error('Erreur lors de la génération du PDF');
        }
    } finally {
        // Reset button state
        if (downloadBtn) {
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = '📄 Télécharger PDF';
        }
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Sanitize filename for PDF export
 */
function sanitizeFilename(name) {
    return name
        .replace(/[^a-zA-Z0-9àâäéèêëïîôùûüÿçÀÂÄÉÈÊËÏÎÔÙÛÜŸÇ\s-]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 100);
}
