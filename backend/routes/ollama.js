const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/authMiddleware');
const ollamaService = require('../services/ollamaService');
const enterpriseChatService = require('../services/enterpriseChatService');

const OLLAMA_URL = ollamaService.OLLAMA_URL;

const ensurePrompt = (req, res, next) => {
  if (!req.body || typeof req.body.prompt !== 'string' || !req.body.prompt.trim()) {
    return res.status(400).json({ error: 'Le champ prompt est requis.' });
  }
  next();
};

const ensureMessage = (req, res, next) => {
  if (!req.body || typeof req.body.message !== 'string' || !req.body.message.trim()) {
    return res.status(400).json({ error: 'Le champ message est requis.' });
  }
  req.body.message = req.body.message.trim().slice(0, 2000);
  next();
};

router.get('/models', async (req, res) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/v1/models`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: errorText });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Ollama models error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/completion', ensurePrompt, async (req, res) => {
  try {
    const result = await ollamaService.completion(req.body);
    res.json(result.data);
  } catch (error) {
    console.error('Ollama completion error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/chat', ensureMessage, async (req, res) => {
  try {
    const {
      model,
      message,
      max_tokens = 512,
      temperature = 0.7,
      top_p = 0.95
    } = req.body;

    const systemPrompt = [
      "Tu es un assistant IA general.",
      "Tu reponds en francais clair et utile.",
      "Tu n'as aucun acces aux donnees internes de l'entreprise, a la base de donnees, aux KPI reels ou aux informations confidentielles.",
      "Si l'utilisateur demande des donnees internes, explique qu'il doit utiliser le chat entreprise apres authentification."
    ].join(' ');

    const result = await ollamaService.chat({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens,
      temperature,
      top_p
    });

    res.json({ response: result.text || 'Aucune reponse generee.' });
  } catch (error) {
    console.error('Ollama public chat error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

router.post('/enterprise-chat', authMiddleware, ensureMessage, async (req, res) => {
  try {
    const result = await enterpriseChatService.answerEnterpriseQuestion({
      question: req.body.message,
      user: req.user,
      model: req.body.model
    });

    res.json(result);
  } catch (error) {
    console.error('Ollama enterprise chatbot error:', error);
    res.status(error.status || 500).json({
      error: "Erreur lors de l'analyse entreprise.",
      details: error.message
    });
  }
});

// Backward-compatible alias kept for older frontend calls.
router.post('/chatbot', ensureMessage, async (req, res) => {
  try {
    const result = await ollamaService.chat({
      model: req.body.model,
      messages: [
        {
          role: 'system',
          content: "Tu es un assistant KPI AAF. Sans authentification, tu reponds uniquement de facon generale et sans acces aux donnees internes."
        },
        { role: 'user', content: req.body.message }
      ],
      max_tokens: req.body.max_tokens || 512,
      temperature: req.body.temperature || 0.5,
      top_p: req.body.top_p || 0.9
    });
    res.json({ response: result.text || 'Aucune reponse generee.' });
  } catch (error) {
    console.error('Ollama chatbot error:', error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

module.exports = router;
