import json
import logging

from flask import Flask

from newvelles_web.config import config
from newvelles_web.latest_news import get_latest_news

logging.basicConfig(filename='record.log',
                    level=logging.DEBUG,
                    format=f'%(asctime)s %(levelname)s %(name)s %(threadName)s : %(message)s')
app = Flask(__name__)

CONFIG = config()


@app.route("/news")
def news():
    """
    Return the latest version of the news json
    """
    # TODO: add options to request like request.args.get('from', default='')
    latest_news = get_latest_news(local=CONFIG['PARAMS']['local'] == 'True')
    response = app.response_class(response=latest_news, status=200)
    return response


@app.route("/")
def index():
    ret = open("index.html").read()
    latest_news = get_latest_news(local=CONFIG['PARAMS']['local'] == 'True')
    return ret.replace('news_json', json.dumps(latest_news))


def main():
    app.run(host='0.0.0.0', port=5000, debug=True)
