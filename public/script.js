const courses = {
    'fonctionnement-entreprise': {
        title: 'Synthèse du fonctionnement de l\'entreprise',
        content: `
            <div class="course-detail-content">
                <h2>Synthèse du fonctionnement de l'entreprise</h2>
                
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
};

function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));
    
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
    }
}

function showCourse(courseId) {
    const course = courses[courseId];
    if (course) {
        document.getElementById('course-content').innerHTML = course.content;
        showPage('course-detail');
    }
}

function backToCourses() {
    showPage('cours');
}

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const href = link.getAttribute('href');
            if (href === '#accueil') showPage('accueil');
            else if (href === '#cours') showPage('cours');
            else if (href === '#ajouter') showPage('ajouter');
        });
    });
}

function initForm() {
    const form = document.getElementById('add-course-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const title = document.getElementById('course-title').value;
            const description = document.getElementById('course-description').value;
            const content = document.getElementById('course-content').value;
            
            alert(`Cours "${title}" ajouté avec succès!`);
            
            form.reset();
            showPage('cours');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    showPage('accueil');
    initNavigation();
    initForm();
});