// Global variables
var uploadedFiles = [];
var existingRows = [];
var headers = [];
var lastAction = null;
var currentSortColumn = null;
var currentSortOrder = 'asc';
var currentFilter = '';
var originalRows = [];

document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    initializeCodingTypeToggle(); // ADD THIS LINE
    checkForAutoSave();
});

function setupEventListeners() {
    document.getElementById('upload-btn').addEventListener('click', function() {
        document.getElementById('data-file').click();
    });

    document.getElementById('data-file').addEventListener('change', handleFileUpload);

    // Form submission
    document.getElementById('cail-form').addEventListener('submit', handleFormSubmit);

    // Session management
    document.getElementById('save-session-btn').addEventListener('click', saveSession);
    document.getElementById('load-session-btn').addEventListener('click', function() {
        document.getElementById('session-file').click();
    });
    document.getElementById('session-file').addEventListener('change', loadSession);
    document.getElementById('clear-session-btn').addEventListener('click', clearSession);

    // Results actions
    document.getElementById('select-all').addEventListener('click', toggleSelectAll);
    document.getElementById('merge-selected-btn').addEventListener('click', mergeSelectedRows);
    document.getElementById('undo-btn').addEventListener('click', undoLastAction);
    document.getElementById('rerun-btn').addEventListener('click', function() {
        performAnalysis(true);
    });

    // Download buttons
    document.getElementById('download-csv-btn').addEventListener('click', downloadCSV);
    document.getElementById('download-json-btn').addEventListener('click', downloadJSON);

    // Sort and filter
    document.getElementById('apply-filter-btn').addEventListener('click', applySortAndFilter);
    document.getElementById('clear-filter-btn').addEventListener('click', clearSortAndFilter);

    // REMOVE the deductive framework checkbox listener since we're using radio buttons now
    // The old checkbox code can be removed
}

// ADD THIS NEW FUNCTION
function initializeCodingTypeToggle() {
    const inductiveRadio = document.getElementById('inductive-coding');
    const deductiveRadio = document.getElementById('deductive-coding');
    const researchQuestionSection = document.getElementById('research-question-section');
    const deductiveFrameworkSection = document.getElementById('deductive-framework-section');
    const codingDescription = document.getElementById('coding-description');
    const researchQuestionInput = document.getElementById('research-question');
    
    function updateCodingDisplay() {
        if (inductiveRadio.checked) {
            // Show research question, hide deductive framework
            researchQuestionSection.classList.remove('hidden-section');
            deductiveFrameworkSection.classList.add('hidden-section');
            researchQuestionInput.setAttribute('required', 'required');
            codingDescription.textContent = 'Inductive coding: Generate themes that emerge naturally from the data to answer your research question.';
        } else {
            // Hide research question, show deductive framework
            researchQuestionSection.classList.add('hidden-section');
            deductiveFrameworkSection.classList.remove('hidden-section');
            researchQuestionInput.removeAttribute('required');
            codingDescription.textContent = 'Deductive coding: Categorize data according to your predefined framework without needing a research question.';
        }
    }
    
    // Add event listeners for radio buttons
    inductiveRadio.addEventListener('change', updateCodingDisplay);
    deductiveRadio.addEventListener('change', updateCodingDisplay);
    
    // Initialize display
    updateCodingDisplay();
}

function handleFileUpload(e) {
    try {
        var files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        for (let file of files) {
            if (!validateFile(file)) {
                showError(`Invalid file type: ${file.name}. Please upload CSV, TXT, or JSON files.`);
                e.target.value = '';
                return;
            }
        }
        
        uploadedFiles = files;
        updateFileList();
    } catch (error) {
        showError('Error handling file upload: ' + error.message);
    }
}

function validateFile(file) {
    const allowedTypes = ['.csv', '.txt', '.json'];
    const fileName = file.name.toLowerCase();
    return allowedTypes.some(type => fileName.endsWith(type));
}

