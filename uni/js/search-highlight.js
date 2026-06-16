document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return;

    const searchTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (searchTerms.length === 0) return;

    const elements = document.querySelectorAll('.article-content p, .article-content li, .article-content h2, .article-content h3, .article-content h4, .article-content td');
    
    let firstMatch = null;

    elements.forEach(el => {
        let html = el.innerHTML;
        let textContent = el.textContent.toLowerCase();
        
        let hasMatch = false;
        searchTerms.forEach(term => {
            if (textContent.includes(term)) {
                hasMatch = true;
                // Lookahead per evitare di rimpiazzare testo all'interno di tag HTML (es. href="...")
                const regex = new RegExp(`(?![^<]*>)(${term})`, 'gi');
                html = html.replace(regex, '<mark class="search-highlight">$1</mark>');
            }
        });

        if (hasMatch) {
            el.innerHTML = html;
            if (!firstMatch) firstMatch = el;
        }
    });

    if (firstMatch) {
        setTimeout(() => {
            firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
    }
});
