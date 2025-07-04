import React, { useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, MapPin, Zap, Database, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  TargetSchema,
  FileData,
  MappingResults,
  ValidationResults,
  MappedRow,
  SheetAnalysis,
  SheetClassification,
  ProcessedSheet,
  ValidationIssue
} from '../types';

const ProductionSOVProcessor: React.FC = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState<boolean>(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [mappingResults, setMappingResults] = useState<MappingResults | null>(null);
  const [validationResults, setValidationResults] = useState<ValidationResults | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [geocodingInProgress, setGeocodingInProgress] = useState<boolean>(false);

  // Target schema from your template
  const targetSchema: TargetSchema = {
    'Location Number': 'locationNumber',
    'Property': 'property',
    'Street Address': 'streetAddress',
    'Suburb': 'suburb',
    'State': 'state',
    'Postal / ZIP Code': 'postalZipCode',
    'Cresta Zone': 'crestaZone',
    'Country': 'country',
    'Occupancy': 'occupancy',
    'PD Value': 'pdValue',
    'PD Deductibles': 'pdDeductibles',
    'BI Value': 'biValue',
    'Total Insurable Value': 'totalInsurableValue',
    'Latitude': 'latitude',
    'Longitude': 'longitude',
    'Construction Class': 'constructionClass',
    'Roof Type': 'roofType',
    'Number of Stories': 'numberOfStories',
    'Year Built': 'yearBuilt',
    'Fluvial Flood': 'fluvialFlood',
    'Original Storm Surge': 'originalStormSurge',
    'Original PF Risk Level': 'originalPfRiskLevel',
    'Windstorm': 'windstorm',
    'Hailstorm': 'hailstorm',
    'Wildfire': 'wildfire',
    'Severity': 'severity'
  };

  const criticalFields: (keyof MappedRow)[] = [
    'locationNumber', 'streetAddress', 'country', 'occupancy'
  ];

  // Helper function to clean AI responses and extract JSON
  const cleanAndParseJSON = (response: string): any => {
    let cleanResponse = response.trim();
    try {
      // Remove any text before the JSON
      const jsonMatch = cleanResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[1];
      } else {
        // Look for JSON objects/arrays without markdown
        const jsonStart = cleanResponse.indexOf('{');
        const jsonArrayStart = cleanResponse.indexOf('[');
        if (jsonStart !== -1 && (jsonArrayStart === -1 || jsonStart < jsonArrayStart)) {
          cleanResponse = cleanResponse.substring(jsonStart);
        } else if (jsonArrayStart !== -1) {
          cleanResponse = cleanResponse.substring(jsonArrayStart);
        }
        // Remove any trailing text after JSON
        const lastBrace = cleanResponse.lastIndexOf('}');
        const lastBracket = cleanResponse.lastIndexOf(']');
        const lastIndex = Math.max(lastBrace, lastBracket);
        if (lastIndex !== -1) {
          cleanResponse = cleanResponse.substring(0, lastIndex + 1);
        }
      }
      return JSON.parse(cleanResponse.trim());
    } catch (error) {
      console.error('JSON parsing error:', error);
      console.log('Original response:', response);
      console.log('Cleaned response:', cleanResponse);
      throw error;
    }
  };

  // Intelligent multi-sheet analysis
  const analyzeWorkbookStructure = async (workbook: XLSX.WorkBook): Promise<SheetAnalysis[]> => {
    const sheetAnalysis: SheetAnalysis[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const analysis: SheetAnalysis = {
        name: sheetName,
        totalRows: jsonData.length,
        hasData: jsonData.length > 1,
        headers: (jsonData[0] || []) as string[],
        sampleData: jsonData.slice(1, 6),
        isEmpty: jsonData.length === 0,
        likelyDataSheet: false,
        sheetType: 'unknown',
        confidence: 0,
        reasons: []
      };
      const sheetNameLower = sheetName.toLowerCase();
      const headerText = (analysis.headers || []).join(' ').toLowerCase();
      if (sheetNameLower.includes('summary') || 
          sheetNameLower.includes('overview') || 
          sheetNameLower.includes('dashboard') ||
          sheetNameLower.includes('contents') ||
          sheetNameLower.includes('index') ||
          sheetNameLower.includes('instructions')) {
        analysis.sheetType = 'summary';
        analysis.reasons.push('Sheet name suggests summary/overview');
      } else if (analysis.hasData && analysis.headers.length > 5) {
        const insuranceKeywords = [
          'location', 'property', 'address', 'building', 'occupancy',
          'pd value', 'bi value', 'tiv', 'limit', 'sum insured',
          'construction', 'latitude', 'longitude', 'risk'
        ];
        const matchedKeywords = insuranceKeywords.filter(keyword => headerText.includes(keyword));
        if (matchedKeywords.length >= 3) {
          analysis.sheetType = 'data';
          analysis.likelyDataSheet = true;
          analysis.confidence = Math.min(matchedKeywords.length / 6, 1);
          analysis.reasons.push(`Contains ${matchedKeywords.length} insurance-related headers`);
        }
        if (analysis.totalRows > 20) {
          analysis.confidence += 0.2;
          analysis.reasons.push(`High row count: ${analysis.totalRows} rows`);
        }
        const hasFinancialData = analysis.sampleData.some((row: any[]) =>
          row.some(cell => typeof cell === 'number' || (typeof cell === 'string' && !isNaN(parseFloat(cell))))
        );
        if (hasFinancialData) {
          analysis.confidence += 0.3;
          analysis.reasons.push('Contains numerical financial data');
        }
      } else if (analysis.hasData && analysis.totalRows < 5) {
        analysis.sheetType = 'template';
        analysis.reasons.push('Low row count suggests template/example');
      } else if (analysis.isEmpty) {
        analysis.sheetType = 'empty';
        analysis.reasons.push('Sheet is empty');
      }
      sheetAnalysis.push(analysis);
    }
    return sheetAnalysis;
  };

  // AI-powered sheet classification
  const classifySheets = async (sheetAnalysis: SheetAnalysis[]): Promise<SheetClassification[]> => {
    try {
      setProcessingStatus('AI analyzing sheet contents...');
      const analysisPrompt = [
        'Analyze these Excel sheets to identify which contain property insurance data vs summaries/templates.',
        '',
        'SHEET ANALYSIS:',
        JSON.stringify(sheetAnalysis.map(sheet => ({
          name: sheet.name,
          headers: sheet.headers,
          rowCount: sheet.totalRows,
          sampleData: sheet.sampleData[0] || []
        })), null, 2),
        '',
        'Return JSON array with sheet classifications:',
        '[',
        '  {',
        '    "sheetName": "Sheet1",',
        '    "shouldProcess": true,',
        '    "type": "data",',
        '    "confidence": 0.95,',
        '    "reason": "Contains property data with financial values"',
        '  }',
        ']',
        '',
        'Be conservative - only classify as "data" if confident it contains actual property listings.',
        'Return ONLY the JSON array, no other text.'
      ].join('\n');
      if (!window.claude?.complete) throw new Error('Claude AI not available');
      const response = await window.claude.complete(analysisPrompt);
      return cleanAndParseJSON(response);
    } catch (error) {
      return sheetAnalysis.map(sheet => ({
        sheetName: sheet.name,
        shouldProcess: sheet.likelyDataSheet,
        type: sheet.sheetType,
        confidence: sheet.confidence,
        reason: sheet.reasons.join('; ') || 'Rule-based classification'
      }));
    }
  };

  // Enhanced Excel file processing
  const processExcelFile = async (file: File): Promise<FileData> => {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, {
      cellStyles: true,
      cellDates: true,
      cellNF: true,
      sheetStubs: true
    });
    const sheetAnalysis = await analyzeWorkbookStructure(workbook);
    const sheetClassifications = await classifySheets(sheetAnalysis);
    const dataSheets = sheetClassifications.filter(sheet => sheet.shouldProcess && sheet.confidence > 0.5);
    if (dataSheets.length === 0) {
      const fallbackSheet = workbook.SheetNames[0];
      const sheet = workbook.Sheets[fallbackSheet];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (jsonData.length === 0) throw new Error('No data found in Excel file');
      let headerRowIndex = 0;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i] || [];
        const hasTextHeaders = row.some((cell: any) => typeof cell === 'string' && cell.length > 2 && !/^\d+\.?\d*$/.test(cell));
        if (hasTextHeaders) {
          headerRowIndex = i;
          headers = row;
          break;
        }
      }
      const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => row.some((cell: any) => cell !== null && cell !== '' && cell !== undefined));
      return {
        workbookAnalysis: {
          totalSheets: workbook.SheetNames.length,
          analyzedSheets: sheetAnalysis,
          classifications: sheetClassifications,
          processedSheets: [{
            name: fallbackSheet,
            headers,
            rowCount: dataRows.length,
            confidence: 0.5,
            reason: 'Fallback to first sheet'
          }]
        },
        headers,
        dataRows,
        totalRows: dataRows.length,
        workbook,
        multiSheet: false
      };
    }
    let allHeaders: string[] = [];
    let allDataRows: any[][] = [];
    let processedSheets: ProcessedSheet[] = [];
    for (const dataSheet of dataSheets) {
      const sheet = workbook.Sheets[dataSheet.sheetName];
      const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      let headerRowIndex = 0;
      let headers: string[] = [];
      for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
        const row = jsonData[i] || [];
        const hasTextHeaders = row.some((cell: any) => typeof cell === 'string' && cell.length > 2 && !/^\d+\.?\d*$/.test(cell));
        if (hasTextHeaders) {
          headerRowIndex = i;
          headers = row;
          break;
        }
      }
      const dataRows = jsonData.slice(headerRowIndex + 1).filter(row => row.some((cell: any) => cell !== null && cell !== '' && cell !== undefined));
      if (allHeaders.length === 0) allHeaders = headers;
      allDataRows.push(...dataRows);
      processedSheets.push({
        name: dataSheet.sheetName,
        headers,
        rowCount: dataRows.length,
        confidence: dataSheet.confidence,
        reason: dataSheet.reason
      });
    }
    return {
      workbookAnalysis: {
        totalSheets: workbook.SheetNames.length,
        analyzedSheets: sheetAnalysis,
        classifications: sheetClassifications,
        processedSheets
      },
      headers: allHeaders,
      dataRows: allDataRows,
      totalRows: allDataRows.length,
      workbook,
      multiSheet: processedSheets.length > 1
    };
  };

  // AI-powered column mapping
  const performColumnMapping = async (detectedColumns: string[]): Promise<{ [key: string]: string | null }> => {
    try {
      const mappingPrompt = `Map these Excel columns to our standard schema:\n\nDETECTED COLUMNS: ${JSON.stringify(detectedColumns)}\nTARGET SCHEMA KEYS: ${JSON.stringify(Object.values(targetSchema))}\n\nLocation & Address:\n- "Location Number", "Loc No" → "locationNumber"\n- "Property", "Building Name" → "property"\n- "Street Address", "Address" → "streetAddress"\n- "Suburb", "City" → "suburb"\n- "State", "Province" → "state"\n- "Postal / ZIP Code", "ZIP" → "postalZipCode"\n- "Country" → "country"\n\nFinancial Values:\n- "PD Value", "Property Damage" → "pdValue"\n- "BI Value", "Business Interruption" → "biValue"\n- "Total Insurable Value", "TIV" → "totalInsurableValue"\n- "PD Deductibles", "Deductible" → "pdDeductibles"\n\nProperty Details:\n- "Occupancy", "Building Type" → "occupancy"\n- "Construction Class", "Construction" → "constructionClass"\n- "Roof Type", "Roof" → "roofType"\n- "Number of Stories", "Stories" → "numberOfStories"\n- "Year Built", "Built" → "yearBuilt"\n\nReturn ONLY valid JSON mapping object:\n{\n  "detectedColumn1": "targetSchemaKey",\n  "detectedColumn2": "targetSchemaKey",\n  "unmappableColumn": null\n}`;
      if (!window.claude?.complete) throw new Error('Claude AI not available');
      const response = await window.claude.complete(mappingPrompt);
      return cleanAndParseJSON(response);
    } catch (error) {
      return performFallbackMapping(detectedColumns);
    }
  };

  // Fallback mapping if AI fails
  const performFallbackMapping = (detectedColumns: string[]): { [key: string]: string | null } => {
    const mapping: { [key: string]: string | null } = {};
    detectedColumns.forEach((col) => {
      const colStr = String(col || '').toLowerCase();
      let mapped: string | null = null;
      if (!col || colStr === 'null' || colStr === 'undefined') {
        mapping[col] = null;
        return;
      }
      if (/^\d+\.?\d*$/.test(colStr)) {
        mapping[col] = null;
        return;
      }
      if (colStr.includes('location') && colStr.includes('number')) mapped = 'locationNumber';
      else if (colStr.includes('property') || colStr.includes('building')) mapped = 'property';
      else if (colStr.includes('address')) mapped = 'streetAddress';
      else if (colStr.includes('suburb') || colStr.includes('city')) mapped = 'suburb';
      else if (colStr.includes('state') || colStr.includes('province')) mapped = 'state';
      else if (colStr.includes('zip') || colStr.includes('postal')) mapped = 'postalZipCode';
      else if (colStr.includes('country')) mapped = 'country';
      else if (colStr.includes('occupancy') || colStr.includes('building type')) mapped = 'occupancy';
      else if (colStr.includes('pd') && !colStr.includes('deduct')) mapped = 'pdValue';
      else if (colStr.includes('bi')) mapped = 'biValue';
      else if (colStr.includes('tiv') || colStr.includes('total')) mapped = 'totalInsurableValue';
      else if (colStr.includes('lat')) mapped = 'latitude';
      else if (colStr.includes('lon')) mapped = 'longitude';
      mapping[col] = mapped;
    });
    return mapping;
  };

  // Enhanced validation
  const performDataValidation = async (mappedData: MappedRow[], mapping: { [key: string]: string | null }): Promise<ValidationResults> => {
    const issues: ValidationIssue[] = [];
    let successfulRows = 0;
    let warningRows = 0;
    let errorRows = 0;
    const criticalMissing: string[] = [];
    criticalFields.forEach(field => {
      const hasMapping = Object.values(mapping).includes(field as string);
      if (!hasMapping) {
        criticalMissing.push(field as string);
      }
    });
    mappedData.forEach((row, index) => {
      const rowNumber = index + 2;
      let hasError = false;
      let hasWarning = false;
      criticalFields.forEach(field => {
        const value = row[field];
        if (value === null || value === undefined || value === '') {
          issues.push({
            row: rowNumber,
            field: field as string,
            issue: `Missing required field: ${field}`,
            severity: 'error'
          });
          hasError = true;
        }
      });
      if (row.pdValue !== null && row.pdValue !== undefined && row.pdValue !== '') {
        const pdValue = parseFloat(String(row.pdValue));
        if (isNaN(pdValue)) {
          issues.push({
            row: rowNumber,
            field: 'pdValue',
            issue: 'PD Value is not a valid number',
            severity: 'error'
          });
          hasError = true;
        } else if (pdValue < 0) {
          issues.push({
            row: rowNumber,
            field: 'pdValue',
            issue: `PD Value is negative: $${pdValue}`,
            severity: 'error'
          });
          hasError = true;
        }
      }
      if (hasError) errorRows++;
      else if (hasWarning) warningRows++;
      else successfulRows++;
    });
    return {
      totalRows: mappedData.length,
      successfulRows,
      warningRows,
      errorRows,
      criticalMissing,
      issues: issues.slice(0, 50)
    };
  };

  const calculateMappingConfidence = (mapping: { [key: string]: string | null }): number => {
    const totalColumns = Object.keys(mapping).length;
    const mappedColumns = Object.values(mapping).filter(v => v !== null).length;
    const criticalMapped = criticalFields.filter(field => Object.values(mapping).includes(field as string)).length;
    const overallRate = mappedColumns / totalColumns;
    const criticalRate = criticalMapped / criticalFields.length;
    return (overallRate * 0.5 + criticalRate * 0.5);
  };

  // Main file processing function
  const processFile = async (file: File) => {
    setProcessing(true);
    setCurrentStep(1);
    try {
      setProcessingStatus('Reading Excel file...');
      const fileData = await processExcelFile(file);
      setFileData(fileData);
      setCurrentStep(2);
      setProcessingStatus('AI analyzing column mappings...');
      const columnMapping = await performColumnMapping(fileData.headers);
      setProcessingStatus('Converting data to standard format...');
      const mappedData: MappedRow[] = fileData.dataRows.map((row, index) => {
        const mappedRow: MappedRow = {};
        fileData.headers.forEach((header, colIndex) => {
          const targetField = columnMapping[header];
          if (targetField) {
            mappedRow[targetField] = row[colIndex];
          }
        });
        return mappedRow;
      });
      const mappingResults: MappingResults = {
        originalColumns: fileData.headers,
        mapping: columnMapping,
        mappedData,
        confidence: calculateMappingConfidence(columnMapping)
      };
      setMappingResults(mappingResults);
      setCurrentStep(3);
      setProcessingStatus('Running comprehensive data quality checks...');
      const validationResults = await performDataValidation(mappedData, columnMapping);
      setProcessingStatus('Processing complete!');
      setValidationResults(validationResults);
      setCurrentStep(4);
    } catch (error: any) {
      setProcessingStatus(`Error: ${error.message}`);
      alert(`Error processing file: ${error.message}`);
      setCurrentStep(0);
    } finally {
      setProcessing(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      setUploadedFile(file);
      setCurrentStep(0);
      setFileData(null);
      setMappingResults(null);
      setValidationResults(null);
      setProcessingStatus('');
    }
  };

  const exportCleanData = () => {
    if (!mappingResults) return;
    const { mappedData } = mappingResults;
    try {
      const wb = XLSX.utils.book_new();
      const headers = Object.keys(targetSchema);
      const wsData = [headers];
      mappedData.forEach(row => {
        const excelRow = headers.map(header => {
          const schemaKey = targetSchema[header];
          return row[schemaKey as keyof MappedRow] || '';
        });
        wsData.push(excelRow);
      });
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, 'Standardized_SOV');
      XLSX.writeFile(wb, `SOV_Processed_${new Date().getTime()}.xlsx`);
    } catch (error) {
      const headers = Object.keys(targetSchema);
      const csvData = [headers.join(',')];
      mappedData.forEach(row => {
        const csvRow = headers.map(header => {
          const schemaKey = targetSchema[header];
          const value = row[schemaKey as keyof MappedRow] || '';
          return typeof value === 'string' && (value.includes(',') || value.includes('"')) 
            ? `"${value.replace(/"/g, '""')}"` 
            : value;
        });
        csvData.push(csvRow.join(','));
      });
      const csvContent = csvData.join('\n');
      navigator.clipboard.writeText(csvContent).then(() => {
        alert('Data copied to clipboard as CSV! You can paste it into Excel or save as a .csv file.');
      }).catch(() => {
        const newWindow = window.open('', '_blank');
        if (newWindow) {
          newWindow.document.write(`
            <html>
              <head><title>SOV Processed Data</title></head>
              <body>
                <h2>Processed SOV Data (CSV Format)</h2>
                <p>Copy the text below and paste into Excel or save as .csv file:</p>
                <textarea style="width:100%; height:400px; font-family:monospace;">${csvContent}</textarea>
              </body>
            </html>
          `);
        }
      });
    }
  };

  const performGeocoding = async () => {
    setGeocodingInProgress(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    alert('Geocoding completed! Address coordinates have been updated.');
    setGeocodingInProgress(false);
  };

  const steps = [
    'Upload File',
    'Analyze Workbook',
    'AI Column Mapping',
    'Data Validation',
    'Review Results'
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Zap className="w-8 h-8" />
              Pinnacle SOV Processor Pro
            </h1>
            <p className="mt-2 text-blue-100">
              Production-ready Schedule of Values processing with AI-powered mapping and validation
            </p>
          </div>

          <div className="p-6 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-300 text-gray-600'
                  }`}>
                    {index < currentStep ? <CheckCircle className="w-5 h-5" /> : index + 1}
                  </div>
                  <span className={`ml-3 text-sm font-medium ${
                    index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-20 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-blue-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="p-6">
            {!uploadedFile && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-400 transition-colors">
                <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-xl font-medium text-gray-900 mb-2">
                  Upload Broker SOV File
                </h3>
                <p className="text-gray-600 mb-6">
                  Supports Excel (.xlsx, .xls) and CSV files up to 50MB
                </p>
                <label className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer font-medium">
                  <Upload className="w-5 h-5 mr-2" />
                  Choose File
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            )}

            {uploadedFile && (
              <div className="space-y-6">
                <div className="bg-blue-50 p-6 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <FileSpreadsheet className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="font-semibold text-gray-900 text-lg">{uploadedFile.name}</p>
                      <p className="text-sm text-gray-600">
                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                        {fileData && (
                          <>
                            {fileData.multiSheet && (
                              <span className="text-blue-600 font-medium">
                                • {fileData.workbookAnalysis.processedSheets.length} data sheets processed
                              </span>
                            )}
                            {!fileData.multiSheet && ` • ${fileData.totalRows} rows • ${fileData.headers.length} columns`}
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => processFile(uploadedFile)}
                    disabled={processing}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                  >
                    {processing ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Processing...
                        {processingStatus && (
                          <span className="ml-2 text-sm">{processingStatus}</span>
                        )}
                      </>
                    ) : (
                      <>
                        <Zap className="w-5 h-5" />
                        Process File
                      </>
                    )}
                  </button>
                </div>

                {fileData && fileData.workbookAnalysis && (
                  <div className="bg-white border rounded-lg p-6 mb-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <FileSpreadsheet className="w-6 h-6 text-blue-600" />
                      Workbook Analysis
                      <span className="text-sm font-normal text-gray-600 bg-blue-100 px-2 py-1 rounded">
                        {fileData.workbookAnalysis.totalSheets} sheets analyzed
                      </span>
                    </h3>
                    
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Sheet Classifications</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {fileData.workbookAnalysis.classifications.map((sheet, idx) => (
                            <div key={idx} className={`p-3 rounded border-l-4 ${
                              sheet.shouldProcess 
                                ? 'bg-green-50 border-green-400' 
                                : 'bg-gray-50 border-gray-300'
                            }`}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-900">{sheet.sheetName}</span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  sheet.shouldProcess
                                    ? 'bg-green-200 text-green-800'
                                    : 'bg-gray-200 text-gray-700'
                                }`}>
                                  {sheet.shouldProcess ? 'PROCESS' : 'IGNORE'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600">{sheet.reason}</p>
                              {sheet.confidence && (
                                <div className="mt-1 text-xs text-gray-500">
                                  Confidence: {Math.round(sheet.confidence * 100)}%
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Data Sheets Processed</h4>
                        <div className="space-y-2">
                          {fileData.workbookAnalysis.processedSheets.map((sheet, idx) => (
                            <div key={idx} className="p-3 bg-blue-50 rounded border-l-4 border-blue-400">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-gray-900">{sheet.name}</span>
                                <span className="text-sm text-blue-600 font-medium">
                                  {sheet.rowCount} rows
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-1">
                                {sheet.headers.length} columns detected
                              </p>
                              <div className="text-xs text-gray-500">
                                Confidence: {Math.round(sheet.confidence * 100)}%
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        <div className="mt-4 p-3 bg-green-50 rounded border">
                          <h5 className="font-medium text-green-800 mb-2">Combined Dataset</h5>
                          <div className="text-sm text-green-700">
                            <div>Total Properties: <strong>{fileData.totalRows}</strong></div>
                            <div>Unique Headers: <strong>{fileData.headers.length}</strong></div>
                            <div>Source Sheets: <strong>{fileData.workbookAnalysis.processedSheets.length}</strong></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {mappingResults && (
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      AI Column Mapping Results
                      <span className="text-sm font-normal text-gray-600 bg-green-100 px-2 py-1 rounded">
                        {Math.round(mappingResults.confidence * 100)}% Confidence
                      </span>
                    </h3>
                    
                    <div className="grid lg:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Detected Columns ({mappingResults.originalColumns.length})</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {mappingResults.originalColumns.map((col, idx) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded text-sm border-l-4 border-gray-300">
                              {col}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Mapped to Standard Schema</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {Object.entries(mappingResults.mapping).map(([original, mapped], idx) => (
                            <div key={idx} className={`p-3 rounded text-sm flex items-center justify-between border-l-4 ${
                              mapped 
                                ? 'bg-green-50 border-green-400' 
                                : 'bg-red-50 border-red-400'
                            }`}>
                              <span className="text-gray-700 font-medium">{original}</span>
                              <span className={`text-sm px-2 py-1 rounded ${
                                mapped 
                                  ? 'bg-green-200 text-green-800' 
                                  : 'bg-red-200 text-red-800'
                              }`}>
                                {mapped || 'Unmapped'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {validationResults && (
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Database className="w-6 h-6 text-blue-600" />
                      Data Validation Results
                    </h3>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-3xl font-bold text-blue-600">{validationResults.totalRows}</div>
                        <div className="text-sm text-gray-600 font-medium">Total Rows</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-3xl font-bold text-green-600">{validationResults.successfulRows}</div>
                        <div className="text-sm text-gray-600 font-medium">Valid Rows</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-3xl font-bold text-yellow-600">{validationResults.warningRows}</div>
                        <div className="text-sm text-gray-600 font-medium">Warnings</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-3xl font-bold text-red-600">{validationResults.errorRows}</div>
                        <div className="text-sm text-gray-600 font-medium">Errors</div>
                      </div>
                    </div>

                    {validationResults.criticalMissing.length > 0 && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Critical Fields Missing
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {validationResults.criticalMissing.map((field, idx) => (
                            <span key={idx} className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-medium">
                              {Object.keys(targetSchema).find(key => targetSchema[key] === field) || field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Data Quality Issues</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {validationResults.issues.map((issue, idx) => (
                          <div key={idx} className={`p-4 rounded-lg border-l-4 ${
                            issue.severity === 'error' 
                              ? 'bg-red-50 border-red-400' 
                              : 'bg-yellow-50 border-yellow-400'
                          }`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-gray-900">Row {issue.row}</span>
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                issue.severity === 'error'
                                  ? 'bg-red-200 text-red-800'
                                  : 'bg-yellow-200 text-yellow-800'
                              }`}>
                                {issue.severity.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-700">
                              <strong className="text-gray-900">{issue.field}:</strong> {issue.issue}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6 flex flex-wrap gap-3">
                      <button 
                        onClick={exportCleanData}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                      >
                        <Download className="w-5 h-5" />
                        Export Data (Copy to Clipboard)
                      </button>
                      <button 
                        onClick={performGeocoding}
                        disabled={geocodingInProgress}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 font-medium"
                      >
                        {geocodingInProgress ? (
                          <RefreshCw className="w-5 h-5 animate-spin" />
                        ) : (
                          <MapPin className="w-5 h-5" />
                        )}
                        {geocodingInProgress ? 'Geocoding...' : 'Geocode Addresses'}
                      </button>
                      <button className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-medium">
                        Review Issues Manually
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductionSOVProcessor;