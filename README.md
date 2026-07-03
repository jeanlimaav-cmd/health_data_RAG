# health_data_RAG

A Retrieval-Augmented Generation (RAG) system for health data.

## Overview

This project builds a RAG pipeline over health data, enabling natural-language
questions to be answered from a knowledge base of documents using an LLM.

## Getting Started

### Prerequisites

- Python 3.10+

### Setup

```bash
python -m venv .venv
# Windows (PowerShell)
.venv\Scripts\Activate.ps1
# macOS / Linux
source .venv/bin/activate

pip install -r requirements.txt
```

### Configuration

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

## Project Structure

```
health_data_RAG/
├── README.md
├── requirements.txt
├── .gitignore
├── .env.example
└── src/
```

## License

See [LICENSE](LICENSE).
