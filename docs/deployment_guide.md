# Azure Deployment Guide - Pinnacle SOV Processor

Complete guide for deploying the SOV Processor to Azure with AI services integration.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │  Azure AI       │    │  Azure Storage  │
│  (Static Web)   │◄──►│  Services       │    │   & Database    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │              ┌─────────────────┐              │
         └──────────────►│  Azure Maps     │◄─────────────┘
                        │  (Geocoding)    │
                        └─────────────────┘
```

## 🚀 Quick Deployment (Recommended)

### Step 1: Azure AI Foundry Setup
```bash
# 1. Create AI Foundry project
az ai project create \
  --name "pinnacle-sov-processor" \
  --resource-group "pinnacle-rg" \
  --location "Australia East"

# 2. Deploy GPT-4 model
az ai model deploy \
  --project "pinnacle-sov-processor" \
  --model-name "gpt-4" \
  --deployment-name "gpt-4-sov-processor"
```

### Step 2: Static Web App Deployment
```bash
# 1. Build the React app
npm run build

# 2. Deploy to Azure Static Web Apps
az staticwebapp create \
  --name "pinnacle-sov-processor" \
  --resource-group "pinnacle-rg" \
  --source "." \
  --location "Australia East" \
  --branch "main"
```

### Step 3: Configure Environment Variables
```bash
# Set application settings
az staticwebapp appsettings set \
  --name "pinnacle-sov-processor" \
  --setting-names \
    "AZURE_OPENAI_ENDPOINT=https://your-ai-foundry.openai.azure.com/" \
    "AZURE_OPENAI_API_KEY=your_api_key" \
    "AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-sov-processor" \
    "AZURE_MAPS_KEY=your_maps_key"
```

## 🔧 Detailed Setup Instructions

### 1. Resource Group Creation
```bash
# Create resource group
az group create \
  --name "pinnacle-sov-processor-rg" \
  --location "Australia East"
```

### 2. Azure AI Services Setup

#### OpenAI Service
```bash
# Create OpenAI resource
az cognitiveservices account create \
  --name "pinnacle-openai" \
  --resource-group "pinnacle-sov-processor-rg" \
  --location "Australia East" \
  --kind "OpenAI" \
  --sku "S0"

# Get API key
az cognitiveservices account keys list \
  --name "pinnacle-openai" \
  --resource-group "pinnacle-sov-processor-rg"
```

#### Document Intelligence
```bash
# Create Document Intelligence resource
az cognitiveservices account create \
  --name "pinnacle-doc-intel" \
  --resource-group "pinnacle-sov-processor-rg" \
  --location "Australia East" \
  --kind "FormRecognizer" \
  --sku "S0"
```

#### Azure Maps
```bash
# Create Maps account
az maps account create \
  --name "pinnacle-maps" \
  --resource-group "pinnacle-sov-processor-rg" \
  --sku "S1"

# Get primary key
az maps account keys list \
  --name "pinnacle-maps" \
  --resource-group "pinnacle-sov-processor-rg"
```

### 3. Storage & Database (Optional)

#### Azure SQL Database
```bash
# Create SQL server
az sql server create \
  --name "pinnacle-sql-server" \
  --resource-group "pinnacle-sov-processor-rg" \
  --location "Australia East" \
  --admin-user "pinnacle_admin" \
  --admin-password "YourSecurePassword123!"

# Create database
az sql db create \
  --resource-group "pinnacle-sov-processor-rg" \
  --server "pinnacle-sql-server" \
  --name "sov-data" \
  --edition "Basic"
```

#### Blob Storage
```bash
# Create storage account
az storage account create \
  --name "pinnaclesovstorage" \
  --resource-group "pinnacle-sov-processor-rg" \
  --location "Australia East" \
  --sku "Standard_LRS"

# Create container for processed files
az storage container create \
  --name "processed-sovs" \
  --account-name "pinnaclesovstorage"
```

## 📦 Application Configuration

### Environment Variables Template
Create `.env.production` file:
```env
# Azure OpenAI Configuration
REACT_APP_AZURE_OPENAI_ENDPOINT=https://pinnacle-openai.openai.azure.com/
REACT_APP_AZURE_OPENAI_API_KEY=your_openai_key_here
REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME=gpt-4-sov-processor
REACT_APP_AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Azure Maps Configuration
REACT_APP_AZURE_MAPS_KEY=your_maps_key_here

# Optional: Storage Configuration
REACT_APP_AZURE_STORAGE_CONNECTION_STRING=DefaultEndpointsProtocol=https;AccountName=pinnaclesovstorage;AccountKey=...

