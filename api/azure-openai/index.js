// Use global fetch if available (Node 18+), otherwise require node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    fetch = require('node-fetch');
}

module.exports = async function (context, req) {
    context.log('=== Azure OpenAI API called ===');
    context.log('Request method:', req.method);
    context.log('Request URL:', req.url);
    context.log('Request headers:', JSON.stringify(req.headers));
    context.log('Environment variables available:', Object.keys(process.env).filter(key => key.includes('AZURE_OPENAI')));

    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            },
            body: ''
        };
        return;
    }

    // Handle GET requests for health check
    if (req.method === 'GET') {
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: {
                message: 'Azure OpenAI API is running',
                timestamp: new Date().toISOString(),
                configuration: {
                    endpoint: process.env.AZURE_OPENAI_ENDPOINT ? 'Set' : 'Not Set',
                    apiKey: process.env.AZURE_OPENAI_API_KEY ? 'Set' : 'Not Set',
                    deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'o3-mini (default)'
                }
            }
        };
        return;
    }

    try {
        const { prompt, model = 'o3-mini', max_completion_tokens = 2000 } = req.body;

        if (!prompt) {
            context.res = {
                status: 400,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: { error: 'Prompt is required' }
            };
            return;
        }

        // Get Azure OpenAI configuration from environment variables
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'o3-mini';

        context.log('Azure OpenAI configuration:');
        context.log('Endpoint configured:', !!endpoint);
        context.log('Endpoint value:', endpoint);
        context.log('API Key configured:', !!apiKey);
        context.log('API Key (first 10 chars):', apiKey ? apiKey.substring(0, 10) + '...' : 'NOT SET');
        context.log('Deployment name:', deploymentName);

        if (!endpoint || !apiKey) {
            context.log.error('Azure OpenAI configuration missing');
            context.log.error('Endpoint:', endpoint ? 'Set' : 'Missing');
            context.log.error('API Key:', apiKey ? 'Set' : 'Missing');
            context.res = {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: { error: 'Azure OpenAI not configured. Please check environment variables.' }
            };
            return;
        }

        const response = await fetch(`${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-12-01-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert insurance data processor and Excel file analyzer. Provide clear, accurate responses in JSON format when requested.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_completion_tokens: max_completion_tokens
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
            context.log.error('Request URL:', `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-12-01-preview`);
            context.log.error('Request headers:', JSON.stringify({
                'Content-Type': 'application/json',
                'api-key': apiKey.substring(0, 10) + '...'
            }));
            context.log.error('Request body:', JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert insurance data processor and Excel file analyzer. Provide clear, accurate responses in JSON format when requested.'
                    },
                    {
                        role: 'user',
                        content: prompt.substring(0, 200) + '...' // Log first 200 chars of prompt
                    }
                ],
                max_completion_tokens: max_completion_tokens
            }));
            throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        
        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: data
        };

    } catch (error) {
        context.log.error('Error in Azure OpenAI function:', error);
        context.res = {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: { 
                error: 'Internal server error',
                details: error.message 
            }
        };
    }
}; 