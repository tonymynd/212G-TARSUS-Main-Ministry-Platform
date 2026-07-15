import os
import re
import json
import math
from collections import Counter

# Resolve paths relative to project root
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..', '..'))

parsed_pages = os.path.join(project_root, "data", "pages")
dest_index_file = os.path.join(project_root, "src", "data", "search_index.json")

STOPWORDS = {
    "the", "and", "of", "to", "in", "is", "that", "it", "he", "was", "for", "on", "are", "as", "with",
    "his", "they", "i", "at", "be", "this", "have", "from", "or", "one", "had", "by", "word", "but",
    "not", "what", "all", "were", "we", "when", "your", "can", "said", "there", "use", "an", "each",
    "which", "she", "do", "how", "their", "if", "will", "up", "other", "about", "out", "many", "then",
    "them", "these", "so", "some", "her", "would", "make", "like", "him", "into", "has", "look", "more",
    "write", "go", "see", "number", "no", "way", "could", "people", "my", "than", "first", "been", "call",
    "who", "its", "now", "find", "long", "down", "day", "did", "get", "come", "made", "may", "part"
}

def clean_text(text):
    text = text.lower()
    text = re.sub(r'[^a-zA-Z0-9\s←→&]', ' ', text)
    return text

def get_tokens(text):
    text = clean_text(text)
    words = text.split()
    return [w for w in words if w not in STOPWORDS and len(w) > 1]

documents = []

def index_dir(directory, doc_type, recursive=True):
    print(f"Indexing directory: {directory} (recursive={recursive})")
    if not os.path.exists(directory):
        print(f"Directory not found: {directory}")
        return
        
    count = 0
    if recursive:
        generator = os.walk(directory)
    else:
        files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
        generator = [(directory, [], files)]

    for root, dirs, files in generator:
        # If walking recursively, avoid walking into subdirectories we index separately
        if recursive:
            if "Daniel-Miles-Posts-Archive" in dirs:
                dirs.remove("Daniel-Miles-Posts-Archive")
            if "Dan Emails" in dirs:
                dirs.remove("Dan Emails")
                
        for file in files:
            if not file.endswith(".md") or file.startswith("~$"):
                continue
                
            file_path = os.path.join(root, file)
            try:
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    
                # Extract title from frontmatter or filename
                title = os.path.splitext(file)[0].replace("_", " ").replace("-", " ").title()
                doc_type = "study"
                fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
                if fm_match:
                    fm_text = fm_match.group(1)
                    title_match = re.search(r"^title:\s*[\"']?([^\"'\n]+)[\"']?", fm_text, re.IGNORECASE | re.MULTILINE)
                    if title_match:
                        title = title_match.group(1).strip()
                    type_match = re.search(r"^type:\s*[\"']?([^\"'\n]+)[\"']?", fm_text, re.IGNORECASE | re.MULTILINE)
                    if type_match:
                        doc_type = type_match.group(1).strip()
                    body = content[fm_match.end():]
                else:
                    body = content
                    
                tokens = get_tokens(body + " " + title)
                term_freq = dict(Counter(tokens))
                
                documents.append({
                    "title": title,
                    "path": file_path,
                    "type": doc_type,
                    "tf": term_freq,
                    "length": len(tokens)
                })
                count += 1
            except Exception as e:
                print(f"Error indexing {file_path}: {e}")
    print(f"Indexed {count} documents from {directory}")

if __name__ == "__main__":
    index_dir(parsed_pages, "study")
    
    # Calculate IDF for search engine
    N = len(documents)
    df = {}
    for doc in documents:
        for term in doc["tf"]:
            df[term] = df.get(term, 0) + 1
            
    idf = {}
    for term, count in df.items():
        idf[term] = math.log(1 + (N - count + 0.5) / (count + 0.5))
        
    index_data = {
        "documents": documents,
        "idf": idf,
        "total_docs": N
    }
    
    # Save the search index
    with open(dest_index_file, "w", encoding="utf-8") as out:
        json.dump(index_data, out, ensure_ascii=False)
        
    print(f"Successfully generated search index at {dest_index_file} with {N} documents.")
