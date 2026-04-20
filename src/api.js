/**
 * API module for fetching news data and metadata from the Flask backend
 */

/**
 * Fetch the latest news JSON from the /news endpoint
 * @returns {Promise<Object>} The news data object
 */
export async function fetchNews() {
  try {
    const response = await fetch('/news');
    if (!response.ok) {
      throw new Error(`Failed to fetch news: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching news:', error);
    throw error;
  }
}

/**
 * Fetch the metadata from the /metadata endpoint
 * @returns {Promise<Object>} The metadata object with datetime and version
 */
export async function fetchMetadata() {
  try {
    const response = await fetch('/metadata');
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    throw error;
  }
}
