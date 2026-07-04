/**
 * UNIFIED ASSISTANT BACKEND
 * Single intelligent core serving both JARVIS (mobile) and Job (web)
 *
 * Architecture:
 * User Input → Intent Router → Execute (Action/Conversation/Both) → Vault Log
 */

import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
const OWNER = 'etblues449';
const REPO = 'Obsidian-Vault-';

// ============ VAULT CONTEXT ============

async function getVaultContext() {
  const inbox = await safeGitGet('JARVIS/Inbox');
  const memory = await safeGitGet('Claude Memory/MEMORY.md');
  const today = new Date().toISOString().split('T')[0];
  const session = await safeGitGet(`JARVIS/sessions/${today}.md`);

  let context = '';
  if (Array.isArray(inbox)) {
    const recent = inbox
      .filter(f => f.type === 'file' && f.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, 5);
    context += 'RECENT:\n';
    for (const f of recent) {
      const content = await safeGitGet(f.path);
      if (content?.content) {
        context += `${f.name}: ${Buffer.from(content.content, 'base64').toString().substring(0, 200)}\n`;
      }
    }
  }
  if (memory?.content) {
    context += `\nMEMORY:\n${Buffer.from(memory.content, 'base64').toString().substring(0, 1000)}`;
  }
  if (session?.content) {
    context += `\nTODAY:\n${Buffer.from(session.content, 'base64').toString().substring(0, 500)}`;
  }
  return context;
}

async function safeGitGet(path) {
  try {
    return await octokit.repos.getContent({ owner: OWNER, repo: REPO, path });
  } catch (e) {
    return null;
  }
}

// ============ INTENT DETECTION ============

async function detectIntent(userInput) {
  // Quick pattern matching for action requests
  const patterns = {
    alarm: /alarm|wake|morning|remind at \d/i,
    sms: /sms|text|message|send.*to/i,
    reminder: /remind|remember|don't forget/i,
    calendar: /schedule|event|meeting|calendar/i,
    timer: /timer|countdown/i,
    app: /open|launch|start/i,
    notification: /notify|alert/i,
  };

  const detectedActions = Object.entries(patterns)
    .filter(([_, regex]) => regex.test(userInput))
    .map(([action]) => action);

  return {
    isAction: detectedActions.length > 0,
    actions: detectedActions,
    isConversation: true, // Always include conversation response
    requiresContext: /what|when|where|why|how|schedule|plan|status|progress/i.test(userInput),
  };
}

// ============ LLM ROUTING ============

async function getActionResponse(userInput, intent) {
  // Fast LLM for action extraction (use Groq)
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract parameters for these phone actions: ${intent.actions.join(', ')}\nRequest: "${userInput}"\nReturn JSON only.`,
      }],
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

async function getConversationalResponse(userInput, vaultContext) {
  // Rich LLM for conversation (use Claude)
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-8',
      max_tokens: 1000,
      system: `You are Elliot's unified personal assistant (JARVIS + Job merged). Answer naturally, reference vault when relevant. Keep conversational responses 2-4 sentences unless asked for detail.\n\nVault Context:\n${vaultContext}`,
      messages: [{ role: 'user', content: userInput }],
    }),
  });
  const data = await res.json();
  return data.content?.[0]?.text;
}

// ============ EXECUTION ENGINE ============

async function executeActions(intent, actionParams) {
  const results = [];

  for (const action of intent.actions) {
    try {
      // Call appropriate Tasker task via HTTP
      const params = JSON.parse(actionParams)[action];
      const url = `http://localhost:1337/?task=Jarvis%20${capitalize(action)}&${objectToUrl(params)}`;

      const res = await fetch(url);
      results.push({
        action,
        status: res.ok ? 'executed' : 'failed',
        params,
      });
    } catch (e) {
      results.push({ action, status: 'error', error: e.message });
    }
  }
  return results;
}

function objectToUrl(obj) {
  return Object.entries(obj)
    .map(([k, v], i) => `par${i + 1}=${encodeURIComponent(v)}`)
    .join('&');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============ UNIFIED HANDLER ============

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { text, source } = req.body; // source: 'jarvis-mobile' or 'job-web'
    if (!text?.trim()) return res.status(400).json({ error: 'No input' });

    // Get vault context once
    const vaultContext = await getVaultContext();

    // Detect what user wants
    const intent = await detectIntent(text);

    let response = {
      source,
      timestamp: new Date().toISOString(),
      input: text,
      vaultConnected: !!vaultContext,
    };

    // Execute actions if detected
    if (intent.isAction) {
      const actionParams = await getActionResponse(text, intent);
      const execResults = await executeActions(intent, actionParams);
      response.actions = execResults;
    }

    // Always get conversational response
    if (intent.isConversation) {
      const conversational = await getConversationalResponse(text, intent.requiresContext ? vaultContext : '');
      response.reply = conversational;
    }

    // Log to vault
    try {
      await logToVault(text, response);
    } catch (e) {
      console.log('Vault log failed:', e.message);
    }

    return res.status(200).json(response);

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({
      reply: 'System error. Try again.',
      error: err.message.substring(0, 100),
    });
  }
}

async function logToVault(userInput, response) {
  // Implement vault logging
  // POST to JARVIS/Chat.md or similar
  console.log('Logging to vault:', userInput);
}
