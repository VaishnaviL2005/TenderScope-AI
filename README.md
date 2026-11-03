# TenderScope AI
### RAG-Based Tender Analysis with Product Matching and Cost Estimation

TenderScope AI is an AI-powered tender analysis application designed to automate the process of understanding tender documents, extracting technical requirements, identifying suitable OEM products, verifying technical compliance and estimating costs.

The system uses a multi-agent architecture integrated with Retrieval-Augmented Generation (RAG) to support structured and explainable tender analysis.

---

## 1. Project Overview

Tender documents often contain lengthy technical specifications, mandatory conditions, testing requirements and pricing information. Manually reviewing these documents and comparing them with manufacturer product datasheets can be time-consuming.

TenderScope AI addresses this challenge by providing an automated workflow that:

- Extracts technical requirements from uploaded tender documents.
- Retrieves relevant OEM products from a knowledge base.
- Compares product specifications against tender requirements.
- Identifies matching and mismatching technical parameters.
- Determines product compliance based on mandatory requirements.
- Estimates material and testing costs using stored pricing data.
- Performs quality checks on the generated results.
- Generates structured tender analysis reports.
- Supports tender-specific question answering.

## 2. Key Features

### Tender Document Processing
- Supports PDF, DOCX and TXT documents.
- Extracts relevant tender information and technical specifications.
- Identifies mandatory requirements and testing procedures.

### OEM Product Retrieval
- Uses Retrieval-Augmented Generation (RAG).
- Stores OEM product document embeddings in FAISS.
- Retrieves relevant product information based on tender requirements.

### Technical Product Matching
- Compares tender specifications with OEM product specifications.
- Generates parameter-wise comparison results.
- Ranks products using deterministic matching scores.
- Separates technical matching scores from compliance decisions.

### Cost Estimation
- Calculates material costs using product pricing records.
- Retrieves applicable testing prices.
- Generates estimated cost summaries.
- Avoids presenting incomplete cost totals when required pricing information is unavailable.

### Quality Review
- Validates extracted information and analysis results.
- Identifies missing pricing information and unresolved requirements.
- Generates warnings for incomplete or inconsistent results.

### Tender Reports and Re-analysis
- Generates structured analysis reports.
- Allows users to revisit previously analysed tenders.
- Supports re-analysis using the existing tender document and tender ID.
- Provides tender-specific question answering.

## 3. Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript |
| Backend | Python, FastAPI |
| AI Model | Google Gemini |
| Embeddings | Gemini Embeddings |
| Agent Orchestration | LangGraph |
| Retrieval-Augmented Generation | RAG |
| Vector Database | FAISS |
| Relational Database | Neon PostgreSQL |
| Object Storage | S3-compatible object storage |
| Document Processing | PDF, DOCX and TXT processing |

## 4. System Architecture

The application follows a multi-agent architecture coordinated by a Master Agent.

The major components are:

1. **Master Agent:** Coordinates the overall tender analysis workflow.
2. **Technical Agent:** Retrieves OEM products and performs technical specification matching.
3. **Pricing Agent:** Calculates material and testing costs using stored pricing records.
4. **Quality Review Agent:** Validates the generated results and identifies missing information.

The system combines LLM-based document understanding and retrieval with deterministic Python-based matching, compliance and cost calculations.

## 5. Application Workflow

1. The user uploads a tender document.
2. The backend processes the document and extracts relevant information.
3. The Master Agent coordinates the analysis.
4. The Technical Agent retrieves relevant OEM product information from FAISS.
5. Product specifications are compared against extracted tender requirements.
6. Products are ranked and checked for mandatory compliance.
7. The Pricing Agent calculates material and testing costs.
8. The Quality Review Agent validates the analysis.
9. The system generates a structured tender analysis report.
10. The user can ask questions about the analysed tender or initiate re-analysis.

## 6. Project Directory Structure

The project contains separate frontend and backend components.

```text
TenderScope-AI/
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── ...
│
├── backend/
│   ├── app/
│   ├── requirements.txt
│   └── ...
│
├── dataset/
│   ├── 01_Synthetic_RFP_11kV_Cable_Tender.pdf
│   ├── 02_Synthetic_Company_OEM_Product_Datasheets.pdf
│   ├── company_product_catalog.csv
│   ├── product_prices.csv
│   ├── testing_prices.csv
│   └── ground_truth.json
│
└── README.md
```

*Note: The directory structure above illustrates the logical organization. Actual folder names may differ in the submitted project.*

## 7. Installation and Execution

### Prerequisites

Install the following before running the application:

