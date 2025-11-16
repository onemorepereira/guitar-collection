/**
 * Amazon Bedrock integration for AI-powered content generation
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Model IDs
const MODELS = {
  NOVA_PRO: 'amazon.nova-pro-v1:0',
  NOVA_LITE: 'amazon.nova-lite-v1:0',
};

/**
 * Invoke Amazon Nova to generate provenance content
 * @param {string} prompt - The prompt for content generation
 * @param {object} options - Optional parameters (model, temperature, etc.)
 * @returns {Promise<string>} Generated text
 */
async function invokeNova(prompt, options = {}) {
  const {
    model = MODELS.NOVA_PRO,
    temperature = 0.7,
    maxTokens = 4000,
  } = options;

  const payload = {
    messages: [
      {
        role: 'user',
        content: [{ text: prompt }],
      },
    ],
    inferenceConfig: {
      temperature,
      maxTokens,
    },
  };

  const command = new InvokeModelCommand({
    modelId: model,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(payload),
  });

  try {
    const response = await client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Nova returns content in the output.message.content[0].text field
    return responseBody.output.message.content[0].text;
  } catch (error) {
    console.error('Bedrock invocation error:', error);
    throw new Error(`Failed to generate AI content: ${error.message}`);
  }
}

module.exports = {
  invokeNova,
  MODELS,
};
