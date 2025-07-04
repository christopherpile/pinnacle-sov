module.exports = async function (context, req) {
    context.log('Azure OpenAI API called');

    try {
        const { prompt, model = 'gpt-35-turbo-0125', max_tokens = 2000, temperature = 0.1 } = req.body;

        if (!prompt) {
            context.res = {
                status: 400,
                body: { error: 'Prompt is required' }
            };
            return;
        }

        // Get Azure OpenAI configuration from environment variables
        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
        const apiKey = process.env.AZURE_OPENAI_API_KEY;
        const deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-35-turbo-0125';

        if (!endpoint || !apiKey) {
            context.log.error('Azure OpenAI configuration missing');
            context.res = {
                status: 500,
                body: { error: 'Azure OpenAI not configured' }
            };
            return;
        }

        const response = await fetch(`${endpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=2024-02-15-preview`, {
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
                max_tokens: max_tokens,
                temperature: temperature
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.log.error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
            throw new Error(`Azure OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        
        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: data
        };

    } catch (error) {
        context.log.error('Error in Azure OpenAI function:', error);
        context.res = {
            status: 500,
            body: { 
                error: 'Internal server error',
                details: error.message 
            }
        };
    }
}; 