Analyze these Excel sheets to identify which contain property insurance data vs summaries/templates.
        
        SHEET ANALYSIS:e
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