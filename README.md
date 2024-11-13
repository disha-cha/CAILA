# CAILA

## Overview

CAILA is a Node.js application designed to assist researchers in analyzing qualitative data using OpenAI's GPT models. The application provides an intuitive web interface for uploading data files, specifying research questions, and generating thematic analyses based on the input data.

## Features

- **Data Upload**: Upload CSV, TXT, or JSON files containing qualitative data (CSV preferred).
- **Research Question Input**: Define the research question guiding the analysis.
- **Thematic Analysis**: Generate themes, descriptions, and explanations that answer the research question.
- **Additional Output Columns**: Optionally include additional columns such as Relevant Quotes, Speaker Names, Frequency, etc..
- **Result Management**:
  - **View Results**: Display the analysis results in a dynamic table.
  - **Delete Rows**: Remove unwanted themes directly from the table.
  - **Merge Rows**: Combine similar themes into a single entry.
  - **Download CSV**: Export the results to a CSV file for further analysis.
- **Rerun Analysis**: Run additional analyses on new data without losing existing results.

## Prerequisites

- **Node.js**: Ensure you have Node.js installed (version 12 or higher is recommended).
- **OpenAI API Key**: You'll need an OpenAI API key to use the application. Sign up at [OpenAI](https://platform.openai.com/signup/) to obtain one.

## Installation

1. **Clone the Repository**:

   ```bash
   git clone https://github.com/disha-cha/CAILA.git
   cd CAILA
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

   This will install all the necessary packages as listed in `package.json`.

## Usage

1. **Start the Application**:

   ```bash
   node index.js
   ```

   The server will start and listen on `http://localhost:3000` by default.

2. **Access the Application**:

   Open a web browser and navigate to `http://localhost:3000`.

3. **Perform Analysis**:

   - **Enter OpenAI API Key**: Input your OpenAI API key in the designated field.
   - **Upload Data File**:
     - Click on **"Upload Data File"**.
     - Select your qualitative data file (supported formats: `.csv`, `.txt`, `.json`).
     - An example data file is provided in the `uploads` folder for testing.
   - **Research Question**: Enter the research question you want the AI to focus on.
   - **Additional Output Columns**:
     - Select any additional columns you want to include in the output from the dropdown menu.
     - Hold down the `Ctrl` (Windows) or `Command` (Mac) key to select multiple options.
   - **Run Analysis**:
     - Click the **"CAILyze!"** button to start the analysis.
     - A loading indicator will appear while the AI processes your request.

4. **Manage Results**:

   - **View Results**:
     - The analysis results will be displayed in a table format.
     - Each theme is presented along with its details.
   - **Delete Rows**:
     - Click the **"Delete"** button next to a row to remove it from the results.
   - **Merge Rows**:
     - Use the checkboxes to select multiple rows.
     - Click **"Merge Selected Rows"** to combine them into a single entry.
   - **Download CSV**:
     - Click the **"Download CSV"** button to export the current results.
     - The CSV will reflect any deletions or merges you've made.

5. **Rerun Analysis**:

   - Click the **"Rerun Analysis"** button to perform another analysis with the same settings.
   - New themes will be added to the existing results.

## Configuration

- **Modifying AI Prompts**:

  If you wish to adjust how the AI generates themes, you can modify the prompts in `index.js`. Look for the `modifiedQuery` variable and make your changes.

## Dependencies

The application relies on the following Node.js packages:

- **express**: Web framework for handling HTTP requests.
- **multer**: Middleware for handling file uploads.
- **openai**: Official OpenAI API client for Node.js.

## Security Considerations

- **API Key Handling**:

  - Users input their own OpenAI API keys.
  - The application uses the key only for the duration of the analysis.
  - API keys are not stored on the server or client side.

- **Data Privacy**:

  - Uploaded files are processed on the server and deleted immediately after analysis.
  - No data is stored permanently on the server.

## Deployment

[Fill in later]

## Contact

For any questions or support, please contact:

- **Disha Chauhan**
- **Email**: [disha31@mit.edu](mailto:disha31@mit.edu)
