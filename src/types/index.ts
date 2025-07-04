// Type definitions for the SOV Processor

export interface TargetSchema {
  [key: string]: string;
}

export interface FileData {
  workbookAnalysis: {
    totalSheets: number;
    analyzedSheets: SheetAnalysis[];
    classifications: SheetClassification[];
    processedSheets: ProcessedSheet[];
  };
  headers: string[];
  dataRows: any[][];
  totalRows: number;
  workbook: any;
  multiSheet: boolean;
}

export interface SheetAnalysis {
  name: string;
  totalRows: number;
  hasData: boolean;
  headers: string[];
  sampleData: any[][];
  isEmpty: boolean;
  likelyDataSheet: boolean;
  sheetType: string;
  confidence: number;
  reasons: string[];
}

export interface SheetClassification {
  sheetName: string;
  shouldProcess: boolean;
  type: string;
  confidence: number;
  reason: string;
}

export interface ProcessedSheet {
  name: string;
  headers: string[];
  rowCount: number;
  confidence: number;
  reason: string;
}

export interface MappingResults {
  originalColumns: string[];
  mapping: { [key: string]: string | null };
  mappedData: any[];
  confidence: number;
}

export interface ValidationResults {
  totalRows: number;
  successfulRows: number;
  warningRows: number;
  errorRows: number;
  criticalMissing: string[];
  issues: ValidationIssue[];
}

export interface ValidationIssue {
  row: number;
  field: string;
  issue: string;
  severity: 'error' | 'warning';
}

export interface MappedRow {
  locationNumber?: string;
  property?: string;
  streetAddress?: string;
  suburb?: string;
  state?: string;
  postalZipCode?: string;
  crestaZone?: string;
  country?: string;
  occupancy?: string;
  pdValue?: string | number;
  pdDeductibles?: string | number;
  biValue?: string | number;
  totalInsurableValue?: string | number;
  latitude?: string | number;
  longitude?: string | number;
  constructionClass?: string;
  roofType?: string;
  numberOfStories?: string | number;
  yearBuilt?: string | number;
  fluvialFlood?: string;
  originalStormSurge?: string;
  originalPfRiskLevel?: string;
  windstorm?: string;
  hailstorm?: string;
  wildfire?: string;
  severity?: string;
  [key: string]: any;
}

// Extend Window interface for Claude AI
declare global {
  interface Window {
    claude?: {
      complete: (prompt: string) => Promise<string>;
    };
  }
} 