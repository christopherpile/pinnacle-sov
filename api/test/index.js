module.exports = async function (context, req) {
    context.log('Test API called');

    context.res = {
        status: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: {
            message: 'API is working!',
            timestamp: new Date().toISOString(),
            environment: {
                endpoint: process.env.AZURE_OPENAI_ENDPOINT ? 'Set' : 'Not Set',
                apiKey: process.env.AZURE_OPENAI_API_KEY ? 'Set' : 'Not Set',
                deploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'Not Set'
            }
        }
    };
}; 