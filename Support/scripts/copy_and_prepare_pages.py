import os
import re
import zipfile
import xml.etree.ElementTree as ET

# Resolve paths relative to project root
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, '..', '..'))
dest_pages_dir = os.path.join(project_root, 'data', 'pages')

pantry_dirs = [
    {"path": r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\Daniel Miles", "type": "study", "recursive": False},
    {"path": r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\Daniel Miles\Daniel-Miles-Posts-Archive", "type": "post", "recursive": True},
    {"path": r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\Daniel Miles\Dan Emails", "type": "email", "recursive": True},
    {"path": r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\ABOVE all these things put on charity", "type": "study", "recursive": True},
    {"path": r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\GodShew", "type": "study", "recursive": True},
    {"path": r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\ORG-NOTES\Social-Media-Captures", "type": "post", "recursive": True}
]

def sanitize_slug(name):
    name_no_ext = os.path.splitext(name)[0]
    slug = name_no_ext.lower()
    slug = re.sub(r'[^a-z0-9_&]+', '_', slug)
    slug = re.sub(r'_+', '_', slug)
    return slug.strip('_') + ".md"

def extract_title(content, default_title):
    fm_match = re.match(r"^---\s*\n([\s\S]*?)\n---\s*\n", content)
    if fm_match:
        title_match = re.search(r"^title:\s*[\"']?([^\"'\n]+)[\"']?", fm_match.group(1), re.MULTILINE)
        if title_match:
            return title_match.group(1).strip(), content[fm_match.end():]
            
    header_match = re.match(r"^#\s+(.+)$", content, re.MULTILINE)
    if header_match:
        return header_match.group(1).strip(), content
        
    return default_title, content

def read_docx(file_path):
    try:
        with zipfile.ZipFile(file_path) as z:
            xml_content = z.read('word/document.xml')
            root = ET.fromstring(xml_content)
            
            paragraphs = []
            for elem in root.iter():
                if elem.tag.endswith('}p'):
                    p_text = []
                    for child in elem.iter():
                        if child.tag.endswith('}t') and child.text:
                            p_text.append(child.text)
                    if p_text:
                        paragraphs.append("".join(p_text))
            return "\n\n".join(paragraphs)
    except Exception as e:
        print(f"Error reading docx {file_path}: {e}")
        return ""

def copy_files():
    if not os.path.exists(dest_pages_dir):
        os.makedirs(dest_pages_dir)
        
    copied_count = 0

    for item in pantry_dirs:
        base_dir = item["path"]
        doc_type = item["type"]
        is_recursive = item["recursive"]
        
        if not os.path.exists(base_dir):
            print(f"Skipping missing pantry dir: {base_dir}")
            continue
            
        print(f"Scanning pantry dir: {base_dir} (recursive={is_recursive})")
        
        for root, dirs, files in os.walk(base_dir):
            if not is_recursive and root != base_dir:
                continue
                
            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext not in [".md", ".docx"] or file.startswith("~$"):
                    continue
                    
                src_path = os.path.join(root, file)
                
                # Avoid double-scanning subfolders inside Daniel Miles root
                if base_dir == r"C:\STORAGE\M\Manifold-Grace\3-RESOURCES(Pantry)\GMP-NOTES\Daniel Miles":
                    rel_to_base = os.path.relpath(src_path, base_dir)
                    if "Dan Emails" in rel_to_base or "Daniel-Miles-Posts-Archive" in rel_to_base:
                        continue
                
                # Sanitize slug
                dest_filename = sanitize_slug(file)
                dest_path = os.path.join(dest_pages_dir, dest_filename)
                
                # Handle collisions
                counter = 1
                while os.path.exists(dest_path):
                    if os.path.abspath(src_path) == os.path.abspath(dest_path):
                        break
                    base, ext_name = os.path.splitext(dest_filename)
                    new_filename = f"{base}_{counter}{ext_name}"
                    dest_path = os.path.join(dest_pages_dir, new_filename)
                    counter += 1

                # Extract title and clean body
                default_title = os.path.splitext(file)[0].replace("_", " ").replace("-", " ")
                
                if ext == ".docx":
                    clean_body = read_docx(src_path)
                    title = default_title
                else:
                    try:
                        with open(src_path, "r", encoding="utf-8", errors="ignore") as sf:
                            content = sf.read()
                    except Exception as e:
                        print(f"Error reading {src_path}: {e}")
                        continue
                    title, clean_body = extract_title(content, default_title)
                
                # Write to destination with clean frontmatter
                try:
                    with open(dest_path, "w", encoding="utf-8") as df:
                        df.write(f"---\ntitle: \"{title}\"\ntype: \"{doc_type}\"\noriginal_path: \"{src_path}\"\n---\n")
                        df.write(clean_body)
                    copied_count += 1
                except Exception as e:
                    print(f"Error writing to {dest_path}: {e}")
                    
    print(f"Successfully copied/converted {copied_count} files to pages directory!")

if __name__ == "__main__":
    copy_files()
