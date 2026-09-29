"""Fetch the Analysis tab's data files from the public S3 bucket — the same
origin-proxy pattern as stories.py — so the front end can fetch same-origin
/analysis/index.json and /analysis/entries/<id>/payload.json.

Entry ids are validated before any path or URL is built."""
import json
import re
import urllib.request

BASE_URI = 'https://public-newvelles-data-bucket.s3-us-west-2.amazonaws.com/analysis'
LOCAL_BASE = './data/local/analysis'
ENTRY_ID = re.compile(r'^[a-z0-9-]{1,64}$')


def is_valid_entry_id(entry_id) -> bool:
    return isinstance(entry_id, str) and ENTRY_ID.match(entry_id) is not None


def _fetch(uri: str):
    with urllib.request.urlopen(uri) as response:
        return json.loads(response.read().decode('utf-8'))


def _load_local(path: str):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def get_index(local: bool = False):
    """The analysis index (schema 0.1.0), verbatim."""
    return _load_local(f'{LOCAL_BASE}/index.json') if local else _fetch(f'{BASE_URI}/index.json')


def get_entry_payload(entry_id: str, local: bool = False):
    """One entry's payload, verbatim. ValueError for an id outside ^[a-z0-9-]{1,64}$."""
    if not is_valid_entry_id(entry_id):
        raise ValueError(f'invalid entry id: {entry_id!r}')
    rel = f'entries/{entry_id}/payload.json'
    return _load_local(f'{LOCAL_BASE}/{rel}') if local else _fetch(f'{BASE_URI}/{rel}')
