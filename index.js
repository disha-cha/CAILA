const express = require('express');
const multer = require('multer');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

const OpenAI = require('openai');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const upload = multer({ 
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 10 // Max 10 files
    }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something went wrong!');
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/analyze', upload.array('data_files', 10), async (req, res) => {
    let uploadedFilePaths = [];
    
    try {
        const validationError = validateRequest(req);
        if (validationError) {
            return res.status(400).send(validationError);
        }

        const {
            apiKey,
            selectedModel,
            researchQuestion,
            preprompt,
            query,
            additionalColumns,
            existingThemes,
            deductiveFramework
        } = extractRequestData(req);

        uploadedFilePaths = req.files.map(file => file.path);

        const dataContent = await readAndCombineFiles(req.files);

        const prompt = buildPrompt({
            preprompt,
            researchQuestion,
            dataContent,
            query,
            additionalColumns,
            existingThemes,
            deductiveFramework
        });

        // Get AI response based on selected model
        const analysisResult = await getAIResponse(selectedModel, apiKey, prompt);

        res.send(analysisResult);

    } catch (error) {
        console.error('Analysis error:', error);
        
        // error message
        let errorMessage = 'An error occurred while processing your request.';
        
        if (error.message) {
            if (error.message.includes('API key')) {
                errorMessage = 'Invalid API key. Please check your API key and ensure it matches the selected model.';
            } else if (error.message.includes('quota')) {
                errorMessage = 'API quota exceeded. Please check your API usage limits.';
            } else if (error.message.includes('model')) {
                errorMessage = 'Model error: ' + error.message;
            } else {
                errorMessage = error.message;
            }
        }
        
        res.status(400).send(errorMessage);
        
    } finally {
        for (const filePath of uploadedFilePaths) {
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error('Error deleting file:', err);
            }
        }
    }
});

function validateRequest(req) {
    if (!req.body.api_key) {
        return 'API key is required.';
    }
    
    if (!req.body.model) {
        return 'Model selection is required.';
    }
    
    if (!req.body.research_question) {
        return 'Research question is required.';
    }
    
    if (!req.files || req.files.length === 0) {
        return 'At least one data file is required.';
    }
    
    const allowedExtensions = ['.csv', '.txt', '.json'];
    for (const file of req.files) {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            return `Invalid file type: ${file.originalname}. Allowed types: CSV, TXT, JSON`;
        }
    }
    
    return null;
}

function extractRequestData(req) {
    return {
        apiKey: req.body.api_key,
        selectedModel: req.body.model || 'chatgpt-4o-latest',
        researchQuestion: req.body.research_question,
        preprompt: req.body.preprompt || '',
        query: req.body.query || '',
        additionalColumns: req.body.additional_columns || '',
        existingThemes: req.body.existing_themes || '',
        deductiveFramework: req.body.deductive_framework || ''
    };
}

// Read and combine multiple files
async function readAndCombineFiles(files) {
    const contents = [];
    
    for (const file of files) {
        const content = await fs.readFile(file.path, 'utf8');
        contents.push(`\n--- File: ${file.originalname} ---\n${content}`);
    }
    
    return contents.join('\n\n');
}

