# Tarsus Fine-Tuning Roadmap

Fine-tuning a local AI model on the Tarsus corpus is the ultimate way to achieve the project's goal. While RAG (Retrieval-Augmented Generation) is great for fetching facts, fine-tuning actually alters the "brain" (neural weights) of the AI. 

By fine-tuning, the AI will naturally speak in Daniel Miles' voice, intuitively use his vocabulary (like "innerstand" and "cOLD vs LukeWarm"), and deeply comprehend the theological contrasts between Old Testament Law and New Testament Grace without needing a massive system prompt to force it.

Here is the step-by-step roadmap to achieve a truly trained Tarsus AI.

## Phase 1: Dataset Preparation (The most important step)
AI models cannot read raw folders of Markdown files to learn. They need a highly structured dataset of "Conversations" (usually in JSONL format). 

We need to build a script in the Tarsus codebase that:
1. Reads every `.md` file in `src/data/pages`.
2. Extracts the title, body, and key theological concepts.
3. Automatically generates synthetic Q&A pairs. For example:
   * **User:** "What is the difference between the OT and NT?"
   * **Assistant:** "Seems when looking at your question, we must divide cOLD OT Law from NT Grace..." (Generated from the markdown content).
4. Saves thousands of these pairs into a `tarsus_training_data.jsonl` file.

## Phase 1.5: Data Curation & Considerations (Garbage In = Garbage Out)
Before feeding the JSONL file to the GPU, we must ensure the dataset is impeccably curated. An AI learns *exactly* what you feed it. 
* **Remove the "Junk":** If the Markdown files contain random "scratchpad" notes, broken URLs, or unformatted copy-pastes from the web, the AI will learn to speak like a broken URL. We must write a filter script to exclude non-theological notes.
* **Enforce Vocabulary Consistency:** We must ensure words like "innerstand" and "cOLD" are spelled correctly throughout the dataset. If the dataset has 50 instances of "understand" and 50 instances of "innerstand", the model will get confused. It needs strong, consistent patterns.
* **Context Chunking:** An AI can only "read" a certain amount of text at a time during training (usually 2,000 to 4,000 tokens). We cannot feed it a 10,000-word essay as a single Q&A pair. The curation script must split massive studies into logical, bite-sized paragraphs while maintaining the core context.
* **Inject the Persona:** Every training example should secretly include a system prompt (e.g., "You are Tarsus...") so the model structurally binds Daniel's theology directly to that specific persona.

## Phase 2: Cloud GPU Training
Since laptops (especially the Samsung RF511) do not have the massive VRAM required to train an AI, we rent a cloud GPU for a few hours (which usually costs around $1 to $3 total).
1. Upload the `tarsus_training_data.jsonl` file to a service like **Google Colab**, **RunPod**, or **Kaggle**.
2. Use a framework like **Unsloth** (which makes fine-tuning incredibly fast and easy).
3. Select a base model (like `llama3.2:3b` or `qwen2.5:1.5b`).
4. Run the training script. The AI will read your dataset thousands of times, adjusting its neural pathways to mirror the theology.

## Phase 3: Exporting to GGUF
Once the model finishes training on the cloud GPU, you export the "brain" into a single, highly compressed file format called **GGUF**. 
* This file contains all of Daniel Miles' theology baked into the AI's core logic.
* You download this `.gguf` file back to your local computer (or the Samsung laptop).

## Phase 4: Running on Ollama
Finally, you bring the trained model to life completely offline.
1. Create a `Modelfile` on your laptop that points to your new `.gguf` file.
2. Run `ollama create Tarsus-Prime -f Modelfile`.
3. Connect the Next.js Tarsus app to your local `Tarsus-Prime` model.

---
*If you are ready to begin this journey, our first step is writing the Python or Node.js script to convert your Markdown vault into the JSONL training dataset!*
