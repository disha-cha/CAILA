const express = require('express');
const multer = require('multer');
const fs = require('fs');
const OpenAI = require('openai');
const https = require('https');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Serve static files from the "public" folder using an absolute path
app.use(express.static(path.join(__dirname, 'public')));

// Explicitly serve index.html at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/analyze', upload.single('data_file'), async (req, res) => {
  try {
    const apiKey = req.body.api_key;
    // Set the default model to 'chatgpt-4o-latest' if none is provided
    const selectedModel = req.body.model || 'chatgpt-4o-latest';
    const researchQuestion = req.body.research_question;
    const preprompt = req.body.preprompt;
    const query = req.body.query;
    const additionalColumns = req.body.additional_columns;
    const existingThemes = req.body.existing_themes || '';
    const dataFilePath = req.file.path;

    if (!apiKey) {
      res.status(400).send('API key is required.');
      return;
    }

    const dataContent = fs.readFileSync(dataFilePath, 'utf8');

    // Updated mapping: keys match the dropdown values and point to the appropriate backend model version.
    const modelMapping = {
      'chatgpt-4o-latest': 'chatgpt-4o-latest',
      'gpt-4o': 'gpt-4o-2024-08-06',
      'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
      'o1': 'o1-2024-12-17',
      'o1-mini': 'o1-mini-2024-09-12',
      'o3-mini': 'o3-mini-2025-01-31',
      'claude': 'claude-v1'
    };
    const openaiModel = modelMapping[selectedModel] || 'chatgpt-4o-latest';

    // Build the columns list for the AI prompt
    let columnsList = ['Theme', 'Description', 'Explanation'];
    if (additionalColumns && additionalColumns.trim() !== '') {
      columnsList = columnsList.concat(additionalColumns.split(',').map(col => col.trim()));
    }

    // Construct descriptions for additional columns with hardcoded prompts
    let additionalColumnsDescription = '';
    const additionalColumnsArray = additionalColumns ? additionalColumns.split(',').map(col => col.trim()) : [];

    additionalColumnsArray.forEach(col => {
      switch (col) {
        case 'Relevant Quotes':
          additionalColumnsDescription += `- **${col}**: Provide a direct quote from the data that illustrates the theme. The quote should be enclosed in double quotation marks (") and should not include the speaker's name.\n`;
          break;
        case 'Speaker Names':
          additionalColumnsDescription += `- **${col}**: List the names or identifiers of students who contributed to the theme.\n`;
          break;
        case 'Frequency':
          additionalColumnsDescription += `- **${col}**: Indicate how many times the theme appeared in the discussions.\n`;
          break;
        case 'Emotions Expressed':
          additionalColumnsDescription += `- **${col}**: Describe any emotions expressed by students related to the theme.\n`;
          break;
        case 'Challenges Discussed':
          additionalColumnsDescription += `- **${col}**: Mention any challenges the students discussed in relation to the theme.\n`;
          break;
        case 'Suggestions or Solutions':
          additionalColumnsDescription += `- **${col}**: Note any suggestions or solutions proposed by the students.\n`;
          break;
        case 'Questions Raised':
          additionalColumnsDescription += `- **${col}**: Include any questions the students asked that relate to the theme.\n`;
          break;
        case 'Agreement Level':
          additionalColumnsDescription += `- **${col}**: Indicate whether students agreed or disagreed on the theme.\n`;
          break;
        case 'Keywords':
          additionalColumnsDescription += `- **${col}**: List key terms or phrases associated with the theme.\n`;
          break;
        case 'Educational Concepts':
          additionalColumnsDescription += `- **${col}**: Mention any educational theories or concepts related to the theme.\n`;
          break;
        default:
          additionalColumnsDescription += `- **${col}**: Provide details for ${col}.\n`;
          break;
      }
    });

    // Create a CSV header line
    const csvHeader = columnsList.join(',');

    // Modify the query to include detailed instructions and an example
    const modifiedQuery = `
I want you to generate as many new themes as possible that answer the research question. Do not include the following themes: ${existingThemes}.

For each theme, provide the following columns:

- **Theme**: A concise name for the theme.
- **Description**: A detailed description of the theme.
- **Explanation**: Explain how the theme answers the research question.
${additionalColumnsDescription}
Please ensure:

- Each theme must have data for all columns specified above.
- If any required data is not available for a theme, then do not include that theme in the output.
- Use only the data provided.
- **Enclose every field in single quotes, regardless of content.**
- **Use commas to separate fields.**
- **Do not include any additional commas or line breaks within a field.**
- **Do not include any extra text or explanations outside the CSV format.**
- **For the 'Relevant Quotes' column, ensure that the quote itself is enclosed in double quotation marks ("") within the single-quoted field.**

Output the data in CSV format, with the following header line:

${csvHeader}

Each subsequent line should contain the data for one theme.

**Example Output:**

${csvHeader}
'Theme 1','Description of theme 1','Explanation of theme 1','"Relevant Quote 1"','Educational Concept 1'
'Theme 2','Description of theme 2','Explanation of theme 2','"Relevant Quote 2"','Educational Concept 2'
'Theme 3','Description of theme 3','Explanation of theme 3','"Relevant Quote 3"','Educational Concept 3'

**Important Notes:**

- **Enclose all fields in single quotes.**
- **Do not include any extra text or explanations outside the CSV format.**
- **Do not include any line breaks within a field.**
`;

    // Construct the prompt
    const prompt = `${preprompt}\n\nResearch Question: ${researchQuestion}\n\nData:\n${dataContent}\n\n${modifiedQuery}`;

    const openai = new OpenAI({
      apiKey: apiKey,
    });

    // Call the OpenAI API with adjusted parameters
    const response = await openai.chat.completions.create({
      model: openaiModel,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 3000, // Increase if necessary
      temperature: 0.3, // Lower value for more consistent output
    });

    const analysisResult = response.choices[0].message.content.trim();

    res.send(analysisResult);

    fs.unlinkSync(dataFilePath);
  } catch (error) {
    console.error(error);
    // Enhanced error handling:
    let errorMessage = 'An error occurred while processing your request.';
    if (error.error && error.error.message) {
      const errMsg = error.error.message;
      if (errMsg.includes("'max_tokens' is not supported")) {
        errorMessage = "Error: The selected model requires a different API key token limit. Please use an API key that supports the chosen model (for example, if you're using an OpenAI key, select a compatible model).";
      } else if (req.body.model === 'claude') {
        errorMessage = "Error: It appears you're attempting to use Claude, but your API key may be for OpenAI. Please ensure you're using the correct API key for Claude.";
      } else {
        errorMessage = errMsg;
      }
    }
    res.status(400).send(errorMessage);
  }
});

// Start the HTTPS server
const PORT = process.env.PORT || 3000;
const certs = {
  key: fs.readFileSync(path.join(__dirname, 'cert', 'key.pem'), 'utf8'),
  cert: fs.readFileSync(path.join(__dirname, 'cert', 'cert.pem'), 'utf8')
};

https.createServer(certs, app).listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
