import json
import logging
from datetime import datetime

from flask import Flask, jsonify
from flask_cors import CORS

from newvelles_web.config import config
from newvelles_web.latest_news import get_latest_news
from newvelles_web.metadata import get_latest_news_metadata
from newvelles_web.stories import get_momentum, get_stories

logging.basicConfig(filename='record.log',
                    level=logging.DEBUG,
                    format=f'%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s')

# Configure Flask to serve static files from dist/ directory (Vite build output)
import os
static_folder = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'dist')
if not os.path.exists(static_folder):
    # Fallback for development - serve from project root
    static_folder = 'dist'

app = Flask(__name__, static_folder=static_folder, static_url_path='')
CORS(app, resources={r"/news": {"origins": "*"}, r"/metadata": {"origins": "*"},
                     r"/stories.json": {"origins": "*"}, r"/momentum.json": {"origins": "*"},
                     r"/health": {"origins": "*"}})

CONFIG = config()


@app.route("/news")
def news():
    """
    Return the latest version of the news json
    """
    # TODO: add options to request like request.args.get('from', default='')
    latest_news = get_latest_news(local=CONFIG['PARAMS']['local'] == 'True')
    return jsonify(latest_news)


@app.route("/stories.json")
def stories():
    """
    Return the redesign's stories.json (schema 0.3.0) from the public bucket
    """
    return jsonify(get_stories(local=CONFIG['PARAMS']['local'] == 'True'))


@app.route("/momentum.json")
def momentum():
    """
    Return the redesign's momentum.json (rolling 14-day series) from the public bucket
    """
    return jsonify(get_momentum(local=CONFIG['PARAMS']['local'] == 'True'))


@app.route("/metadata")
def metadata():
    """
    Return the latest news metadata as JSON
    """
    md_date_info, version = get_latest_news_metadata(
                                local=CONFIG['PARAMS']['local'] == 'True')
    # Extract just the datetime from the formatted string
    # Format: "newvelles.com <br> News fetched at {datetime}"
    import re
    datetime_match = re.search(r'News fetched at (.+)$', md_date_info)
    datetime_str = datetime_match.group(1) if datetime_match else md_date_info

    return jsonify({
        "datetime": datetime_str,
        "version": version
    })


@app.route("/health")
def health():
    """
    Health check endpoint for deployment verification

    Returns:
        200: Service is healthy, can fetch news data
        500: Service is unhealthy, cannot fetch news data
    """
    try:
        # Verify we can fetch news data (S3 connectivity check)
        latest_news = get_latest_news(local=CONFIG['PARAMS']['local'] == 'True')

        # Verify we can fetch metadata
        md_date_info, version = get_latest_news_metadata(
                                    local=CONFIG['PARAMS']['local'] == 'True')

        # Count news groupings
        news_groupings_count = len(latest_news) if isinstance(latest_news, list) else 0

        # Extract datetime from metadata
        import re
        datetime_match = re.search(r'News fetched at (.+)$', md_date_info)
        datetime_str = datetime_match.group(1) if datetime_match else md_date_info

        return jsonify({
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "news_groupings": news_groupings_count,
            "metadata_version": version,
            "metadata_datetime": datetime_str
        }), 200

    except Exception as e:
        logging.error(f"Health check failed: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "timestamp": datetime.utcnow().isoformat() + 'Z',
            "error": str(e)
        }), 500


@app.route("/")
def index():
    """
    Serve the Vite-built HTML shell - data is fetched via API
    """
    try:
        # In production (Docker), serve from dist/
        index_path = os.path.join(app.static_folder, 'index.html')
        if os.path.exists(index_path):
            return open(index_path).read()
        else:
            # Fallback for development
            return open("index.html").read()
    except FileNotFoundError:
        return "Frontend not built. Run 'npm run build' first.", 500


def main():
    app.run(host='0.0.0.0', port=5000, debug=True)
