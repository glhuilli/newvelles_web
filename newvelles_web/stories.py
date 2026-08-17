"""Fetch the redesign's data files (stories.json, momentum.json) from the
public S3 bucket — the same origin-proxy pattern as latest_news.py, so the
front end can fetch same-origin /stories.json and /momentum.json."""
import json
import urllib.request

STORIES_URI = 'https://public-newvelles-data-bucket.s3-us-west-2.amazonaws.com/stories.json'
MOMENTUM_URI = 'https://public-newvelles-data-bucket.s3-us-west-2.amazonaws.com/momentum.json'
LOCAL_STORIES = './data/local/stories.json'
LOCAL_MOMENTUM = './data/local/momentum.json'


def _fetch(uri: str):
    with urllib.request.urlopen(uri) as response:
        return json.loads(response.read().decode('utf-8'))


def _load_local(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def get_stories(local: bool = False):
    """The stories.json document (schema 0.3.0), verbatim — the front end
    validates the version itself."""
    return _load_local(LOCAL_STORIES) if local else _fetch(STORIES_URI)


def get_momentum(local: bool = False):
    """The momentum.json rolling 14-day rollup, verbatim."""
    return _load_local(LOCAL_MOMENTUM) if local else _fetch(MOMENTUM_URI)
