#!/usr/bin/env python3
import sys
import json
import os
from pathlib import Path

# Force stdout/stderr to UTF-8 to prevent Windows CP1252 encoding errors
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

try:
    from mempalace.searcher import search_memories
    from mempalace.config import MempalaceConfig
except ImportError as e:
    print(json.dumps({"error": f"Import error: {e}. Please ensure mempalace is installed in python environment."}))
    sys.exit(1)

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No query provided"}))
        sys.exit(1)
        
    query = sys.argv[1]
    
    n_results = 10
    if len(sys.argv) > 2:
        try:
            n_results = int(sys.argv[2])
        except ValueError:
            pass
            
    # Load config to get default palace path
    try:
        config = MempalaceConfig()
        palace_path = config.palace_path
    except Exception as e:
        print(json.dumps({"error": f"Failed to load MemPalace config: {e}"}))
        sys.exit(1)
        
    if not palace_path or not os.path.exists(palace_path):
        print(json.dumps({"error": f"Palace path does not exist: {palace_path}"}))
        sys.exit(1)
        
    # Run search
    try:
        res = search_memories(
            query=query,
            palace_path=palace_path,
            n_results=n_results
        )
        print(json.dumps(res, indent=2))
    except Exception as e:
        print(json.dumps({"error": f"Search execution failed: {e}"}))
        sys.exit(1)

if __name__ == "__main__":
    main()
