import sys
import json
from sentence_transformers import SentenceTransformer

try:
    # Load the model. This will download it on the first run (can take a few minutes and ~500MB).
    SentenceTransformer('all-MiniLM-L6-v2')
    # If successful, print a JSON success message to standard output
    print(json.dumps({"status": "OK", "model": "Loaded"}))
    sys.stdout.flush()
except Exception as e:
    # If it fails, print a JSON error message
    print(json.dumps({"status": "Error", "message": str(e)}))
    sys.stdout.flush()