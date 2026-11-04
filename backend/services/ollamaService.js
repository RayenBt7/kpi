const OLLAMA_URL = process.env.OLLAMA_URL || 'http://127.0.0.1:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const extractText = (data) => {
    if (!data) {
        return '';
    }

    if (typeof data === 'string') {
        return data.trim();
    }

    return (
        data.choices?.[0]?.message?.content ||
        data.choices?.[0]?.text ||
        data.message?.content ||
        data.response ||
        data.completion ||
        ''
    ).trim();
};

const chat = async ({
    model = DEFAULT_MODEL,
    messages,
    max_tokens = 512,
    temperature = 0.4,
    top_p = 0.9,
}) => {
    const response = await fetch(`${OLLAMA_URL}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens, temperature, top_p })
    });

    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(errorText || 'Ollama request failed');
        error.status = response.status;
        throw error;
    }

    const data = await response.json();
    return {
        data,
        text: extractText(data)
    };
};

const completion = async ({
    model = DEFAULT_MODEL,
    prompt,
    max_tokens = 256,
    temperature = 0.7,
    top_p = 0.95,
}) => {
    const response = await fetch(`${OLLAMA_URL}/v1/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, max_tokens, temperature, top_p })
    });

    if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(errorText || 'Ollama request failed');
        error.status = response.status;
        throw error;
    }

    const data = await response.json();
    return {
        data,
        text: extractText(data)
    };
};

module.exports = {
    OLLAMA_URL,
    DEFAULT_MODEL,
    chat,
    completion,
    extractText
};
