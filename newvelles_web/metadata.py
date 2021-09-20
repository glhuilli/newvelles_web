import collections
from dateutil import parser
import json
from pytz import timezone
import re
from typing import Optional
import urllib.request


LATEST_NEWS_URI = 'https://public-newvelles-data-bucket.s3-us-west-2.amazonaws.com/latest_news_metadata.json'
LOCAL_NEWS = './data/latest_news_metadata.json'


def _gmt_to_pdt(time_string):
    """
    Transform from GMT to PDT
    """
    pdt_tz = timezone('America/Los_Angeles')
    gmt_tz = timezone('Etc/GMT')
    local_time = gmt_tz.localize(parser.parse(time_string))
    pdt_time = local_time.astimezone(pdt_tz)
    return pdt_time.isoformat()


def get_latest_news_metadata(local: Optional[bool] = False):
    """
    Get latest news metadata file from S3 bucket
    """
    if local:
        with open(LOCAL_NEWS, 'rb') as f:
            news = json.loads(f.read().decode('utf-8'))
            # {"datetime": "2021-09-19T17:24:54", "version": "0.2.1"}
    else:
        with urllib.request.urlopen(LATEST_NEWS_URI) as f:
            news = json.loads(f.read().decode('utf-8'))
    metadata_time = _gmt_to_pdt(news['datetime'])
    text_string = f"News fetched {metadata_time}"
    version = news['version']
    return text_string, version
