import sys
import json
from sentence_transformers import SentenceTransformer

# Load the model once when the script starts
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embeddings_for_chunks(chunks):
    # NEW: Add a safeguard to ensure all items are strings
    cleaned_chunks = [str(chunk) for chunk in chunks if chunk and isinstance(chunk, str)]
    
    # If after cleaning, there's nothing left, return an empty list
    if not cleaned_chunks:
        return []

    # The model can process a list of sentences/chunks at once, which is very efficient
    embeddings = model.encode(cleaned_chunks)
    # Convert numpy arrays to lists for JSON serialization
    return [embedding.tolist() for embedding in embeddings]

if __name__ == "__main__":
    # Read the JSON string of chunks from standard input
    input_data = sys.stdin.read()
    chunks = json.loads(input_data)
    
    # Get embeddings
    embeddings = get_embeddings_for_chunks(chunks)
    
    # Print the resulting list of embeddings as a JSON string to standard output
    print(json.dumps(embeddings))
    sys.stdout.flush()