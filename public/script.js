let courses = [
    {
        id: 1,
        title: 'Synthèse du fonctionnement de l\'entreprise',
        subject: 'Économie d\'entreprise',
        description: 'Définitions, typologie, classification et facteurs de différenciation',
        content: `
            <div class="course-detail-content">
                <div class="section">
                    <h3>Définitions de l'entreprise</h3>
                    <p>L'entreprise peut être abordée sous deux angles principaux :</p>
                    <div class="definition">
                        <strong>Angle organisationnel :</strong> Il s'agit d'une organisation dont l'activité est la production de biens ou de services à caractère commercial.
                    </div>
                    <div class="definition">
                        <strong>Angle économique et juridique :</strong> Elle est définie comme une unité économique jouissant d'une autonomie juridique, organisée pour offrir des produits ou services sur un marché.
                    </div>
                </div>

                <div class="section">
                    <h3>Typologie selon la propriété (Actionnariat)</h3>
                    <p>Les entreprises se distinguent par la nature de leurs détenteurs, ce qui influence directement leurs objectifs et leurs moyens :</p>
                    <ul>
                        <li><strong>Entreprises Publiques :</strong> Détenues par l'État, comme <span class="highlight">EDF</span>.</li>
                        <li><strong>Entreprises Privées :</strong> Détenues par des investisseurs privés, comme <span class="highlight">Apple</span>.</li>
                        <li><strong>Entreprises Mixtes :</strong> Allient actionnariat public et privé, comme <span class="highlight">Renault</span>.</li>
                    </ul>
                    <p>Le document mentionne également les processus de <strong>nationalisation</strong> (passage du privé au public) et de <strong>concession</strong>.</p>
                </div>

                <div class="section">
                    <h3>Classification par taille (Loi LME de 2008)</h3>
                    <p>En France, on dénombre environ <span class="highlight">3,8 millions</span> d'entreprises. La loi de modernisation de l'économie définit quatre catégories selon l'effectif et le chiffre d'affaires (CA) :</p>
                    <ul>
                        <li><strong>Grandes Entreprises (GE) :</strong> Elles comptent au moins <strong>5 000 salariés</strong> ou réalisent un CA supérieur à <strong>1,5 milliard d'euros</strong>. On en dénombre <strong>287</strong> en France.</li>
                        <li><strong>Entreprises de Taille Intermédiaire (ETI) :</strong> Elles emploient entre <strong>250 et 4 999 salariés</strong> avec un CA inférieur à <strong>1,5 milliard d'euros</strong>. Il en existe environ <strong>5 800</strong>.</li>
                        <li><strong>Petites et Moyennes Entreprises (PME) :</strong> Elles regroupent moins de <strong>250 personnes</strong> et réalisent un CA inférieur à <strong>50 millions d'euros</strong>. Elles sont au nombre de <strong>140 000</strong>.</li>
                        <li><strong>Micro Entreprises (MIC) :</strong> Elles emploient moins de <strong>10 personnes</strong> pour un CA inférieur à <strong>2 millions d'euros</strong>. Elles représentent <strong>95%</strong> des entreprises françaises (<strong>3,67 millions</strong>).</li>
                    </ul>
                </div>

                <div class="section">
                    <h3>Les facteurs de différenciation</h3>
                    <p>Il est essentiel de retenir que le mode de fonctionnement d'une entreprise n'est pas uniforme. Il varie selon quatre critères interdépendants :</p>
                    <ul>
                        <li>Le <strong>type d'actionnariat</strong></li>
                        <li>Les <strong>objectifs fixés</strong> (chiffre d'affaires, marge brute, notoriété ou business plan)</li>
                        <li>Les <strong>moyens alloués</strong></li>
                        <li>L'<strong>organisation interne</strong> qui en découle</li>
                    </ul>
                </div>
            </div>
        `
    }
];

let currentCourseId = null;
let isHtmlView = false;

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    if (pageId === 'cours') {
        renderCourses();
        updateFilters();
    }
}

function renderCourses() {
    const grid = document.getElementById('course-grid');
    const searchTerm = document.getElementById('course-search').value.toLowerCase();
    const subjectFilter = document.getElementById('course-filter').value;
    
    let filteredCourses = courses.filter(course => {
        const matchesSearch = course.title.toLowerCase().includes(searchTerm) || 
                             course.subject.toLowerCase().includes(searchTerm) ||
                             course.description.toLowerCase().includes(searchTerm);
        const matchesSubject = !subjectFilter || course.subject === subjectFilter;
        return matchesSearch && matchesSubject;
    });
    
    grid.innerHTML = filteredCourses.map(course => `
        <div class="course-card" data-course-id="${course.id}">
            <h3>${course.title}</h3>
            <span class="course-subject-tag">${course.subject}</span>
            <p>${course.description}</p>
            <div class="course-card-actions">
                <button class="btn-view" onclick="viewCourse(${course.id})">Voir le cours</button>
            </div>
        </div>
    `).join('');
    
    // Mettre à jour les statistiques
    document.querySelectorAll('.stat-card h3')[0].textContent = courses.length;
    document.querySelectorAll('.stat-card h3')[1].textContent = courses.reduce((sum, course) => 
        sum + (course.content.match(/<h3>/g) || []).length, 0
    );
}