function updateFileList() {
    var fileListDiv = document.getElementById('file-list');
    var fileNameSpan = document.getElementById('file-name');
    
    if (uploadedFiles.length === 0) {
        fileListDiv.style.display = 'none';
        fileNameSpan.textContent = 'No files chosen';
        document.getElementById('upload-btn').style.backgroundColor = '#8181aa';
        document.getElementById('upload-btn').textContent = 'Upload Data Files';
        return;
    }
    
    fileListDiv.style.display = 'block';
    fileListDiv.innerHTML = '';
    fileNameSpan.textContent = `${uploadedFiles.length} file(s) selected`;
    
    uploadedFiles.forEach((file, index) => {
        var fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span>${file.name} (${formatFileSize(file.size)})</span>
            <button onclick="removeFile(${index})">Remove</button>
        `;
        fileListDiv.appendChild(fileItem);
    });
    
    document.getElementById('upload-btn').style.backgroundColor = '#8cc63f';
    document.getElementById('upload-btn').textContent = 'Files Uploaded';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function removeFile(index) {
    uploadedFiles.splice(index, 1);
    updateFileList();
    if (uploadedFiles.length === 0) {
        document.getElementById('data-file').value = '';
    }
}

// Form submission and analysis
function handleFormSubmit(event) {
    event.preventDefault();
    performAnalysis();
}

async function performAnalysis(isRerun = false) {
    try {
        // Validate inputs
        if (!validateInputs()) return;
        
        // Show progress
        showProgress();
        
        // Prepare form data
        const formData = await prepareFormData();
        
        // Make API call
        const response = await makeAPICall(formData);
        
        // Process response
        await processAnalysisResponse(response, isRerun);
        
    } catch (error) {
        hideProgress();
        showError('Analysis error: ' + error.message);
    }
}

// MODIFY THIS FUNCTION
function validateInputs() {
    const apiKey = document.getElementById('api-key').value;
    const model = document.getElementById('model-select').value;
    const codingType = document.querySelector('input[name="coding-type"]:checked').value;
    const researchQuestion = document.getElementById('research-question').value;
    const deductiveFramework = document.getElementById('deductive-framework').value;
    
    if (!apiKey) {
        showError('Please enter your API key.');
        return false;
    }
    
    if (!model) {
        showError('Please select a model.');
        return false;
    }
    
    // Check based on coding type
    if (codingType === 'inductive') {
        if (!researchQuestion) {
            showError('Please enter a research question for inductive coding.');
            return false;
        }
    } else {
        if (!deductiveFramework || deductiveFramework.trim() === '') {
            showError('Please provide a deductive framework for deductive coding.');
            return false;
        }
    }
    
    if (uploadedFiles.length === 0) {
        showError('Please upload at least one data file.');
        return false;
    }
    
    return true;
}

// MODIFY THIS FUNCTION
async function prepareFormData() {
    const formData = new FormData();
    
    // Get coding type
    const codingType = document.querySelector('input[name="coding-type"]:checked').value;
    const useDeductiveCoding = codingType === 'deductive';
    
    // Basic form fields
    formData.append('api_key', document.getElementById('api-key').value);
    formData.append('model', document.getElementById('model-select').value);
    formData.append('use_deductive_coding', useDeductiveCoding);
    
    // Add research question or deductive framework based on coding type
    if (useDeductiveCoding) {
        formData.append('deductive_framework', document.getElementById('deductive-framework').value);
        formData.append('research_question', ''); // Send empty for deductive
    } else {
        formData.append('research_question', document.getElementById('research-question').value);
        formData.append('deductive_framework', ''); // Send empty for inductive
    }
    
    formData.append('preprompt', document.getElementById('preprompt').value);
    formData.append('query', document.getElementById('query').value);
    
    // Additional columns
    const additionalColumnsCheckboxes = document.querySelectorAll('input[name="additional-columns"]:checked');
    const selectedOptions = Array.from(additionalColumnsCheckboxes).map(checkbox => checkbox.value);
    formData.append('additional_columns', selectedOptions.join(', '));
    
    // Existing themes
    formData.append('existing_themes', existingRows.map(row => row['Theme']).join(','));
    
    // Files
    for (let file of uploadedFiles) {
        formData.append('data_files', file);
    }
    
    return formData;
}

async function makeAPICall(formData) {
    const response = await fetch('/analyze', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || response.statusText);
    }
    
    return response.text();
}

async function processAnalysisResponse(data, isRerun) {
    hideProgress();
    
    // Clean and parse CSV data
    data = cleanCSVData(data);
    const result = parseCSV(data);
    
    if (!result) {
        showError('Failed to parse the CSV data.');
        return;
    }
    
    // Update global variables
    headers = result.headers;
    const rows = result.rows;
    
    // Filter out N/A rows
    const filteredRows = rows.filter(row => {
        return Object.values(row).every(value => {
            const val = (value !== null && value !== undefined) ? value.toString().trim().toUpperCase() : '';
            return val !== 'N/A';
        });
    });
    
    // Append or replace rows
    if (isRerun) {
        existingRows = existingRows.concat(filteredRows);
    } else {
        existingRows = filteredRows;
    }
    
    originalRows = [...existingRows];
    
    // Display results
    displayResults();
}

// CSV parsing functions
function cleanCSVData(data) {
    // Remove markdown code block markers if present
    data = data.replace(/^\s*```csv\s*/i, '').replace(/\s*```\s*$/, '');
    
    // Remove any 'cp' artifacts (addressing the inter-rater reliability issue)
    data = data.replace(/\bcp\b/g, '');
    
    return data.trim();
}

function parseCSV(csvData) {
    try {
        const parsedData = Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true,
            quoteChar: "'",
            dynamicTyping: true,
            transformHeader: (header) => header.trim(),
            transform: (value) => {
                if (typeof value === 'string') {
                    return value.trim();
                }
                return value;
            }
        });

        if (parsedData.errors.length > 0) {
            console.error('CSV parsing errors:', parsedData.errors);
        }

        return {
            headers: parsedData.meta.fields,
            rows: parsedData.data
        };
    } catch (error) {
        console.error('Error parsing CSV:', error);
        return null;
    }
}

// Display functions
function displayResults() {
    const resultContainer = document.getElementById('result-container');
    const resultContent = document.getElementById('result-content');
    
    resultContainer.style.display = 'block';
    
    // Initialize sort/filter
    initializeSortFilter();
    
    // Generate and display table
    refreshTable();
    
    // Show action buttons
    document.getElementById('download-csv-btn').style.display = 'inline-block';
    document.getElementById('download-json-btn').style.display = 'inline-block';
    document.getElementById('rerun-btn').style.display = 'inline-block';
    document.getElementById('sort-filter-container').style.display = 'block';
}

function refreshTable() {
    const resultContent = document.getElementById('result-content');
    const table = generateTable(headers, existingRows);
    resultContent.innerHTML = '';
    resultContent.appendChild(table);
    bindRowCheckboxEvents();
}

function generateTable(headers, rows) {
    const table = document.createElement('table');
    table.classList.add('result-table');

    // Create header
    const thead = table.createTHead();
    const headerRow = thead.insertRow();

    // Checkbox header
    const selectHeader = document.createElement('th');
    selectHeader.textContent = '';
    headerRow.appendChild(selectHeader);

    // Data headers
    headers.forEach(headerText => {
        const th = document.createElement('th');
        th.textContent = headerText;
        headerRow.appendChild(th);
    });

    // Actions header
    const actionHeader = document.createElement('th');
    actionHeader.textContent = 'Actions';
    headerRow.appendChild(actionHeader);

    // Create body
    const tbody = table.createTBody();
    rows.forEach((rowData, rowIndex) => {
        const row = tbody.insertRow();

        // Checkbox cell
        const selectCell = row.insertCell();
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.classList.add('row-checkbox');
        checkbox.dataset.index = rowIndex;
        selectCell.appendChild(checkbox);

        // Data cells
        headers.forEach(headerText => {
            const cell = row.insertCell();
            cell.textContent = rowData[headerText] || '';
        });

        // Actions cell
        const actionCell = row.insertCell();
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.classList.add('action-button');
        deleteBtn.onclick = function() {
            deleteRow(rowIndex);
        };
        actionCell.appendChild(deleteBtn);
    });

    return table;
}

// Row manipulation functions
function deleteRow(index) {
    lastAction = {
        type: 'delete',
        previousRows: JSON.parse(JSON.stringify(existingRows)),
    };

    existingRows.splice(index, 1);
    originalRows = [...existingRows];
    refreshTable();
    document.getElementById('undo-btn').style.display = 'inline-block';
}

function toggleSelectAll() {
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
    rowCheckboxes.forEach(cb => cb.checked = !allChecked);
    updateMergeButtonVisibility();
}

function bindRowCheckboxEvents() {
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    rowCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateMergeButtonVisibility);
    });
}

function updateMergeButtonVisibility() {
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const anyChecked = Array.from(rowCheckboxes).some(cb => cb.checked);
    document.getElementById('merge-selected-btn').style.display = anyChecked ? 'inline-block' : 'none';
}

function mergeSelectedRows() {
    const selectedIndices = [];
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    rowCheckboxes.forEach(cb => {
        if (cb.checked) {
            selectedIndices.push(parseInt(cb.dataset.index));
        }
    });

    if (selectedIndices.length < 2) {
        showError('Please select at least two rows to merge.');
        return;
    }

    lastAction = {
        type: 'merge',
        previousRows: JSON.parse(JSON.stringify(existingRows)),
    };

    // Merge rows
    const mergedRow = {};
    headers.forEach(header => {
        mergedRow[header] = '';
    });

    selectedIndices.forEach(index => {
        const row = existingRows[index];
        headers.forEach(header => {
            if (row[header]) {
                if (mergedRow[header]) {
                    mergedRow[header] += ' / ' + row[header];
                } else {
                    mergedRow[header] = row[header];
                }
            }
        });
    });

    // Remove selected rows and add merged row
    existingRows = existingRows.filter((_, idx) => !selectedIndices.includes(idx));
    existingRows.push(mergedRow);
    originalRows = [...existingRows];
    
    refreshTable();
    document.getElementById('undo-btn').style.display = 'inline-block';
}

function undoLastAction() {
    if (lastAction) {
        existingRows = lastAction.previousRows;
        originalRows = [...existingRows];
        refreshTable();
        document.getElementById('undo-btn').style.display = 'none';
        lastAction = null;
    }
}

// Sort and filter functions
function initializeSortFilter() {
    const sortColumn = document.getElementById('sort-column');
    sortColumn.innerHTML = '<option value="">Sort by...</option>';
    
    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        sortColumn.appendChild(option);
    });
}

function applySortAndFilter() {
    const sortColumn = document.getElementById('sort-column').value;
    const sortOrder = document.getElementById('sort-order').value;
    const filterText = document.getElementById('filter-input').value.toLowerCase();
    
    // Start with original rows
    let filteredRows = [...originalRows];
    
    // Apply filter
    if (filterText) {
        filteredRows = filteredRows.filter(row => {
            return Object.values(row).some(value => {
                return String(value).toLowerCase().includes(filterText);
            });
        });
        currentFilter = filterText;
    }
    
    // Apply sort
    if (sortColumn) {
        filteredRows.sort((a, b) => {
            const aVal = a[sortColumn] || '';
            const bVal = b[sortColumn] || '';
            
            const comparison = String(aVal).localeCompare(String(bVal), undefined, {
                numeric: true,
                sensitivity: 'base'
            });
            
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        currentSortColumn = sortColumn;
        currentSortOrder = sortOrder;
    }
    
    // Update display
    existingRows = filteredRows;
    refreshTable();
    
    // Update filter info
    const filterInfo = document.getElementById('filter-info');
    if (filterText || sortColumn) {
        const parts = [];
        if (filterText) parts.push(`Filtered by: "${filterText}"`);
        if (sortColumn) parts.push(`Sorted by: ${sortColumn} (${sortOrder})`);
        filterInfo.textContent = parts.join(' | ') + ` | Showing ${existingRows.length} of ${originalRows.length} rows`;
    } else {
        filterInfo.textContent = '';
    }
}

function clearSortAndFilter() {
    document.getElementById('sort-column').value = '';
    document.getElementById('sort-order').value = 'asc';
    document.getElementById('filter-input').value = '';
    
    existingRows = [...originalRows];
    refreshTable();
    
    document.getElementById('filter-info').textContent = '';
    currentSortColumn = null;
    currentSortOrder = 'asc';
    currentFilter = '';
}

// Download functions
function downloadCSV() {
    const csvData = Papa.unparse(existingRows, {
        quotes: true,
        quoteChar: "'",
    });
    download(csvData, 'analysis_result.csv', 'text/csv');
}

function downloadJSON() {
    const jsonData = JSON.stringify(existingRows, null, 2);
    download(jsonData, 'analysis_result.json', 'application/json');
}

function download(data, filename, type) {
    const blob = new Blob([data], { type: type + ';charset=utf-8;' });
    const link = document.createElement('a');
    
    if (navigator.msSaveBlob) {
        navigator.msSaveBlob(blob, filename);
    } else {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

// MODIFY THIS FUNCTION
function saveSession() {
    const codingType = document.querySelector('input[name="coding-type"]:checked').value;
    
    const session = {
        timestamp: new Date().toISOString(),
        model: document.getElementById('model-select').value,
        codingType: codingType,
        researchQuestion: document.getElementById('research-question').value,
        preprompt: document.getElementById('preprompt').value,
        query: document.getElementById('query').value,
        deductiveFramework: document.getElementById('deductive-framework').value,
        additionalColumns: Array.from(document.querySelectorAll('input[name="additional-columns"]:checked')).map(cb => cb.value),
        existingRows: existingRows,
        headers: headers,
        files: uploadedFiles.map(f => ({
            name: f.name,
            size: f.size,
            type: f.type
        }))
    };
    
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cail-session-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showSessionStatus('Session saved successfully!');
}

// MODIFY THIS FUNCTION
function loadSession(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const sessionData = JSON.parse(e.target.result);
            
            // Restore form fields (excluding API key)
            document.getElementById('model-select').value = sessionData.model || 'chatgpt-4o-latest';
            
            // Restore coding type if available
            if (sessionData.codingType) {
                if (sessionData.codingType === 'deductive') {
                    document.getElementById('deductive-coding').checked = true;
                } else {
                    document.getElementById('inductive-coding').checked = true;
                }
                // Trigger the toggle update
                document.querySelector(`input[name="coding-type"]:checked`).dispatchEvent(new Event('change'));
            } else {
                // For old sessions, check if deductive framework was used
                if (sessionData.useDeductiveFramework) {
                    document.getElementById('deductive-coding').checked = true;
                } else {
                    document.getElementById('inductive-coding').checked = true;
                }
                document.querySelector(`input[name="coding-type"]:checked`).dispatchEvent(new Event('change'));
            }
            
            document.getElementById('research-question').value = sessionData.researchQuestion || '';
            document.getElementById('preprompt').value = sessionData.preprompt || document.getElementById('preprompt').value;
            document.getElementById('query').value = sessionData.query || document.getElementById('query').value;
            document.getElementById('deductive-framework').value = sessionData.deductiveFramework || document.getElementById('deductive-framework').value;
            
            // Restore checkboxes
            document.querySelectorAll('input[name="additional-columns"]').forEach(cb => {
                cb.checked = sessionData.additionalColumns?.includes(cb.value) || false;
            });
            
            // Restore data
            existingRows = sessionData.existingRows || [];
            originalRows = [...existingRows];
            headers = sessionData.headers || [];
            
            if (existingRows.length > 0) {
                displayResults();
            }
            
            showSessionStatus('Session loaded successfully!');
        } catch (err) {
            showError('Invalid session file!');
        }
    };
    reader.readAsText(file);
}

// MODIFY THIS FUNCTION
function clearSession() {
    if (confirm('Are you sure you want to clear the current session data? This will clear your analysis results but keep the preset information.')) {
        // Clear form fields except preset info
        document.getElementById('api-key').value = '';
        document.getElementById('model-select').value = 'chatgpt-4o-latest';
        document.getElementById('research-question').value = '';
        
        // Reset to inductive coding (default)
        document.getElementById('inductive-coding').checked = true;
        document.querySelector('input[name="coding-type"]:checked').dispatchEvent(new Event('change'));
        
        // Clear checkboxes
        document.querySelectorAll('input[name="additional-columns"]').forEach(cb => {
            cb.checked = false;
        });
        
        // Clear data
        existingRows = [];
        originalRows = [];
        headers = [];
        uploadedFiles = [];
        lastAction = null;
        
        // Reset UI
        updateFileList();
        document.getElementById('result-container').style.display = 'none';
        document.getElementById('data-file').value = '';
        
        showSessionStatus('Session cleared!');
    }
}

function showSessionStatus(message) {
    const statusDiv = document.getElementById('session-status');
    statusDiv.textContent = message;
    setTimeout(() => {
        statusDiv.textContent = '';
    }, 3000);
}

// Auto-save functionality
function autoSave() {
    if (existingRows.length > 0) {
        const autoSaveData = {
            timestamp: new Date().toISOString(),
            existingRows: existingRows,
            headers: headers,
            researchQuestion: document.getElementById('research-question').value
        };
        localStorage.setItem('cail-autosave', JSON.stringify(autoSaveData));
    }
}

function checkForAutoSave() {
    const autosave = localStorage.getItem('cail-autosave');
    if (autosave) {
        try {
            const data = JSON.parse(autosave);
            const timeDiff = Date.now() - new Date(data.timestamp).getTime();
            if (timeDiff < 86400000) { // Less than 24 hours old
                if (confirm('Found autosaved session. Would you like to restore it?')) {
                    existingRows = data.existingRows || [];
                    originalRows = [...existingRows];
                    headers = data.headers || [];
                    document.getElementById('research-question').value = data.researchQuestion || '';
                    
                    if (existingRows.length > 0) {
                        displayResults();
                    }
                }
            }
        } catch (err) {
            console.error('Error loading autosave:', err);
        }
    }
}

// Progress bar functions
function showProgress() {
    document.getElementById('progress-container').style.display = 'block';
    document.getElementById('progress-text').textContent = 'Analyzing data...';
    updateProgress(0);
}

function updateProgress(percentage) {
    const progressBar = document.getElementById('progress-bar');
    progressBar.style.width = percentage + '%';
    progressBar.textContent = percentage + '%';
}

function hideProgress() {
    document.getElementById('progress-container').style.display = 'none';
    document.getElementById('progress-text').textContent = '';
}

// Error handling
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}

// Simulate progress during analysis
async function simulateProgress() {
    const steps = [10, 30, 50, 70, 90];
    for (let step of steps) {
        await new Promise(resolve => setTimeout(resolve, 300));
        updateProgress(step);
    }
}

// Auto-save every 5 minutes
setInterval(autoSave, 300000);

// Make functions available globally for onclick handlers
window.removeFile = removeFile;
window.deleteRow = deleteRow;