- Python 3.10 or compatible project-supported version.
- Node.js LTS and npm.
- Git (optional).
- Access to the configured Gemini API.
- Neon PostgreSQL database and configured object storage.

### Backend Setup

1. Open the backend project directory.
2. Create and activate a Python virtual environment.
3. Install the required dependencies.

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

4. Configure the required environment variables, including API credentials, database connection and storage configuration.
5. Start the FastAPI application using the project's configured Uvicorn entry point.

The API documentation can generally be accessed at:

```text
http://127.0.0.1:8000/docs
```

### Frontend Setup

1. Open the frontend directory in a terminal.
2. Install dependencies.

```bash
npm install
```

3. Start the development server.

```bash
npm run dev
```

4. Open the application in your browser:

```text
http://localhost:5173
```

For production build verification:

```bash
npm run typecheck
npm run build
```

*Note: Configure the frontend API base URL to point to the running backend. The local development setup uses `/api/v1` with the configured Vite proxy.*

## 8. API Endpoints

The backend exposes REST API endpoints under `/api/v1`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Checks backend health |
| POST | `/tenders/upload` | Uploads a tender document |
| GET | `/tenders` | Retrieves tender history |
| GET | `/tenders/{tender_id}` | Retrieves tender details |
| POST | `/tenders/{tender_id}/analyze` | Initiates tender analysis |
| GET | `/tenders/{tender_id}/status` | Checks analysis status |
| GET | `/tenders/{tender_id}/requirements` | Retrieves extracted requirements |
| GET | `/tenders/{tender_id}/report` | Retrieves the analysis report |
| POST | `/tenders/{tender_id}/questions` | Asks a tender-specific question |
| GET | `/products` | Retrieves product records |
| POST | `/products/import` | Imports product catalogue data |
| POST | `/knowledge-base/ingest` | Ingests OEM knowledge documents |
| POST | `/knowledge-base/rebuild` | Rebuilds the vector knowledge base |
| GET | `/knowledge-base/status` | Checks knowledge base status |
| GET | `/pricing/products` | Retrieves product pricing |
| GET | `/pricing/tests` | Retrieves testing prices |

## 9. Knowledge Base and Dataset

The project uses a synthetic 11 kV underground cable tender and corresponding synthetic OEM product datasheets for demonstration and evaluation.

The dataset includes:

- Tender requirement document.
- OEM product datasheets.
- Product catalogue.
- Material pricing records.
- Testing pricing records.
- Ground-truth evaluation data.

The OEM datasheets are processed and stored in the FAISS vector knowledge base. Product catalogue and pricing information are maintained separately in the relational database.

The knowledge base is populated during initial setup and updated when OEM product documentation changes.

## 10. Testing and Evaluation

The system is evaluated using a synthetic 11 kV cable tender.

The current evaluation includes:

- Extraction of 8 major technical requirement fields.
- Identification of 4 required testing procedures.
- Retrieval and ranking of relevant OEM products.
- Parameter-wise technical comparison.
- Compliance verification.
- Material and testing cost estimation.
- Quality review of generated results.

Observed technical matching results:

| Product ID | Matching Score | Compliance |
|---|---:|---|
| AG-11-240-AL-STA | 100% | Compliant |
| AG-11-240-AL-SWA | 87.5% | Non-compliant |
| AG-11-300-AL-STA | 75% | Non-compliant |

These matching percentages represent technical parameter-matching scores and should not be interpreted as overall model accuracy.

## 11. Limitations

- The evaluation currently uses a synthetic tender and OEM dataset.
- Product retrieval and matching quality depend on the completeness of the available OEM documentation.
- Pricing accuracy depends on the correctness and availability of stored pricing records.
- LLM-generated document interpretations may require human verification.
- Further evaluation using multiple real-world tender documents is required to establish generalization and performance.

## 12. Future Scope

Possible future enhancements include:

- Support for additional tender document formats.
- Evaluation using larger real-world tender datasets.
- Improved retrieval and ranking techniques.
- Advanced comparison of multiple OEM manufacturers.
- More detailed pricing breakdowns.
- Performance optimization and monitoring.
- Enhanced tender-specific question answering.

## 13. Disclaimer

TenderScope AI is an academic project developed for tender document analysis and decision-support purposes. Its product recommendations and estimated costs are not official declarations of compliance, commercial quotations or substitutes for professional technical and procurement verification.

---

**Project Name:** TenderScope AI  
**Project Title:** RAG-Based Tender Analysis with Product Matching and Cost Estimation  
**Project Type:** Engineering Semester End Examination (ESE) Project