function buildPrompt(params) {
    const {
        preprompt,
        researchQuestion,
        dataContent,
        query,
        additionalColumns,
        existingThemes,
        deductiveFramework
    } = params;

    // Build columns list
    let columnsList = ['Theme', 'Description', 'Explanation'];
    if (additionalColumns && additionalColumns.trim() !== '') {
        columnsList = columnsList.concat(additionalColumns.split(',').map(col => col.trim()));
    }

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
            case 'Keywords':
                additionalColumnsDescription += `- **${col}**: List key terms or phrases associated with the theme.\n`;
                break;
            default:
                additionalColumnsDescription += `- **${col}**: Provide details for ${col}.\n`;
                break;
        }
    });

    const csvHeader = columnsList.join(',');

    // Build the prompt with clear instructions to analyze the provided data
    let prompt = `IMPORTANT: You must analyze ONLY the conversation data provided below. Do NOT generate generic themes about the topic. Instead, identify themes that emerge from the actual conversations in the data files.\n\n`;
    
    prompt += `${preprompt}\n\nResearch Question: ${researchQuestion}\n\n`;
    
    // Add deductive framework if provided
    if (deductiveFramework) {
        prompt += `Deductive Framework to Consider:\n${deductiveFramework}\n\n`;
        prompt += `Use this framework to help identify and categorize themes in the conversation data.\n\n`;
    }
    
    prompt += `CONVERSATION DATA TO ANALYZE:\n${dataContent}\n\n`;
    prompt += `END OF CONVERSATION DATA\n\n`;

    const modifiedQuery = `
CRITICAL INSTRUCTIONS: 
1. Analyze ONLY the conversation data provided above between "CONVERSATION DATA TO ANALYZE" and "END OF CONVERSATION DATA"
2. Do NOT generate generic themes about the topic
3. Each theme must be based on specific content from the conversations
4. When providing quotes, use actual quotes from the conversation data

${query}

Additional Instructions:
Generate themes that emerge from analyzing the actual conversations in the data. ${existingThemes ? `Do not include the following themes: ${existingThemes}.` : ''}

${deductiveFramework ? 'Use the provided deductive framework to help categorize the themes you identify in the conversation data.' : ''}

For each theme identified in the conversation data, provide the following columns:

- **Theme**: A concise name for the theme found in the conversations
- **Description**: A detailed description of how this theme appears in the conversation data
- **Explanation**: Explain how this theme from the conversations answers the research question
${additionalColumnsDescription}

Requirements:
- Each theme must be grounded in the actual conversation data
- If providing quotes, they must be verbatim from the conversations
- Do not invent or imagine content not present in the data
- Focus on patterns, topics, and interactions present in the conversations

Output the data in CSV format, with the following header line:

${csvHeader}

Each subsequent line should contain the data for one theme found in the conversations.

**Example Output (based on actual conversation content):**

${csvHeader}
'Confusion about axes','Students repeatedly express confusion about which variable goes on which axis','This shows a fundamental challenge students face when creating plots'${additionalColumnsArray.includes('Relevant Quotes') ? ',\'"Wait, does time go on x or y?"\'' : ''}${additionalColumnsArray.includes('Keywords') ? ",'axes, x-axis, y-axis, confusion'" : ''}

**Important Notes:**
- **Analyze the conversation data, not general knowledge about the topic**
- **All themes must come from the provided conversations**
- **Enclose all fields in single quotes**
- **Do not include any extra text outside the CSV format**
`;

    return prompt + modifiedQuery;
}

async function getAIResponse(model, apiKey, prompt) {
    const modelMapping = {
        'chatgpt-4o-latest': 'openai',
        'gpt-4o': 'openai',
        'gpt-4o-mini': 'openai',
        'o1': 'openai',
        'o1-mini': 'openai',
        'o3-mini': 'openai',
        'claude': 'claude',
        'gemini': 'gemini'
    };

    const provider = modelMapping[model] || 'openai';

    switch (provider) {
        case 'openai':
            return await getOpenAIResponse(model, apiKey, prompt);
        case 'gemini':
            return await getGeminiResponse(apiKey, prompt);
        case 'claude':
            return await getClaudeResponse(apiKey, prompt);
        default:
            throw new Error('Unsupported model provider');
    }
}

// OpenAI response handler
async function getOpenAIResponse(model, apiKey, prompt) {
    const openai = new OpenAI({ apiKey });

    // Map model names to OpenAI model IDs
    const openaiModelMapping = {
        'chatgpt-4o-latest': 'chatgpt-4o-latest',
        'gpt-4o': 'gpt-4o-2024-08-06',
        'gpt-4o-mini': 'gpt-4o-mini-2024-07-18',
        'o1': 'o1-2024-12-17',
        'o1-mini': 'o1-mini-2024-09-12',
        'o3-mini': 'o3-mini-2025-01-31'
    };

    const openaiModel = openaiModelMapping[model] || 'chatgpt-4o-latest';

    try {
        const response = await openai.chat.completions.create({
            model: openaiModel,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 3000,
            temperature: 0.3,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${error.message}`);
    }
}

// Gemini response handler
async function getGeminiResponse(apiKey, prompt) {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-pro" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text().trim();
    } catch (error) {
        console.error('Gemini API error:', error);
        throw new Error(`Gemini API error: ${error.message}`);
    }
}

// Claude response handler (placeholder for now)
async function getClaudeResponse(apiKey, prompt) {
    
    throw new Error('Claude integration not yet implemented. Please use OpenAI or Gemini models.');
}

const PORT = process.env.PORT || 3000;

const certPath = path.join(__dirname, 'cert', 'cert.pem');
const keyPath = path.join(__dirname, 'cert', 'key.pem');

fs.access(certPath)
    .then(() => fs.access(keyPath))
    .then(() => {
        // HTTPS server with certificates
        const certs = {
            key: fs.readFileSync(keyPath, 'utf8'),
            cert: fs.readFileSync(certPath, 'utf8')
        };
        
        https.createServer(certs, app).listen(PORT, () => {
            console.log(`HTTPS Server is running on port ${PORT}`);
        });
    })
    .catch(() => {
        console.warn('SSL certificates not found. Starting HTTP server instead.');
        app.listen(PORT, () => {
            console.log(`HTTP Server is running on port ${PORT}`);
        });
    });

process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
    });
});
