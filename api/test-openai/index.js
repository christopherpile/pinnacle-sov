// Use global fetch if available (Node 18+), otherwise require node-fetch
let fetch;
if (typeof globalThis.fetch === 'function') {
    fetch = globalThis.fetch;
} else {
    fetch = require('node-fetch');
}

module.exports = async function (context, req) {
    context.log('=== Test Azure OpenAI API ===');

    try {
        // Get Azure OpenAI configuration from environment variables
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'o3-mini';

        if (!endpoint || !apiKey) {
            context.log.error('Azure OpenAI configuration missing');
            context.res = {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    error: 'Azure OpenAI not configured',
                    endpoint: !!endpoint,
                    apiKey: !!apiKey
                }
            };
            return;
        }

        context.log('Testing with configuration:');
        context.log('Endpoint:', endpoint);
        context.log('Deployment:', deploymentName);
        context.log('API Key:', apiKey.substring(0, 10) + '...');

        const testPrompt = 'Hello, this is a test. Please respond with "Test successful".';

        const response = await fetch(`${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-12-01-preview`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey
            },
            body: JSON.stringify({
                messages: [
                    {
                        role: 'user',
                        content: testPrompt
                    }
                ],
                max_completion_tokens: 100
            })
        });

        context.log('Response status:', response.status);
        context.log('Response headers:', JSON.stringify(response.headers));

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error('Error response:', errorText);
            
            context.res = {
                status: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                body: {
                    error: 'Azure OpenAI test failed',
                    status: response.status,
                    details: errorText,
                    request: {
                        url: `${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-12-01-preview`,
                        headers: {
                            'Content-Type': 'application/json',
                            'api-key': apiKey.substring(0, 10) + '...'
                        }
                    }
                }
            };
            return;
        }

        const data = await response.json();
        context.log('Success response:', JSON.stringify(data));

        context.res = {
            status: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: {
                message: 'Azure OpenAI test successful',
                response: data
            }
        };

    } catch (error) {
        context.log.error('Test error:', error);
        context.res = {
            status: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            body: {
                error: 'Test failed',
                details: error.message
            }
        };
    }
}; 