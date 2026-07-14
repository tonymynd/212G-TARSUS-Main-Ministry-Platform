#!/usr/bin/env python3
import os
import sys
import json

def main():
    if len(sys.argv) < 2:
        print("Usage: python delete_page.py <filename_or_slug>")
        print("Example: python delete_page.py gmp_unknown_vivo_x_jesus_oracion_4_3_23_20230307.md")
        sys.exit(1)

    target_input = sys.argv[1].strip()
    
    # Resolve the correct markdown filename
    if not target_input.endswith(".md"):
        filename = target_input + ".md"
    else:
        filename = target_input

    # Define paths relative to the project root
    # Since this script lives in Support/scripts/, we look two levels up
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.abspath(os.path.join(script_dir, "..", ".."))
    
    pages_dir = os.path.join(project_root, "data", "pages")
    index_path = os.path.join(project_root, "src", "data", "search_index.json")
    target_file_path = os.path.join(pages_dir, filename)

    print(f"Target page file: {filename}")
    print(f"Project root resolved to: {project_root}")

    # 1. Delete page from data/pages/
    deleted_from_disk = False
    if os.path.exists(target_file_path):
        try:
            os.remove(target_file_path)
            print(f"[v] Deleted: {target_file_path}")
            deleted_from_disk = True
        except Exception as e:
            print(f"[x] Error deleting file from disk: {e}")
            sys.exit(1)
    else:
        print(f"[i] File not found on disk at {target_file_path} (skipping disk deletion)")

    # 2. Delete from search_index.json
    if os.path.exists(index_path):
        try:
            with open(index_path, "r", encoding="utf-8") as f:
                index = json.load(f)

            initial_count = len(index.get("documents", []))
            
            # Find and filter out the document matching this filename in its path
            # The paths in the index look like: data/pages/filename.md
            target_slug = os.path.splitext(filename)[0]
            
            filtered_docs = []
            removed_count = 0
            for doc in index.get("documents", []):
                doc_path = doc.get("path", "")
                doc_filename = os.path.basename(doc_path)
                doc_slug = os.path.splitext(doc_filename)[0]
                
                if doc_filename == filename or doc_slug == target_slug:
                    removed_count += 1
                else:
                    filtered_docs.append(doc)

            if removed_count > 0:
                index["documents"] = filtered_docs
                index["total_docs"] = len(filtered_docs)
                
                with open(index_path, "w", encoding="utf-8") as f:
                    json.dump(index, f, ensure_ascii=False, indent=2)
                
                print(f"[v] Removed from search_index.json (document count: {initial_count} -> {len(filtered_docs)})")
            else:
                print("[i] Document was not found in search_index.json (no changes made to index)")
                if not deleted_from_disk:
                    print("[!] Neither the file nor the search index entry was found. Check the filename and try again.")
                    sys.exit(1)

        except Exception as e:
            print(f"[x] Error updating search index: {e}")
            sys.exit(1)
    else:
        print(f"[x] Search index not found at {index_path}")
        sys.exit(1)

    print("[*] Clean up completed successfully!")

if __name__ == "__main__":
    main()