function updateFilters() {
    const subjects = [...new Set(courses.map(course => course.subject))];
    const filter = document.getElementById('course-filter');
    filter.innerHTML = '<option value="">Tous les sujets</option>' + 
        subjects.map(subject => `<option value="${subject}">${subject}</option>`).join('');
}

function viewCourse(id) {
    const course = courses.find(c => c.id === id);
    if (course) {
        currentCourseId = id;
        document.getElementById('course-content').innerHTML = `
            <h2>${course.title}</h2>
            <span class="course-subject-tag">${course.subject}</span>
            ${course.content}
        `;
        showPage('course-detail');
    }
}

function editCourse() {
    const course = courses.find(c => c.id === currentCourseId);
    if (course) {
        document.getElementById('form-title').textContent = 'Modifier le cours';
        document.getElementById('course-id').value = course.id;
        document.getElementById('course-title').value = course.title;
        document.getElementById('course-subject').value = course.subject;
        document.getElementById('course-description').value = course.description;
        document.getElementById('course-editor').innerHTML = course.content;
        document.getElementById('course-html').value = course.content;
        
        showPage('ajouter');
    }
}

function deleteCourse() {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce cours ?')) {
        courses = courses.filter(c => c.id !== currentCourseId);
        saveCourses();
        backToCourses();
        alert('Cours supprimé avec succès');
    }
}

function cancelForm() {
    document.getElementById('course-form').reset();
    currentCourseId = null;
    showPage('cours');
}

function formatText(command) {
    document.execCommand(command, false, null);
    document.getElementById('course-editor').focus();
}

function insertHeading() {
    const selection = window.getSelection();
    const range = selection.getRangeAt(0);
    const heading = document.createElement('h3');
    heading.textContent = selection.toString() || 'Titre';
    range.deleteContents();
    range.insertNode(heading);
    range.selectNodeContents(heading);
    selection.removeAllRanges();
    selection.addRange(range);
}

function insertLink() {
    const url = prompt('Entrez l\'URL du lien:');
    if (url) {
        document.execCommand('createLink', false, url);
    }
}

function toggleHtmlView() {
    const editor = document.getElementById('course-editor');
    const htmlView = document.getElementById('course-html');
    
    if (isHtmlView) {
        editor.innerHTML = htmlView.value;
        editor.style.display = 'block';
        htmlView.style.display = 'none';
    } else {
        htmlView.value = editor.innerHTML;
        editor.style.display = 'none';
        htmlView.style.display = 'block';
    }
    
    isHtmlView = !isHtmlView;
}

function saveCourses() {
    localStorage.setItem('courses', JSON.stringify(courses));
}

function loadCourses() {
    const saved = localStorage.getItem('courses');
    if (saved) {
        courses = JSON.parse(saved);
    }
}

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href === '#accueil') showPage('accueil');
            else if (href === '#cours') showPage('cours');
            else if (href === '#ajouter') {
                document.getElementById('form-title').textContent = 'Ajouter un nouveau cours';
                document.getElementById('course-form').reset();
                document.getElementById('course-id').value = '';
                showPage('ajouter');
            }
        });
    });
    
    // Gérer la recherche et le filtrage
    document.getElementById('course-search').addEventListener('input', renderCourses);
    document.getElementById('course-filter').addEventListener('change', renderCourses);
}

function initForm() {
    const form = document.getElementById('course-form');
    
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const courseId = document.getElementById('course-id').value;
        const courseData = {
            title: document.getElementById('course-title').value,
            subject: document.getElementById('course-subject').value,
            description: document.getElementById('course-description').value,
            content: isHtmlView ? document.getElementById('course-html').value : document.getElementById('course-editor').innerHTML
        };
        
        if (courseId) {
            // Modification
            const index = courses.findIndex(c => c.id === parseInt(courseId));
            if (index !== -1) {
                courses[index] = { ...courses[index], ...courseData };
            }
        } else {
            // Création
            const newCourse = {
                id: Date.now(),
                ...courseData
            };
            courses.push(newCourse);
        }
        
        saveCourses();
        alert(courseId ? 'Cours modifié avec succès!' : 'Cours ajouté avec succès!');
        
        form.reset();
        currentCourseId = null;
        showPage('cours');
    });
}

function backToCourses() {
    currentCourseId = null;
    showPage('cours');
}

document.addEventListener('DOMContentLoaded', () => {
    loadCourses();
    showPage('accueil');
    initNavigation();
    initForm();
});