const fetch = require('node-fetch');

async function testAzureOpenAI() {
    console.log('Testing Azure OpenAI API...');
    
    const endpoint = 'https://australiaeast.api.cognitive.microsoft.com/';
    const apiKey = '767f1504ad29447e8615199eba347e11';
    const deploymentName = 'o3-mini';
    
    try {
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
                        content: 'Hello, this is a test. Please respond with "Test successful".'
                    }
                ],
                max_tokens: 100,
                temperature: 0.1
            })
        });

        console.log('Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Error:', errorText);
            return;
        }

        const data = await response.json();
        console.log('Success! Response:', JSON.stringify(data, null, 2));
        
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testAzureOpenAI(); 