/**
 * Main entry point for the Newvelles web application
 */

import { fetchNews, fetchMetadata } from './api.js';
import { initializeStore, getAllGroupings } from './data/newsStore.js';
import { filterGroupings } from './data/searchFilter.js';
import { setState } from './state.js';
import { initApp, renderLoading } from './components/App.js';

/**
 * Initialize the application
 */
async function init() {
  try {
    const appContainer = document.getElementById('app');

    // Show skeleton loading state
    renderLoading(appContainer);

    // Fetch data in parallel
    const [newsData, metadata] = await Promise.all([
      fetchNews(),
      fetchMetadata()
    ]);

    // Initialize the news store
    initializeStore(newsData);

    // Get all groupings
    const groupings = getAllGroupings();

    // Initialize app state
    setState({
      groupings: groupings,
      filteredGroupings: groupings,
      metadata: metadata,
      view: 'home',
      searchQuery: ''
    });

    // Initialize and render the app
    initApp(appContainer);

  } catch (error) {
    console.error('Failed to initialize app:', error);
    const appContainer = document.getElementById('app');
    appContainer.innerHTML = `
      <div class="empty-state" role="alert">
        <h2 class="empty-state-title">Failed to load news</h2>
        <p class="empty-state-message">Please try refreshing the page</p>
      </div>
    `;
  }
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
