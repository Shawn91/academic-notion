import sys
from pathlib import Path

from flask import Flask, request, jsonify
from flask_cors import CORS

sys.path.append(str(Path(__file__).parent.resolve()))

from config import Config
from notion_api.api import search_by_title, ErrorResult


app = Flask(__name__)
CORS(app)


def create_response(success: bool, data, message="", code=0):
    return jsonify({"success": success, "message": message, "data": data, "code": code})


@app.route("/upload-to-notion", methods=["POST"])
def hello():
    return "Hello World!"


@app.route("/search-by-title", methods=["POST"])
def search_by_title_endpoint():
    query = request.json["query"]
    search_for = request.json["search_for"]
    result = search_by_title(query=query, search_for=search_for)
    return jsonify(success=result is not ErrorResult, data=result)


if __name__ == "__main__":
    app.run(debug=not Config.IS_PRODUCTION)
