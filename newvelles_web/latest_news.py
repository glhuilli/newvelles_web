import json

from newvelles_web import LATEST_NEWS


def _escape_news(news_dict):
    """
    Assume the string that needs to be scaped is the title
    """
    scaped_dic = json.dumps(news_dict).replace('\'', '-')
    return json.loads(scaped_dic)


def get_latest_news():
    """
    TODO: Get latest news file from S3 bucket
    e.g., https://public-newvelles-data.s3-us-west-1.amazonaws.com/latest_news.json
    """
    return _escape_news(LATEST_NEWS)
