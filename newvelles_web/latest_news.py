import json
import urllib.request


LATEST_NEWS_URI = 'https://public-newvelles-data.s3-us-west-1.amazonaws.com/latest_news.json'


def _escape_news(news_dict):
    """
    Assume the string that needs to be scaped is the title
    """
    scaped_dic = json.dumps(news_dict).replace('\'', '-')
    return json.loads(scaped_dic)


def get_latest_news():
    """
    Get latest news file from S3 bucket
    """
    with urllib.request.urlopen(LATEST_NEWS_URI) as f:
        news = json.loads(f.read().decode('utf-8'))
        return _escape_news(news)
