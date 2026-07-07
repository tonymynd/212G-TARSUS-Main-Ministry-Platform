# Ollama Setup Guide for Samsung RF511

This subproject provides a step-by-step guide and helper scripts to install and configure Ollama for offline AI chatting on your Samsung RF511 laptop.

## Which OS Should You Use?
Your RF511 is dual-booted with **GRACE (Windows 10 LTSC)** and **Gint (Linux Mint 22.3)**. 
**Recommendation:** Install Ollama on **Gint (Linux Mint)**. 
*Why?* Since you are relying entirely on the i7 CPU and 8GB of RAM (without GPU acceleration), Linux has significantly lower background resource usage than Windows. This frees up precious RAM and CPU cycles for the AI model, giving you noticeably faster chat generation.

---

## 🟢 Option 1: Installation on Gint (Linux Mint) - RECOMMENDED

### Step 1: Install Ollama
Open your terminal on Gint (`192.168.100.65`) and run the official installation script:
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: Download the Model
Once installed, download the recommended 3B model (which fits your 8GB RAM perfectly):
```bash
ollama run llama3.2:3b
```
*(This command will download the model. It might take a while depending on your internet connection. Once it's done, you'll be dropped into a chat prompt!)*

### Step 3: (Optional) Make Ollama Accessible on Your Network
If you want to use the Tarsus UI from your main computer but process the AI on the Samsung laptop, you need to expose the Ollama server to your network.
Edit the Ollama service:
```bash
sudo systemctl edit ollama.service
```
Add the following lines:
```ini
[Service]
Environment="OLLAMA_HOST=0.0.0.0"
```
Save, exit, and restart the service:
```bash
sudo systemctl daemon-reload
sudo systemctl restart ollama
```

---

## 🔵 Option 2: Installation on GRACE (Windows 10 LTSC)

### Step 1: Download the Installer
If you prefer Windows, you can download the installer directly:
1. Go to [https://ollama.com/download](https://ollama.com/download)
2. Click **Download for Windows**.
3. Run the `OllamaSetup.exe` file.

### Step 2: Download the Model
Open **PowerShell** or **Command Prompt** and run:
```powershell
ollama run llama3.2:3b
```

### Step 3: (Optional) Make Ollama Accessible on Your Network
To allow other computers to connect to Ollama on Windows, you need to set an environment variable.
Open PowerShell as Administrator and run:
```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_HOST', '0.0.0.0', 'Machine')
```
Then, restart the Ollama app (right-click the Ollama tray icon and select "Quit", then open it again from the Start menu).

---

## How to Connect Tarsus to the Local Ollama
Once Ollama is running on the Samsung laptop, you can point Tarsus to it instead of using cloud API keys. 

1. On your main computer running Tarsus, edit the `.env.local` file (or set the environment variable).
2. Point your AI request to the Samsung laptop's IP address (e.g., `http://192.168.100.65:11434` for Linux Mint or `192.168.100.66` for Windows).

### Connecting Next.js to Ollama
*(Note: Tarsus currently uses `api.deepseek.com` and `generativelanguage.googleapis.com` in `src/app/api/chat/route.ts`. To fully integrate Ollama, you would update that file to send a POST request to `http://<SAMSUNG_IP>:11434/api/generate` instead!)*
