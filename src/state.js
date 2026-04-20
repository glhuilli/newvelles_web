/**
 * Simple state management and routing for Newvelles
 */

// Application state
let state = {
  view: 'home', // 'home' | 'sub-groupings' | 'articles'
  groupings: [],
  filteredGroupings: [],
  currentGroupingId: null,
  currentSubGroupingId: null,
  expandedSubGroupingId: null, // Track which sub-grouping is expanded
  searchQuery: '',
  metadata: null
};

// Listeners for state changes
const listeners = [];

/**
 * Get current state
 */
export function getState() {
  return { ...state };
}

/**
 * Update state and notify listeners
 */
export function setState(updates) {
  state = { ...state, ...updates };
  notifyListeners();
}

/**
 * Subscribe to state changes
 */
export function subscribe(listener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
}

/**
 * Notify all listeners of state change
 */
function notifyListeners() {
  listeners.forEach(listener => listener(state));
}

/**
 * Navigate to home view
 */
export function navigateToHome() {
  setState({
    view: 'home',
    currentGroupingId: null,
    currentSubGroupingId: null,
    expandedSubGroupingId: null
  });
}

/**
 * Navigate to sub-groupings view
 */
export function navigateToSubGroupings(groupingId) {
  setState({
    view: 'sub-groupings',
    currentGroupingId: groupingId,
    currentSubGroupingId: null,
    expandedSubGroupingId: null
  });
}

/**
 * Navigate to articles view
 */
export function navigateToArticles(groupingId, subGroupingId) {
  setState({
    view: 'articles',
    currentGroupingId: groupingId,
    currentSubGroupingId: subGroupingId
  });
}

/**
 * Toggle expanded sub-grouping
 */
export function toggleSubGroupingExpansion(subGroupingId) {
  const currentExpanded = state.expandedSubGroupingId;
  setState({
    expandedSubGroupingId: currentExpanded === subGroupingId ? null : subGroupingId
  });
}