# Optional: Database Configuration
REACT_APP_DATABASE_CONNECTION_STRING=Server=pinnacle-sql-server.database.windows.net;Database=sov-data;...
```

### Static Web App Configuration
Create `staticwebapp.config.json`:
```json
{
  "routes": [
    {
      "route": "/*",
      "serve": "/index.html",
      "statusCode": 200
    }
  ],
  "mimeTypes": {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  },
  "globalHeaders": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  }
}
```

## 🔐 Security Configuration

### 1. Authentication Setup (Microsoft 365 SSO)
```json
{
  "auth": {
    "identityProviders": {
      "azureActiveDirectory": {
        "registration": {
          "openIdIssuer": "https://login.microsoftonline.com/your-tenant-id",
          "clientIdSettingName": "AAD_CLIENT_ID",
          "clientSecretSettingName": "AAD_CLIENT_SECRET"
        }
      }
    }
  }
}
```

### 2. API Permissions
Required Azure AD permissions:
- `User.Read` - Basic user profile
- `Files.Read` - Access to user's files (if integrating with SharePoint/OneDrive)

### 3. Network Security
```bash
# Configure firewall rules
az sql server firewall-rule create \
  --resource-group "pinnacle-sov-processor-rg" \
  --server "pinnacle-sql-server" \
  --name "AllowAzureServices" \
  --start-ip-address "0.0.0.0" \
  --end-ip-address "0.0.0.0"
```

## 📊 Monitoring & Logging

### Application Insights Setup
```bash
# Create Application Insights
az monitor app-insights component create \
  --app "pinnacle-sov-processor" \
  --location "Australia East" \
  --resource-group "pinnacle-sov-processor-rg"

# Get instrumentation key
az monitor app-insights component show \
  --app "pinnacle-sov-processor" \
  --resource-group "pinnacle-sov-processor-rg" \
  --query "instrumentationKey"
```

### Log Analytics Configuration
```javascript
// Add to React app
import { ApplicationInsights } from '@microsoft/applicationinsights-web';

const appInsights = new ApplicationInsights({
  config: {
    instrumentationKey: process.env.REACT_APP_APPINSIGHTS_KEY
  }
});

appInsights.loadAppInsights();
appInsights.trackPageView();
```

## 🚀 CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy SOV Processor

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
      with:
        submodules: true
        
    - name: Setup Node.js
      uses: actions/setup-node@v2
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test -- --coverage --watchAll=false
      
    - name: Build application
      run: npm run build
      env:
        REACT_APP_AZURE_OPENAI_ENDPOINT: ${{ secrets.AZURE_OPENAI_ENDPOINT }}
        REACT_APP_AZURE_MAPS_KEY: ${{ secrets.AZURE_MAPS_KEY }}
        
    - name: Deploy to Azure Static Web Apps
      uses: Azure/static-web-apps-deploy@v1
      with:
        azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
        repo_token: ${{ secrets.GITHUB_TOKEN }}
        action: "upload"
        app_location: "/"
        app_build_command: "npm run build"
        output_location: "build"
```

## 📈 Performance Optimization

### 1. CDN Configuration
```bash
# Enable CDN for static assets
az cdn profile create \
  --name "pinnacle-cdn" \
  --resource-group "pinnacle-sov-processor-rg" \
  --sku "Standard_Microsoft"

az cdn endpoint create \
  --name "sov-processor" \
  --profile-name "pinnacle-cdn" \
  --resource-group "pinnacle-sov-processor-rg" \
  --origin "pinnacle-sov-processor.azurestaticapps.net"
```

### 2. Caching Strategy
```javascript
// Service worker for offline capability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js');
}
```

## 🧪 Testing & Validation

### Pre-Deployment Checklist
- [ ] AI services responding correctly
- [ ] File upload working (< 50MB limit)
- [ ] Multi-sheet processing functional
- [ ] Export functionality working
- [ ] Error handling graceful
- [ ] Performance acceptable (< 30 seconds for 1000 rows)

### Load Testing
```bash
# Test with multiple concurrent users
npm install -g artillery
artillery quick --count 10 --num 50 https://your-app.azurestaticapps.net
```

## 🆘 Troubleshooting

### Common Issues

#### 1. AI Services Not Responding
```bash
# Check service status
az cognitiveservices account show \
  --name "pinnacle-openai" \
  --resource-group "pinnacle-sov-processor-rg" \
  --query "properties.provisioningState"
```

#### 2. CORS Issues
Update `staticwebapp.config.json` with proper origins:
```json
{
  "globalHeaders": {
    "Access-Control-Allow-Origin": "https://your-domain.com"
  }
}
```

#### 3. File Upload Limits
Check Static Web Apps limits:
- Max file size: 100MB
- Max request timeout: 230 seconds

### Support Contacts
- **Azure Support**: [Azure Portal Support](https://portal.azure.com/#blade/Microsoft_Azure_Support/HelpAndSupportBlade)
- **Internal IT**: Contact Pinnacle IT team
- **Development Team**: GitHub Issues or internal Slack

---

**Deployment completed successfully!** 🎉

Your SOV Processor is now running at: `https://pinnacle-sov-processor.azurestaticapps.net`