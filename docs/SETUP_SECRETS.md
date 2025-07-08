# Setting Up GitHub Secrets for Azure OpenAI

This application uses GitHub secrets to securely store Azure OpenAI configuration. Follow these steps to set up the required secrets.

## Required Secrets

You need to add these secrets to your GitHub repository:

### 1. AZURE_OPENAI_ENDPOINT
- **Value:** `https://australiaeast.api.cognitive.microsoft.com/`
- **Description:** Your Azure OpenAI endpoint URL

### 2. AZURE_OPENAI_API_KEY
- **Value:** Your Azure OpenAI API key
- **Description:** The API key for accessing Azure OpenAI services

### 3. AZURE_OPENAI_DEPLOYMENT_NAME
- **Value:** `o3-mini`
- **Description:** The deployment name for your Azure OpenAI model

## How to Add Secrets

1. Go to your GitHub repository
2. Click on **Settings** tab
3. In the left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Add each secret with the exact name and value above

## Current Configuration

The application is configured to use:
- **Model:** o3-mini
- **API Version:** 2024-12-01-preview
- **Parameters:** Only `max_completion_tokens` (temperature not supported)

## Testing

After setting up secrets, you can test the configuration:

1. **Health Check:** `https://your-app.azurestaticapps.net/api/azure-openai`
2. **Test Endpoint:** `https://your-app.azurestaticapps.net/api/test-openai`

Both endpoints will show whether the environment variables are properly configured.

## Security Notes

- Never commit secrets to the repository
- Secrets are automatically injected as environment variables during deployment
- The API key is masked in logs for security 