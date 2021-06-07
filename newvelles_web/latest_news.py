import json
import re
import urllib.request


LATEST_NEWS_URI = 'https://public-newvelles-data.s3-us-west-1.amazonaws.com/latest_news.json'


def _escape_news(news_dict):
    """
    Assume the string that needs to be scaped is the title
    """
    dict_str = json.dumps(news_dict)
    print(f'INPUT DICT: {dict_str}')
    dict_str = dict_str.encode("ascii", "ignore").decode()
    print('*' * 20 + f'FIX 1: {dict_str}')
    dict_str = ''.join([c for c in dict_str if ord(c) < 128])
    print('*' * 20 + f'FIX 2: {dict_str}')
    dict_str = dict_str.replace('‘', '').replace('’', '')
    print('*' * 20 + f'FIX 3: {dict_str}')
    dict_str = dict_str.replace('\'', '-')
    print('*' * 20 + f'FIX 4: {dict_str}')
    dict_str = dict_str.replace(u'\u2019', '-')
    dict_str = dict_str.replace(u'\u2018', '-')
    # \u2018Troubling Ev---------nts\u2019
    # dict_str = dict_str.replace('e', '---------')
    print('*' * 20 + f'FIX 5: {dict_str}')
    sd = json.loads(dict_str)
    # print(f"SHOULD BE FIXED: {list(sd['trump biden gop senate infrastructure facebook house vaccines republicans records']['trump counsel troubling events interview'].keys())[1]}")
    return json.loads(dict_str)


def get_latest_news():
    """
    Get latest news file from S3 bucket
    """
    with urllib.request.urlopen(LATEST_NEWS_URI) as f:
        news = json.loads(f.read().decode('utf-8'))
        # print(json.dumps(_escape_news(news), indent=2))
        escaped_news = _escape_news(news)
        # print(escaped_news['trump biden gop senate infrastructure facebook house vaccines republicans records']['trump nc rally amidst social'])
        # print(False in [c for c in json.dumps(s) if ord(c) < 128])
        return escaped_news
