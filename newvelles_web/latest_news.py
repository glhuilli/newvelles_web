import collections
import json
import re
from typing import Optional
import urllib.request


LATEST_NEWS_URI = 'https://public-newvelles-data-bucket.s3-us-west-2.amazonaws.com/latest_news.json'
LOCAL_NEWS = './data/latest_news.json'


def _clean_string(s):
    """
    Removing special characters that might not be able to render HTML
    """
    return s.replace('"', '').replace('\'', '-')


def map_nested_dicts(ob, func):
    """
    Process recursively all elements in the dictionary using the input function
    """
    if isinstance(ob, collections.Mapping):
        return {_clean_string(k): map_nested_dicts(v, func) for k, v in ob.items()}
    else:
        return func(ob)


def _escape_news(news_dict):
    """
    Assume the string that needs to be scaped is the title
    """
    scaped_dic = json.dumps(news_dict)
    return map_nested_dicts(json.loads(scaped_dic), lambda x: _clean_string(x))


def get_latest_news(local: Optional[bool] = False):
    """
    Get latest news file from S3 bucket
    """
    if local:
        with open(LOCAL_NEWS, 'rb') as f:
            news = json.loads(f.read().decode('utf-8'))
            return _escape_news(news)
    else:
        with urllib.request.urlopen(LATEST_NEWS_URI) as f:
            news = json.loads(f.read().decode('utf-8'))
            return _escape_news(news)
