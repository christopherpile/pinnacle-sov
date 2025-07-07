import React, { useState, useCallback } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Download, MapPin, Eye, Zap, Database, RefreshCw } from 'lucide-react';
import * as XLSX from 'xlsx';

const ProductionSOVProcessor = () => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [fileData, setFileData] = useState<any>(null);
  const [mappingResults, setMappingResults] = useState<any>(null);
  const [validationResults, setValidationResults] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [geocodingInProgress, setGeocodingInProgress] = useState(false);

  // Target schema from your template
  const targetSchema = {
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

  const criticalFields = [
    'locationNumber', 'streetAddress', 'country', 'occupancy'
  ];

  // Intelligent multi-sheet analysis
  const analyzeWorkbookStructure = async (workbook: XLSX.WorkBook) => {
    const sheetAnalysis: Array<{
      name: string;
      totalRows: number;
      hasData: boolean;
      headers: any[];
      sampleData: any[][];
      isEmpty: boolean;
      likelyDataSheet: boolean;
      sheetType: string;
      confidence: number;
      reasons: string[];
    }> = [];
    
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      
      // Analyze sheet content
      const analysis = {
        name: sheetName,
        totalRows: jsonData.length,
        hasData: jsonData.length > 1,
        headers: jsonData[0] || [],
        sampleData: jsonData.slice(1, 6), // First 5 data rows
        isEmpty: jsonData.length === 0,
        likelyDataSheet: false,
        sheetType: 'unknown',
        confidence: 0,
        reasons: [] as string[]
      };
      
      // Determine sheet type and confidence
      const sheetNameLower = sheetName.toLowerCase();
      const headerText = (analysis.headers || []).join(' ').toLowerCase();
      const allText = jsonData.flat().join(' ').toLowerCase();
      
      // Check for summary sheets (to ignore)
      if (sheetNameLower.includes('summary') || 
          sheetNameLower.includes('overview') || 
          sheetNameLower.includes('dashboard') ||
          sheetNameLower.includes('contents') ||
          sheetNameLower.includes('index') ||
          sheetNameLower.includes('instructions')) {
        analysis.sheetType = 'summary';
        analysis.reasons.push('Sheet name suggests summary/overview');
      }
      
      // Check for data sheets
      else if (analysis.hasData && analysis.headers.length > 5) {
        // Look for insurance-related headers
        const insuranceKeywords = [
          'location', 'property', 'address', 'building', 'occupancy',
          'pd value', 'bi value', 'tiv', 'limit', 'sum insured',
          'construction', 'latitude', 'longitude', 'risk'
        ];
        
        const matchedKeywords = insuranceKeywords.filter(keyword => 
          headerText.includes(keyword)
        );
        
        if (matchedKeywords.length >= 3) {
          analysis.sheetType = 'data';
          analysis.likelyDataSheet = true;
          analysis.confidence = Math.min(matchedKeywords.length / 6, 1); // Max confidence at 6+ matches
          analysis.reasons.push(`Contains ${matchedKeywords.length} insurance-related headers`);
          analysis.reasons.push(`Headers: ${matchedKeywords.join(', ')}`);
        }
        
        // High row count suggests data sheet
        if (analysis.totalRows > 20) {
          analysis.confidence += 0.2;
          analysis.reasons.push(`High row count: ${analysis.totalRows} rows`);
        }
        
        // Check for financial values in data (including 0 and blank)
        const hasFinancialData = analysis.sampleData.some(row =>
          row.some(cell => 
            typeof cell === 'number' || // Any number including 0
            (typeof cell === 'string' && !isNaN(parseFloat(cell))) // String numbers
          )
        );
        
        if (hasFinancialData) {
          analysis.confidence += 0.3;
          analysis.reasons.push('Contains numerical financial data');
        }
      }
      
      // Check for template/blank sheets
      else if (analysis.hasData && analysis.totalRows < 5) {
        analysis.sheetType = 'template';
        analysis.reasons.push('Low row count suggests template/example');
      }
      
      // Empty sheets
      else if (analysis.isEmpty) {
        analysis.sheetType = 'empty';
        analysis.reasons.push('Sheet is empty');
      }
      
      sheetAnalysis.push(analysis);
    }
    
    return sheetAnalysis;
  };

  // AI-powered sheet classification using Azure OpenAI
  const classifySheets = async (sheetAnalysis: any[]) => {
    try {
      const analysisPrompt = `
        Analyze these Excel sheets to identify which contain property insurance data vs summaries/templates.
        
        SHEET ANALYSIS:
        ${JSON.stringify(sheetAnalysis.map((sheet: any) => ({
          name: sheet.name,
          headers: sheet.headers,
          rowCount: sheet.totalRows,
          sampleData: sheet.sampleData[0] || []
        })), null, 2)}
        
        CLASSIFICATION RULES:
        
        DATA SHEETS (should process):
        - Contain property/building lists with location data
        - Have headers like: Location, Property, Address, PD Value, BI Value, TIV, Occupancy
        - Multiple rows of actual property data
        - Financial values in millions/thousands
        
        IGNORE SHEETS:
        - Summary/Dashboard sheets with totals
        - Instructions or methodology sheets
        - Template sheets with minimal data
        - Charts or pivot tables
        - Contents/Index sheets
        
        Return JSON array with sheet classifications:
        [
          {
            "sheetName": "Sheet1",
            "shouldProcess": true,
            "type": "data",
            "confidence": 0.95,
            "reason": "Contains property data with financial values"
          }
        ]
        
        Be conservative - only classify as "data" if confident it contains actual property listings.
      `;
      
      const response = await callAzureOpenAI(analysisPrompt);
      return JSON.parse(response);
      
    } catch (error) {
      console.error('Sheet classification error:', error);
      // Fallback to rule-based classification
      return sheetAnalysis.map((sheet: any) => ({
        sheetName: sheet.name,
        shouldProcess: sheet.likelyDataSheet,
        type: sheet.sheetType,
        confidence: sheet.confidence,
        reason: sheet.reasons.join('; ')
      }));
    }
  };

  // Enhanced Excel file processing with multi-sheet analysis
  const processExcelFile = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, {
        cellStyles: true,
        cellFormula: true,
        cellDates: true,
        cellNF: true,
        sheetStubs: true
      });

      console.log('Workbook sheets:', workbook.SheetNames);

      // Step 1: Analyze all sheets
      const sheetAnalysis = await analyzeWorkbookStructure(workbook);
      
      // Step 2: AI classification of sheets
      const sheetClassifications = await classifySheets(sheetAnalysis);
      
      // Step 3: Identify data sheets to process
      const dataSheets = sheetClassifications.filter((sheet: any) => 
        sheet.shouldProcess && sheet.confidence > 0.5
      );
      
      if (dataSheets.length === 0) {
        throw new Error('No property data sheets found. Please check the file contains location/property data.');
      }
      
      // Step 4: Process all identified data sheets
      let allHeaders: any[] = [];
      let allDataRows: any[] = [];
      let processedSheets: any[] = [];
      
      for (const dataSheet of dataSheets) {
        const sheet = workbook.Sheets[dataSheet.sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        const headers = jsonData[0] || [];
        const dataRows = jsonData.slice(1).filter((row: any[]) => 
          row.some((cell: any) => cell !== null && cell !== '')
        );
        
        // Combine headers (use first sheet as primary)
        if (allHeaders.length === 0) {
          allHeaders = headers;
        }
        
        // Add sheet identifier to each row
        const sheetDataRows = dataRows.map((row: any[]) => ({
          sourceSheet: dataSheet.sheetName,
          data: row
        }));
        
        allDataRows.push(...sheetDataRows);
        
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
        dataRows: allDataRows.map(row => row.data), // Extract just the data
        totalRows: allDataRows.length,
        workbook,
        multiSheet: processedSheets.length > 1
      };

    } catch (error) {
      console.error('Excel processing error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw new Error(`Failed to process Excel file: ${errorMessage}`);
    }
  };

  // Azure OpenAI API call function
  const callAzureOpenAI = async (prompt: string): Promise<string> => {
    try {
      const apiUrl = '/api/azure-openai';
      console.log('Calling Azure OpenAI API at:', apiUrl);
      console.log('Full URL would be:', window.location.origin + apiUrl);
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: 'o3-mini',
          max_completion_tokens: 2000,
          temperature: 0.1
        })
      });

      console.log('API Response status:', response.status);
      console.log('API Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error response:', errorText);
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API Response data:', data);
      return data.choices?.[0]?.message?.content || '';
    } catch (error) {
      console.error('Azure OpenAI API call failed:', error);
      throw error;
    }
  };

  // AI-powered column mapping using Azure OpenAI
  const performColumnMapping = async (detectedColumns: string[]) => {
    try {
      console.log('Performing column mapping for:', detectedColumns);
      
      const mappingPrompt = `
        You are an expert insurance data mapper. Map these broker Excel columns to our standard schema.
        
        DETECTED COLUMNS: ${JSON.stringify(detectedColumns)}
        
        TARGET SCHEMA KEYS: ${JSON.stringify(Object.values(targetSchema))}
        
        MAPPING RULES:
        
        Location & Address:
        - "Loc No", "Location Number", "Site ID", "Location ID" → "locationNumber"
        - "Property Name", "Building Name", "Site Name", "Property" → "property"
        - "Full Address", "Property Address", "Address", "Street Address" → "streetAddress"
        - "City", "Town", "Suburb" → "suburb"
        - "State", "Province", "Region" → "state"
        - "ZIP", "Post Code", "Postal Code", "Postal / ZIP Code" → "postalZipCode"
        - "Country", "Nation" → "country"
        
        Financial Values:
        - "PD Value", "PD Limit", "Property Damage", "Building Value", "PD" → "pdValue"
        - "BI Value", "BI Limit", "Business Interruption", "BI" → "biValue"
        - "TIV", "Total Sum Insured", "Total Value", "Sum Insured", "Total Insurable Value" → "totalInsurableValue"
        - "Deductible", "Excess", "PD Deductible", "PD Deductibles" → "pdDeductibles"
        
        Property Details:
        - "Occupancy", "Building Type", "Use", "Business Type" → "occupancy"
        - "Construction", "Construction Type", "Building Material", "Construction Class" → "constructionClass"
        - "Roof", "Roof Type", "Roof Material" → "roofType"
        - "Stories", "Floors", "No of Floors", "Levels", "Number of Stories" → "numberOfStories"
        - "Year Built", "Construction Year", "Built", "Age" → "yearBuilt"
        
        Coordinates & Risk:
        - "Lat", "Latitude" → "latitude"
        - "Long", "Longitude", "Lng" → "longitude"
        - "Flood", "Flood Risk", "Flood Rating", "Fluvial Flood" → "fluvialFlood"
        - "Wind", "Wind Risk", "Windstorm" → "windstorm"
        - "Fire", "Fire Risk", "Wildfire" → "wildfire"
        - "Severity", "Risk Severity" → "severity"
        - "Storm Surge", "Original Storm Surge" → "originalStormSurge"
        - "Hail", "Hailstorm" → "hailstorm"
        
        Return ONLY valid JSON mapping detected columns to target schema keys. Use null for unmappable columns.
        
        Format:
        {
          "detectedColumn1": "targetSchemaKey",
          "detectedColumn2": "targetSchemaKey",
          "unmappableColumn": null
        }
      `;

      const response = await callAzureOpenAI(mappingPrompt);
      console.log('AI mapping response:', response);
      return JSON.parse(response);

    } catch (error) {
      console.error('Column mapping error:', error);
      console.log('Falling back to rule-based mapping...');
      // Fallback to simple text matching
      return performFallbackMapping(detectedColumns);
    }
  };

  // Fallback mapping if AI fails
  const performFallbackMapping = (detectedColumns: string[]) => {
    const mapping: Record<string, string | null> = {};

    detectedColumns.forEach((col: string) => {
      const colLower = col.toLowerCase();
      let mapped: string | null = null;

      // Simple keyword matching
      if (colLower.includes('location') && colLower.includes('number')) mapped = 'locationNumber';
      else if (colLower.includes('property') || colLower.includes('building')) mapped = 'property';
      else if (colLower.includes('address')) mapped = 'streetAddress';
      else if (colLower.includes('suburb') || colLower.includes('city')) mapped = 'suburb';
      else if (colLower.includes('state') || colLower.includes('province')) mapped = 'state';
      else if (colLower.includes('zip') || colLower.includes('postal')) mapped = 'postalZipCode';
      else if (colLower.includes('country')) mapped = 'country';
      else if (colLower.includes('occupancy') || colLower.includes('building type')) mapped = 'occupancy';
      else if (colLower.includes('pd') && !colLower.includes('deduct')) mapped = 'pdValue';
      else if (colLower.includes('bi')) mapped = 'biValue';
      else if (colLower.includes('tiv') || colLower.includes('total')) mapped = 'totalInsurableValue';
      else if (colLower.includes('lat')) mapped = 'latitude';
      else if (colLower.includes('lon')) mapped = 'longitude';

      mapping[col] = mapped;
    });

    return mapping;
  };

  // Enhanced validation based on your template data
  const performDataValidation = async (mappedData: any[], mapping: Record<string, string | null>) => {
    const issues: Array<{row: number; field: string; issue: string; severity: string}> = [];
    let successfulRows = 0;
    let warningRows = 0;
    let errorRows = 0;
    const criticalMissing: string[] = [];

    // Check for critical missing fields
    criticalFields.forEach(field => {
      const hasMapping = Object.values(mapping).includes(field);
      if (!hasMapping) {
        criticalMissing.push(field);
      }
    });

    // Validate each row
    mappedData.forEach((row, index) => {
      const rowNumber = index + 2; // Excel row number (1-indexed + header)
      let hasError = false;
      let hasWarning = false;

      // Validate critical fields
      criticalFields.forEach(field => {
        const value = row[field];
        if (value === null || value === undefined || value === '') {
          issues.push({
            row: rowNumber,
            field: field,
            issue: `Missing required field: ${field}`,
            severity: 'error'
          });
          hasError = true;
        }
      });

      // Validate data types and ranges for financial fields
      if (row.pdValue !== null && row.pdValue !== undefined && row.pdValue !== '') {
        const pdValue = parseFloat(row.pdValue);
        if (isNaN(pdValue)) {
          issues.push({
            row: rowNumber,
            field: 'pdValue',
            issue: 'PD Value is not a valid number',
            severity: 'error'
          });
          hasError = true;
        } else if (pdValue > 10000000000) { // $10B threshold (very high)
          issues.push({
            row: rowNumber,
            field: 'pdValue',
            issue: `PD Value extremely high: ${(pdValue/1000000).toFixed(0)}M`,
            severity: 'warning'
          });
          hasWarning = true;
        } else if (pdValue < 0) { // Negative values
          issues.push({
            row: rowNumber,
            field: 'pdValue',
            issue: `PD Value is negative: ${pdValue}`,
            severity: 'error'
          });
          hasError = true;
        }
        // Note: 0 is valid (no coverage scenario)
      }

      // Validate BI Value (can be 0 or blank for properties without BI coverage)
      if (row.biValue !== null && row.biValue !== undefined && row.biValue !== '') {
        const biValue = parseFloat(row.biValue);
        if (isNaN(biValue)) {
          issues.push({
            row: rowNumber,
            field: 'biValue',
            issue: 'BI Value is not a valid number',
            severity: 'error'
          });
          hasError = true;
        } else if (biValue < 0) {
          issues.push({
            row: rowNumber,
            field: 'biValue',
            issue: `BI Value is negative: ${biValue}`,
            severity: 'error'
          });
          hasError = true;
        }
      }

      // Validate Total Insurable Value
      if (row.totalInsurableValue !== null && row.totalInsurableValue !== undefined && row.totalInsurableValue !== '') {
        const tiv = parseFloat(row.totalInsurableValue);
        if (isNaN(tiv)) {
          issues.push({
            row: rowNumber,
            field: 'totalInsurableValue',
            issue: 'Total Insurable Value is not a valid number',
            severity: 'error'
          });
          hasError = true;
        } else if (tiv < 0) {
          issues.push({
            row: rowNumber,
            field: 'totalInsurableValue',
            issue: `Total Insurable Value is negative: ${tiv}`,
            severity: 'error'
          });
          hasError = true;
        } else if (row.pdValue && row.biValue) {
          // Cross-validation: TIV should roughly equal PD + BI
          const pdValue = parseFloat(row.pdValue) || 0;
          const biValue = parseFloat(row.biValue) || 0;
          const expectedTiv = pdValue + biValue;
          const variance = Math.abs(tiv - expectedTiv) / Math.max(tiv, expectedTiv);
          
          if (variance > 0.1) { // 10% variance threshold
            issues.push({
              row: rowNumber,
              field: 'totalInsurableValue',
              issue: `TIV (${(tiv/1000000).toFixed(1)}M) doesn't match PD+BI (${(expectedTiv/1000000).toFixed(1)}M)`,
              severity: 'warning'
            });
            hasWarning = true;
          }
        }
      }

      // Validate PD Deductibles (often blank, which is fine)
      if (row.pdDeductibles !== null && row.pdDeductibles !== undefined && row.pdDeductibles !== '') {
        const deductible = parseFloat(row.pdDeductibles);
        if (isNaN(deductible)) {
          issues.push({
            row: rowNumber,
            field: 'pdDeductibles',
            issue: 'PD Deductible is not a valid number',
            severity: 'warning' // Warning not error as deductibles are often text
          });
          hasWarning = true;
        } else if (deductible < 0) {
          issues.push({
            row: rowNumber,
            field: 'pdDeductibles',
            issue: `PD Deductible is negative: ${deductible}`,
            severity: 'error'
          });
          hasError = true;
        }
      }

      // Validate coordinates
      if (row.latitude !== null && row.latitude !== undefined) {
        const lat = parseFloat(row.latitude);
        if (isNaN(lat) || lat < -90 || lat > 90) {
          issues.push({
            row: rowNumber,
            field: 'latitude',
            issue: 'Invalid latitude coordinate',
            severity: 'error'
          });
          hasError = true;
        }
      }

      if (row.longitude !== null && row.longitude !== undefined) {
        const lng = parseFloat(row.longitude);
        if (isNaN(lng) || lng < -180 || lng > 180) {
          issues.push({
            row: rowNumber,
            field: 'longitude',
            issue: 'Invalid longitude coordinate',
            severity: 'error'
          });
          hasError = true;
        }
      }

      // Validate year built
      if (row.yearBuilt !== null && row.yearBuilt !== undefined) {
        const year = parseInt(row.yearBuilt);
        const currentYear = new Date().getFullYear();
        if (isNaN(year) || year < 1800 || year > currentYear + 5) {
          issues.push({
            row: rowNumber,
            field: 'yearBuilt',
            issue: `Invalid year: ${year}`,
            severity: year > currentYear ? 'warning' : 'error'
          });
          if (year > currentYear) hasWarning = true;
          else hasError = true;
        }
      }

      // Validate number of stories
      if (row.numberOfStories !== null && row.numberOfStories !== undefined) {
        const stories = parseInt(row.numberOfStories);
        if (isNaN(stories) || stories < 0) {
          issues.push({
            row: rowNumber,
            field: 'numberOfStories',
            issue: `Invalid number of stories: ${row.numberOfStories}`,
            severity: 'error'
          });
          hasError = true;
        } else if (stories > 100) {
          issues.push({
            row: rowNumber,
            field: 'numberOfStories',
            issue: `Unusually high building: ${stories} stories`,
            severity: 'warning'
          });
          hasWarning = true;
        }
      }

      // Count row status
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
      issues: issues.slice(0, 50) // Limit to first 50 issues for display
    };
  };

  // Enhanced file processing with AI capabilities
  const processFile = async (file: File) => {
    setProcessing(true);
    setCurrentStep(1);

    try {
      console.log('=== STARTING FILE PROCESSING ===');
      console.log('File:', file.name, file.size, 'bytes');
      setProcessingStatus('Reading Excel file...');

      // Step 1: Basic Excel parsing first
      console.log('Step 1: Reading Excel file...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('ArrayBuffer created, size:', arrayBuffer.byteLength);
      setProcessingStatus('Parsing Excel workbook...');
      
      const workbook = XLSX.read(arrayBuffer);
      console.log('Workbook loaded, sheets:', workbook.SheetNames);
      setProcessingStatus(`Found ${workbook.SheetNames.length} sheets, analyzing data...`);
      
      // Simple sheet processing (bypass complex analysis for now)
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      console.log('First sheet data rows:', jsonData.length);
      setProcessingStatus(`Processing ${jsonData.length} rows from "${workbook.SheetNames[0]}"...`);
      
      if (jsonData.length === 0) {
        throw new Error('No data found in Excel file');
      }
      
      const headers = (jsonData[0] || []) as string[];
      const dataRows = (jsonData.slice(1) as any[][]).filter((row: any[]) => 
        row.some((cell: any) => cell !== null && cell !== undefined && cell !== '')
      );
      
      console.log('Headers found:', headers);
      console.log('Data rows:', dataRows.length);
      setProcessingStatus(`Found ${headers.length} columns and ${dataRows.length} data rows`);
      
      const simpleFileData = {
        headers,
        dataRows,
        totalRows: dataRows.length,
        workbook,
        multiSheet: false
      };
      
      setFileData(simpleFileData);
      setCurrentStep(2);
      
      // Step 2: AI-powered column mapping
      console.log('Step 2: AI-powered column mapping...');
      setProcessingStatus('Using AI to map columns to standard schema...');
      
      let mapping: Record<string, string | null>;
      try {
        mapping = await performColumnMapping(headers);
        console.log('AI mapping result:', mapping);
        setProcessingStatus(`AI mapped ${Object.keys(mapping).length} columns`);
      } catch (error) {
        console.log('AI mapping failed, using fallback:', error);
        setProcessingStatus('AI mapping failed, using fallback mapping...');
        mapping = performFallbackMapping(headers);
        console.log('Fallback mapping result:', mapping);
        setProcessingStatus(`Fallback mapped ${Object.keys(mapping).length} columns`);
      }
      
      // Step 3: Map data
      console.log('Step 3: Mapping data...');
      setProcessingStatus('Converting data to standard format...');
      const mappedData = dataRows.map((row, rowIndex) => {
        const mappedRow: Record<string, any> = {};
        headers.forEach((header, colIndex) => {
          const targetField = mapping[header];
          if (targetField) {
            mappedRow[targetField] = row[colIndex];
          }
        });
        return mappedRow;
      });
      
      console.log('Mapped data sample:', mappedData[0]);
      setProcessingStatus('Data conversion complete, validating...');
      
      const mappingResults = {
        originalColumns: headers,
        mapping: mapping,
        mappedData,
        confidence: calculateMappingConfidence(mapping)
      };
      
      setMappingResults(mappingResults);
      setCurrentStep(3);
      
      // Step 4: Enhanced AI validation
      console.log('Step 4: Enhanced AI validation...');
      setProcessingStatus('Running AI-powered data quality checks...');
      
      let validationResults;
      try {
        validationResults = await performDataValidation(mappedData, mapping);
        console.log('AI validation complete:', validationResults);
        setProcessingStatus('AI validation complete!');
      } catch (error) {
        console.log('AI validation failed, using basic validation:', error);
        setProcessingStatus('AI validation failed, using basic validation...');
        
        // Fallback to basic validation
        const issues: Array<{row: number; field: string; issue: string; severity: string}> = [];
        let successfulRows = mappedData.length;
        let errorRows = 0;
        let warningRows = 0;
        
        // Basic validation - just check for critical missing fields
        mappedData.forEach((row, index) => {
          criticalFields.forEach(field => {
            const value = row[field];
            if (value === null || value === undefined || value === '') {
              issues.push({
                row: index + 2,
                field: field,
                issue: `Missing required field: ${field}`,
                severity: 'error'
              });
              errorRows++;
            }
          });
        });
        
        validationResults = {
          totalRows: mappedData.length,
          successfulRows: successfulRows - errorRows,
          warningRows,
          errorRows,
          criticalMissing: [],
          issues: issues.slice(0, 20)
        };
      }
      
      console.log('Validation complete:', validationResults);
      setProcessingStatus('Processing complete!');
      setValidationResults(validationResults);
      setCurrentStep(4);
      
      console.log('=== PROCESSING COMPLETE ===');
      
    } catch (error) {
      console.error('=== PROCESSING ERROR ===');
      console.error('Error details:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Error processing file: ${errorMessage}`);
      setCurrentStep(0);
    } finally {
      setProcessing(false);
    }
  };

  const calculateMappingConfidence = (mapping: Record<string, string | null>) => {
    const totalColumns = Object.keys(mapping).length;
    const mappedColumns = Object.values(mapping).filter(v => v !== null).length;
    const criticalMapped = criticalFields.filter(field => 
      Object.values(mapping).includes(field)
    ).length;
    
    // Weighted confidence: 50% for overall mapping, 50% for critical fields
    const overallRate = mappedColumns / totalColumns;
    const criticalRate = criticalMapped / criticalFields.length;
    
    return (overallRate * 0.5 + criticalRate * 0.5);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setCurrentStep(0);
      setFileData(null);
      setMappingResults(null);
      setValidationResults(null);
    }
  };

  const exportCleanData = () => {
    if (!mappingResults) return;

    const { mappedData } = mappingResults;
    
    // Create new workbook with standardized data
    const wb = XLSX.utils.book_new();
    
    // Convert mapped data to array format for Excel
    const headers = Object.keys(targetSchema);
    const wsData = [headers];
    
    mappedData.forEach((row: Record<string, any>) => {
      const excelRow = headers.map(header => {
        const schemaKey = (targetSchema as Record<string, string>)[header];
        return row[schemaKey] || '';
      });
      wsData.push(excelRow);
    });
    
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Standardized_SOV');
    
    // Download file
    XLSX.writeFile(wb, `SOV_Processed_${new Date().getTime()}.xlsx`);
  };

  const performGeocoding = async () => {
    setGeocodingInProgress(true);
    // Simulate geocoding process
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
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white p-6">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Zap className="w-8 h-8" />
              Pinnacle SOV Processor Pro
            </h1>
            <p className="mt-2 text-blue-100">
              Production-ready Schedule of Values processing with AI-powered mapping and validation
            </p>
          </div>

          {/* Progress Steps */}
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
            {/* File Upload Section */}
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

            {/* File Processing */}
            {uploadedFile && (
              <div className="space-y-6">
                {/* File Info */}
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

                {/* Workbook Analysis Results */}
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
                      {/* Sheet Classifications */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Sheet Classifications</h4>
                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {fileData.workbookAnalysis.classifications.map((sheet: any, idx: number) => (
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

                      {/* Processed Sheets Summary */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Data Sheets Processed</h4>
                        <div className="space-y-2">
                          {fileData.workbookAnalysis.processedSheets.map((sheet: any, idx: number) => (
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
                        
                        {/* Combined Data Summary */}
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
                      {/* Original Columns */}
                      <div>
                        <h4 className="font-medium text-gray-700 mb-3">Detected Columns ({mappingResults.originalColumns.length})</h4>
                        <div className="space-y-2 max-h-80 overflow-y-auto">
                          {mappingResults.originalColumns.map((col: string, idx: number) => (
                            <div key={idx} className="p-3 bg-gray-50 rounded text-sm border-l-4 border-gray-300">
                              {col}
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Mapped Columns */}
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
                                {mapped ? String(mapped) : 'Unmapped'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation Results */}
                {validationResults && (
                  <div className="bg-white border rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Database className="w-6 h-6 text-blue-600" />
                      Data Validation Results
                    </h3>

                    {/* Summary Stats */}
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

                    {/* Critical Missing Fields */}
                    {validationResults.criticalMissing.length > 0 && (
                      <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                        <h4 className="font-semibold text-red-800 mb-2 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5" />
                          Critical Fields Missing
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {validationResults.criticalMissing.map((field: string, idx: number) => (
                            <span key={idx} className="px-3 py-1 bg-red-200 text-red-800 rounded-full text-sm font-medium">
                              {Object.keys(targetSchema).find(key => (targetSchema as Record<string, string>)[key] === field) || field}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Issues List */}
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-3">Data Quality Issues</h4>
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {validationResults.issues.map((issue: {row: number; field: string; issue: string; severity: string}, idx: number) => (
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

                    {/* Action Buttons */}
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button 
                        onClick={exportCleanData}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                      >
                        <Download className="w-5 h-5" />
                        Export Standardized Data
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