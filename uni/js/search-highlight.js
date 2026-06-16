document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q');
    if (!query) return;

    const searchTerms = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Inserisce il pulsante "Torna alla ricerca" di fianco al pulsante back
    const backBtn = document.querySelector('.back-home-btn');
    if (backBtn && searchTerms.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.style.gridColumn = '1';
        wrapper.style.gridRow = '1';
        wrapper.style.justifySelf = 'start';
        wrapper.style.display = 'flex';
        wrapper.style.gap = '0.5rem';
        wrapper.style.alignItems = 'center';

        backBtn.parentNode.insertBefore(wrapper, backBtn);
        wrapper.appendChild(backBtn);
        
        // Reset grid styles per il flex
        backBtn.style.gridColumn = 'unset';
        backBtn.style.gridRow = 'unset';

        const searchBackBtn = document.createElement('a');
        const baseUrl = window.location.protocol === 'file:' ? '../../index.html' : '../../';
        searchBackBtn.href = `${baseUrl}?search=${encodeURIComponent(query)}`;
        searchBackBtn.className = 'back-home-btn animate-fade-in';
        searchBackBtn.style.gridColumn = 'unset';
        searchBackBtn.style.gridRow = 'unset';
        searchBackBtn.style.color = '#fcd34d'; // yellow-300
        searchBackBtn.style.borderColor = 'rgba(252, 211, 77, 0.3)';
        searchBackBtn.title = "Torna ai risultati di ricerca";
        searchBackBtn.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <span style="font-size: 0.8rem; font-weight: 600;">Ricerca</span>
        `;
        wrapper.appendChild(searchBackBtn);
    }

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
