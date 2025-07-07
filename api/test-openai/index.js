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
        // Hardcoded Azure OpenAI configuration
        const endpoint = 'https://australiaeast.api.cognitive.microsoft.com/';
        const apiKey = '767f1504ad29447e8615199eba347e11';
        const deploymentName = 'o3-mini';

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
                max_completion_tokens: 100,
                temperature: 0.1
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