/**
 * Main App component - orchestrates the entire UI
 */

import { getState, subscribe, navigateToHome, navigateToSubGroupings, navigateToArticles, toggleSubGroupingExpansion } from '../state.js';
import { filterGroupings, filterSubGroupings, getMatchStats, getMatchingArticles } from '../data/searchFilter.js';
import { getGrouping, getSubGrouping, getGroupingArticleCount } from '../data/newsStore.js';
import { rankSubGroupings } from '../data/rankGroupings.js';

/**
 * Utility: Extract publisher domain from article link
 */
function getPublisherDomain(url) {
  try {
    const domain = new URL(url).hostname;
    return domain.replace('www.', '');
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Utility: Format timestamp as relative time
 */
function formatRelativeTime(timestamp) {
  const now = new Date();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
}

/**
 * Highlight matching text in a string
 */
function highlightText(text, query) {
  if (!query || query.trim() === '') {
    return text;
  }

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(regex, '<span class="highlight">$1</span>');
}

/**
 * Calculate tag frequency in sub-groupings
 * Returns a map of tag -> frequency count
 */
function calculateTagFrequency(grouping) {
  const frequencyMap = {};

  if (!grouping.subGroupings) {
    return frequencyMap;
  }

  // Count how many times each tag appears in sub-groupings
  grouping.subGroupings.forEach(subGrouping => {
    if (subGrouping.tags) {
      subGrouping.tags.forEach(tag => {
        frequencyMap[tag] = (frequencyMap[tag] || 0) + 1;
      });
    }
  });

  return frequencyMap;
}

/**
 * Get intensity class based on frequency
 * Returns a CSS class for color intensity
 */
function getTagIntensityClass(frequency, maxFrequency) {
  if (maxFrequency === 0) return 'tag-intensity-low';

  const ratio = frequency / maxFrequency;

  if (ratio >= 0.7) return 'tag-intensity-high';
  if (ratio >= 0.4) return 'tag-intensity-medium';
  return 'tag-intensity-low';
}

/**
 * Render tag bubbles
 */
function renderTags(tags, large = false, searchQuery = '', frequencyMap = null) {
  if (!tags || tags.length === 0) {
    return '<span class="tag tag-empty">Uncategorized</span>';
  }

  return tags
    .map(tag => {
      const highlightedTag = highlightText(tag, searchQuery);
      const intensityClass = frequencyMap ? getTagIntensityClass(frequencyMap[tag] || 0, Math.max(...Object.values(frequencyMap))) : '';
      return `<span class="tag ${large ? 'tag-large' : ''} ${intensityClass}">${highlightedTag}</span>`;
    })
    .join('');
}

/**
 * Render Masthead
 */
function renderMasthead(metadata) {
  const metadataHtml = metadata
    ? `<div class="masthead-metadata" aria-label="Site information">
         <div>newvelles.com</div>
         <div>News fetched at <time datetime="${new Date().toISOString()}">${metadata.datetime}</time></div>
       </div>`
    : '';

  return `
    <header class="masthead" role="banner">
      <div class="masthead-content">
        <h1 class="masthead-title" role="button" tabindex="0" aria-label="Go to home page">newvelles</h1>
        ${metadataHtml}
      </div>
    </header>
  `;
}

/**
 * Render Search Bar
 */
function renderSearchBar(searchQuery, view, filteredCount) {
  const itemType = view === 'sub-groupings' ? 'sub-group' : 'grouping';
  const statsText = `Showing ${filteredCount} ${itemType}${filteredCount !== 1 ? 's' : ''}`;

  const clearButton = searchQuery
    ? '<button class="search-clear" id="search-clear" aria-label="Clear search">×</button>'
    : '';

  return `
    <div class="search-container" role="search">
      <div class="search-bar">
        <div class="search-input-wrapper">
          <input
            type="text"
            class="search-input"
            id="search-input"
            placeholder="Search by tag, topic, or article title..."
            value="${searchQuery}"
            aria-label="Search news groupings"
            aria-describedby="search-stats"
          />
          ${clearButton}
        </div>
        <div class="search-stats" id="search-stats" role="status" aria-live="polite">${statsText}</div>
      </div>
    </div>
  `;
}

/**
 * Render Breadcrumb
 */
function renderBreadcrumb(view, currentGroupingId, currentSubGroupingId) {
  if (view === 'home') {
    return '';
  }

  const parts = ['<span class="breadcrumb-link" data-nav="home" tabindex="0" role="button" aria-label="Navigate to home">Home</span>'];

  if (currentGroupingId) {
    const grouping = getGrouping(currentGroupingId);
    if (grouping) {
      if (view === 'sub-groupings') {
        parts.push(`<span class="breadcrumb-current" aria-current="page">${renderTags(grouping.tags)}</span>`);
      } else {
        parts.push(`<span class="breadcrumb-link" data-nav="grouping" data-id="${grouping.id}" tabindex="0" role="button" aria-label="Navigate back to ${grouping.tags.join(', ')}">${renderTags(grouping.tags)}</span>`);
      }
    }
  }

  if (currentSubGroupingId && view === 'articles') {
    const subGrouping = getSubGrouping(currentSubGroupingId);
    if (subGrouping) {
      parts.push(`<span class="breadcrumb-current" aria-current="page">${renderTags(subGrouping.tags)}</span>`);
    }
  }

  return `
    <nav class="breadcrumb-container" aria-label="Breadcrumb">
      <div class="breadcrumb">
        ${parts.join('<span class="breadcrumb-separator" aria-hidden="true">›</span>')}
      </div>
    </nav>
  `;
}

/**
 * Render Grouping Card
 */
function renderGroupingCard(grouping, searchQuery = '', rank = null) {
  const articleCount = getGroupingArticleCount(grouping.id);
  const subGroupingCount = grouping.subGroupings ? grouping.subGroupings.length : 0;

  // Calculate tag frequencies in sub-groupings
  const frequencyMap = calculateTagFrequency(grouping);

  // Sort tags by frequency (descending)
  const sortedTags = [...grouping.tags].sort((a, b) => {
    const freqA = frequencyMap[a] || 0;
    const freqB = frequencyMap[b] || 0;
    return freqB - freqA; // Descending order
  });

  // Get matching articles if there's a search query
  const matchingArticles = getMatchingArticles(grouping, searchQuery);
  const showMatchingArticles = matchingArticles.length > 0;

  // Limit to 3 matching articles for preview
  const articlesToShow = matchingArticles.slice(0, 3);
  const remainingCount = matchingArticles.length - articlesToShow.length;

  const matchingArticlesHtml = showMatchingArticles ? `
    <div class="matching-articles">
      <div class="matching-articles-label">Matching articles:</div>
      <ul class="matching-articles-list">
        ${articlesToShow.map(article => `
          <li class="matching-article-item">${highlightText(article.title, searchQuery)}</li>
        `).join('')}
        ${remainingCount > 0 ? `<li class="matching-article-more">+${remainingCount} more</li>` : ''}
      </ul>
    </div>
  ` : '';

  return `
    <div class="grouping-card" data-grouping-id="${grouping.id}" tabindex="0" role="button" aria-label="View ${grouping.tags.join(', ')} grouping with ${articleCount} articles">
      <div class="grouping-card-header">
        <div class="grouping-card-tags">
          ${renderTags(sortedTags, false, searchQuery, frequencyMap)}
        </div>
        <div class="grouping-card-meta">
          ${rank !== null ? `<div class="rank-badge">#${rank}</div>` : ''}
          <div class="sub-grouping-count">${subGroupingCount} sub-group${subGroupingCount !== 1 ? 's' : ''}</div>
          <div class="article-count">${articleCount} article${articleCount !== 1 ? 's' : ''}</div>
        </div>
      </div>
      ${matchingArticlesHtml}
    </div>
  `;
}

/**
 * Render Skeleton Loading Cards
 */
function renderSkeletonCards(count = 6) {
  const skeletons = Array.from({ length: count }, (_, i) => `
    <div class="skeleton-card">
      <div class="skeleton-line" style="width: 80%;"></div>
      <div class="skeleton-line" style="width: 60%;"></div>
      <div class="skeleton-line"></div>
    </div>
  `).join('');

  return `<div class="grid grid-2">${skeletons}</div>`;
}

/**
 * Render Home View (Grouping Cards)
 */
function renderHomeView(filteredGroupings, searchQuery = '') {
  if (filteredGroupings.length === 0) {
    return `
      <div class="empty-state" role="status">
        <h2 class="empty-state-title">No groupings found</h2>
        <p class="empty-state-message">Try a different search query</p>
      </div>
    `;
  }

  const cards = filteredGroupings
    .map((grouping, index) => renderGroupingCard(grouping, searchQuery, index + 1))
    .join('');

  return `
    <div class="grouping-list" role="list">
      ${cards}
    </div>
  `;
}

/**
 * Get matching articles from a sub-grouping's articles
 * @param {Array} articles - Array of article objects
 * @param {string} query - Search query
 * @returns {Array} - Array of matching article objects
 */
function getMatchingArticlesFromList(articles, query) {
  if (!query || query.trim() === '') {
    return [];
  }

  const trimmedQuery = query.trim().toLowerCase();
  return articles.filter(article =>
    article.title && article.title.toLowerCase().includes(trimmedQuery)
  );
}

/**
 * Render Sub-Groupings View
 */
function renderSubGroupingsView(groupingId, searchQuery = '') {
  const grouping = getGrouping(groupingId);
  if (!grouping) {
    return '<div class="empty-state" role="status"><p>Grouping not found</p></div>';
  }

  // Get current state to check which sub-grouping is expanded
  const state = getState();
  const expandedSubGroupingId = state.expandedSubGroupingId;

  // Sort sub-groupings by article count (descending)
  const sortedSubGroupings = rankSubGroupings(grouping.subGroupings);

  // Filter sub-groupings based on search query
  const filteredSubGroupings = filterSubGroupings(sortedSubGroupings, searchQuery);

  // Check if there are any results
  if (filteredSubGroupings.length === 0) {
    return `
      <div class="empty-state" role="status">
        <h2 class="empty-state-title">No sub-groupings found</h2>
        <p class="empty-state-message">Try a different search query</p>
      </div>
    `;
  }

  const subGroupingCards = filteredSubGroupings
    .map(subGrouping => {
      const articleCount = subGrouping.articles.length;
      const isExpanded = expandedSubGroupingId === subGrouping.id;

      // Check if we should show matching articles (when searching but not expanded)
      const matchingArticles = getMatchingArticlesFromList(subGrouping.articles, searchQuery);
      const hasQuery = searchQuery && searchQuery.trim() !== '';
      const showMatchingArticles = hasQuery && matchingArticles.length > 0 && !isExpanded;

      // Show up to 3 matching articles
      const maxDisplay = 3;
      const articlesToShow = matchingArticles.slice(0, maxDisplay);
      const remainingCount = matchingArticles.length - maxDisplay;

      const matchingArticlesHtml = showMatchingArticles ? `
        <div class="matching-articles">
          <div class="matching-articles-label">Matching articles:</div>
          <ul class="matching-articles-list">
            ${articlesToShow.map(article => `
              <li class="matching-article-item">${highlightText(article.title, searchQuery)}</li>
            `).join('')}
            ${remainingCount > 0 ? `<li class="matching-article-more">+${remainingCount} more</li>` : ''}
          </ul>
        </div>
      ` : '';

      // Render full article list when expanded
      const expandedArticlesHtml = isExpanded ? `
        <div class="expanded-articles">
          <ul class="article-list-inline">
            ${subGrouping.articles.map(article => {
              const publisher = getPublisherDomain(article.link);
              const relativeTime = formatRelativeTime(article.timestamp);

              return `
                <li class="article-item-inline">
                  <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="article-title-link" aria-label="${article.title} from ${publisher}">
                    ${article.title}
                  </a>
                  <div class="article-meta-inline">
                    <span class="tag tag-source">${publisher}</span>
                    <span class="article-timestamp"><time datetime="${article.timestamp.toISOString()}">${relativeTime}</time></span>
                  </div>
                </li>
              `;
            }).join('')}
          </ul>
        </div>
      ` : '';

      return `
        <div class="grouping-card ${isExpanded ? 'expanded' : ''}" data-sub-grouping-id="${subGrouping.id}" tabindex="0" role="button" aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${subGrouping.tags.join(', ')} with ${articleCount} articles" aria-expanded="${isExpanded}">
          <div class="grouping-card-header">
            <div class="grouping-card-tags">
              ${renderTags(subGrouping.tags, false, searchQuery)}
            </div>
            <div class="grouping-card-meta">
              <div class="article-count">${articleCount} article${articleCount !== 1 ? 's' : ''}</div>
              <div class="expand-indicator">${isExpanded ? '▲' : '▼'}</div>
            </div>
          </div>
          ${matchingArticlesHtml}
          ${expandedArticlesHtml}
        </div>
      `;
    })
    .join('');

  return `
    <section class="content-section">
      <div class="grid grid-2" role="list">${subGroupingCards}</div>
    </section>
  `;
}

/**
 * Render Articles View
 */
function renderArticlesView(subGroupingId) {
  const subGrouping = getSubGrouping(subGroupingId);
  if (!subGrouping) {
    return '<div class="empty-state" role="status"><p>Sub-grouping not found</p></div>';
  }

  const articles = subGrouping.articles
    .map(article => {
      const publisher = getPublisherDomain(article.link);
      const relativeTime = formatRelativeTime(article.timestamp);

      return `
        <li class="article-item">
          <article>
            <h3 class="article-title">
              <a href="${article.link}" target="_blank" rel="noopener noreferrer" class="article-title-link" aria-label="${article.title} from ${publisher}">
                ${article.title}
              </a>
            </h3>
            <div class="article-meta">
              <span class="article-publisher">${publisher}</span>
              <span class="article-timestamp"><time datetime="${article.timestamp.toISOString()}">${relativeTime}</time></span>
            </div>
          </article>
        </li>
      `;
    })
    .join('');

  return `
    <section class="content-section">
      <ul class="article-list" role="list">${articles}</ul>
    </section>
  `;
}

/**
 * Render Footer
 */
function renderFooter() {
  return `
    <footer class="footer" role="contentinfo">
      <div class="footer-content">
        <div>© 2026
          <a href="https://glhuilli.github.io/" target="_blank" rel="noopener noreferrer" class="footer-link">@glhuilli</a>
        </div>
        <div class="footer-links">
          <a href="https://glhuilli.github.io/newvelles.html" target="_blank" rel="noopener noreferrer" class="footer-link">
            About this project
          </a>
        </div>
      </div>
    </footer>
  `;
}

/**
 * Get filtered count for current view
 */
function getFilteredCount(state) {
  const { view, filteredGroupings, currentGroupingId, searchQuery } = state;

  switch (view) {
    case 'sub-groupings': {
      const grouping = getGrouping(currentGroupingId);
      if (!grouping) return 0;
      const sortedSubGroupings = rankSubGroupings(grouping.subGroupings);
      const filtered = filterSubGroupings(sortedSubGroupings, searchQuery);
      return filtered.length;
    }
    case 'articles':
      return 0; // Articles view doesn't show count
    case 'home':
    default:
      return filteredGroupings.length;
  }
}

/**
 * Render main content based on current view
 */
function renderContent(state) {
  const { view, filteredGroupings, currentGroupingId, currentSubGroupingId, searchQuery } = state;

  switch (view) {
    case 'sub-groupings':
      return renderSubGroupingsView(currentGroupingId, searchQuery);
    case 'articles':
      return renderArticlesView(currentSubGroupingId);
    case 'home':
    default:
      return renderHomeView(filteredGroupings, searchQuery);
  }
}

/**
 * Render the entire app
 */
export function render(container) {
  const state = getState();
  const { metadata, groupings, searchQuery, filteredGroupings, view, currentGroupingId, currentSubGroupingId } = state;

  // Preserve search input focus and cursor position
  const searchInput = document.getElementById('search-input');
  const wasSearchFocused = searchInput && document.activeElement === searchInput;
  const cursorPosition = searchInput ? searchInput.selectionStart : null;

  // Get filtered count for current view
  const filteredCount = getFilteredCount(state);

  const html = `
    ${renderMasthead(metadata)}
    ${renderSearchBar(searchQuery, view, filteredCount)}
    ${renderBreadcrumb(view, currentGroupingId, currentSubGroupingId)}
    <main class="main-content" role="main">
      <div class="content-wrapper">
        ${renderContent(state)}
      </div>
    </main>
    ${renderFooter()}
  `;

  container.innerHTML = html;
  attachEventListeners();

  // Restore search input focus and cursor position
  if (wasSearchFocused) {
    const newSearchInput = document.getElementById('search-input');
    if (newSearchInput) {
      newSearchInput.focus();
      if (cursorPosition !== null) {
        newSearchInput.setSelectionRange(cursorPosition, cursorPosition);
      }
    }
  }
}

// State for keyboard navigation
let selectedCardIndex = -1;

/**
 * Attach event listeners after render
 */
function attachEventListeners() {
  // Search input
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleSearch(e.target.value);
      }, 150);
    });
  }

  // Search clear button
  const clearButton = document.getElementById('search-clear');
  if (clearButton) {
    clearButton.addEventListener('click', () => {
      handleSearch('');
      searchInput.focus();
    });
  }

  // Masthead title - click to go home
  const mastheadTitle = document.querySelector('.masthead-title');
  if (mastheadTitle) {
    mastheadTitle.addEventListener('click', () => {
      navigateToHome();
    });

    mastheadTitle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        navigateToHome();
      }
    });
  }

  // Grouping cards - click and keyboard
  const groupingCards = document.querySelectorAll('[data-grouping-id]');
  groupingCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const groupingId = card.getAttribute('data-grouping-id');
      navigateToSubGroupings(groupingId);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const groupingId = card.getAttribute('data-grouping-id');
        navigateToSubGroupings(groupingId);
      }
    });
  });

  // Sub-grouping cards - click and keyboard (toggle expansion)
  const subGroupingCards = document.querySelectorAll('[data-sub-grouping-id]');
  subGroupingCards.forEach((card, index) => {
    card.addEventListener('click', () => {
      const subGroupingId = card.getAttribute('data-sub-grouping-id');
      toggleSubGroupingExpansion(subGroupingId);
    });

    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const subGroupingId = card.getAttribute('data-sub-grouping-id');
        toggleSubGroupingExpansion(subGroupingId);
      }
    });
  });

  // Breadcrumb links - click and keyboard
  document.querySelectorAll('[data-nav]').forEach(link => {
    link.addEventListener('click', () => {
      const nav = link.getAttribute('data-nav');
      if (nav === 'home') {
        navigateToHome();
      } else if (nav === 'grouping') {
        const groupingId = link.getAttribute('data-id');
        navigateToSubGroupings(groupingId);
      }
    });

    link.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const nav = link.getAttribute('data-nav');
        if (nav === 'home') {
          navigateToHome();
        } else if (nav === 'grouping') {
          const groupingId = link.getAttribute('data-id');
          navigateToSubGroupings(groupingId);
        }
      }
    });
  });

  // Keyboard navigation for cards (arrow keys)
  document.addEventListener('keydown', handleKeyboardNavigation);
}

/**
 * Handle keyboard navigation with arrow keys
 */
function handleKeyboardNavigation(e) {
  const state = getState();
  const cards = state.view === 'home'
    ? document.querySelectorAll('[data-grouping-id]')
    : document.querySelectorAll('[data-sub-grouping-id]');

  if (cards.length === 0) return;

  // Only handle arrow keys when not in an input
  if (e.target.tagName === 'INPUT') return;

  let handled = false;

  switch (e.key) {
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      selectedCardIndex = Math.min(selectedCardIndex + 1, cards.length - 1);
      handled = true;
      break;

    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      selectedCardIndex = Math.max(selectedCardIndex - 1, 0);
      handled = true;
      break;

    case 'Enter':
      if (selectedCardIndex >= 0 && selectedCardIndex < cards.length) {
        e.preventDefault();
        cards[selectedCardIndex].click();
        handled = true;
      }
      break;

    case 'Home':
      e.preventDefault();
      selectedCardIndex = 0;
      handled = true;
      break;

    case 'End':
      e.preventDefault();
      selectedCardIndex = cards.length - 1;
      handled = true;
      break;
  }

  if (handled && selectedCardIndex >= 0) {
    // Remove previous selection
    cards.forEach(card => card.classList.remove('keyboard-selected'));

    // Add selection to current card
    const selectedCard = cards[selectedCardIndex];
    selectedCard.classList.add('keyboard-selected');
    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    selectedCard.focus();
  }
}

/**
 * Handle search input
 */
function handleSearch(query) {
  const state = getState();
  const filtered = filterGroupings(state.groupings, query);

  import('../state.js').then(({ setState }) => {
    setState({
      searchQuery: query,
      filteredGroupings: filtered
    });
  });
}

/**
 * Render skeleton loading state
 */
export function renderLoading(container) {
  const html = `
    <header class="masthead" role="banner">
      <div class="masthead-content">
        <h1 class="masthead-title" role="button" tabindex="0" aria-label="Go to home page">newvelles</h1>
      </div>
    </header>
    <main class="main-content" role="main">
      <div class="content-wrapper">
        ${renderSkeletonCards(6)}
      </div>
    </main>
  `;

  container.innerHTML = html;
}

/**
 * Initialize the app
 */
export function initApp(container) {
  // Subscribe to state changes
  subscribe(() => {
    render(container);
  });

  // Initial render
  render(container);
}
