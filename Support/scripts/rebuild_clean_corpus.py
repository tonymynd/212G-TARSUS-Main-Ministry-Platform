import os
import subprocess
import sys

# Resolve paths relative to project root
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..', '..'))

dest_dir = os.path.join(project_root, 'data', 'pages')

# Step 1: Clean dest dir
keep = {'about.md', 'daniels_testimony.md'}
deleted = 0
if os.path.exists(dest_dir):
    for f in os.listdir(dest_dir):
        if f.endswith('.md') and f not in keep:
            os.remove(os.path.join(dest_dir, f))
            deleted += 1
else:
    os.makedirs(dest_dir, exist_ok=True)

print(f"Deleted {deleted} files from {dest_dir} (kept {keep})")

# Step 2: Run copy_and_prepare_pages.py
print("\nRunning copy_and_prepare_pages.py...")
subprocess.run([sys.executable, os.path.join(current_dir, 'copy_and_prepare_pages.py')], check=True)

# Step 3: Run index_corpus.py
print("\nRunning index_corpus.py...")
subprocess.run([sys.executable, os.path.join(current_dir, 'index_corpus.py')], check=True)

print("\nKnowledge base successfully rebuilt!")
