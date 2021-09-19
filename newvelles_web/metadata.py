import collections
import json
import re
from typing import Optional
import urllib.request


LATEST_NEWS_URI = 'https://public-newvelles-data-bucket.s3-us-west-2.amazonaws.com/latest_news_metadata.json'
LOCAL_NEWS = './data/latest_news_metadata.json'


def get_latest_news_metadata(local: Optional[bool] = False):
    """
    Get latest news metadata file from S3 bucket
    """
    if local:
        with open(LOCAL_NEWS, 'rb') as f:
            news = json.loads(f.read().decode('utf-8'))
    else:
        with urllib.request.urlopen(LATEST_NEWS_URI) as f:
            news = json.loads(f.read().decode('utf-8'))
    text_string = f"News fetched {news['datetime']}"
    version = news['version']
    return text_string, version
