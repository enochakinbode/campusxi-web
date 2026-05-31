import { Buffer } from 'node:buffer';
import type { APIRoute } from 'astro';

export const prerender = false;

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const readText = (form: FormData, key: string): string => {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
};

const buildLine = (label: string, value: string): string =>
  value ? `${label}: ${value}` : `${label}: Not provided`;

const buildHtmlLine = (label: string, value: string): string =>
  `<p><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value || 'Not provided')}</p>`;

const extractAttachments = async (form: FormData) => {
  const files = form
    .getAll('screenshots')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length > 3) {
    throw new Error('Please upload at most 3 images.');
  }

  for (const file of files) {
    if (file.size > 8 * 1024 * 1024) {
      throw new Error('Each image must be 8MB or less.');
    }
  }

  return Promise.all(
    files.map(async (file) => ({
      filename: file.name,
      content: Buffer.from(await file.arrayBuffer()).toString('base64')
    }))
  );
};

export const POST: APIRoute = async ({ request }) => {
  const env = (key: string): string => {
    const astroEnv = import.meta.env as Record<string, string | undefined>;
    return (astroEnv[key] || process.env[key] || '').trim();
  };

  const resendApiKey = env('RESEND_API_KEY');
  const toEmail = env('SUPPORT_TO_EMAIL');
  const fromEmail = env('SUPPORT_FROM_EMAIL');

  if (!resendApiKey || !toEmail || !fromEmail) {
    const missing = [
      !resendApiKey ? 'RESEND_API_KEY' : null,
      !toEmail ? 'SUPPORT_TO_EMAIL' : null,
      !fromEmail ? 'SUPPORT_FROM_EMAIL' : null
    ].filter(Boolean);

    return json(500, {
      ok: false,
      error: `Support email service is not configured yet. Missing: ${missing.join(', ')}`
    });
  }

  const form = await request.formData();
  const requestType = readText(form, 'requestType').toLowerCase();

  if (requestType !== 'help' && requestType !== 'bug') {
    return json(400, {
      ok: false,
      error: 'Unknown request type.'
    });
  }

  const name = readText(form, 'name');
  const email = readText(form, 'email');

  if (!name || !email) {
    return json(400, {
      ok: false,
      error: 'Name and email are required.'
    });
  }

  const submittedAt = new Date().toISOString();
  let attachments: { filename: string; content: string }[] = [];
  try {
    attachments = await extractAttachments(form);
  } catch (error) {
    return json(400, {
      ok: false,
      error: error instanceof Error ? error.message : 'Invalid attachment input.'
    });
  }

  const subject =
    requestType === 'help'
      ? `Campus XI Help Request - ${name}`
      : `Campus XI Bug Report - ${name}`;

  const textLines = [
    buildLine('Type', requestType === 'help' ? 'Help Request' : 'Bug Report'),
    buildLine('Submitted At (UTC)', submittedAt),
    buildLine('Name', name),
    buildLine('Email', email)
  ];

  const htmlLines = [
    '<h2>Campus XI Support Submission</h2>',
    buildHtmlLine('Type', requestType === 'help' ? 'Help Request' : 'Bug Report'),
    buildHtmlLine('Submitted At (UTC)', submittedAt),
    buildHtmlLine('Name', name),
    buildHtmlLine('Email', email)
  ];

  if (requestType === 'help') {
    const topic = readText(form, 'topic');
    const device = readText(form, 'device');
    const message = readText(form, 'message');

    if (!topic || !device || !message) {
      return json(400, {
        ok: false,
        error: 'Topic, device, and message are required.'
      });
    }

    textLines.push(
      buildLine('Topic', topic),
      buildLine('Device', device),
      buildLine('Message', message)
    );
    htmlLines.push(
      buildHtmlLine('Topic', topic),
      buildHtmlLine('Device', device),
      buildHtmlLine('Message', message)
    );
  } else {
    const platform = readText(form, 'platform');
    const steps = readText(form, 'steps');
    const actualResult = readText(form, 'actualResult');
    const expectedResult = readText(form, 'expectedResult');

    if (!platform || !steps || !actualResult || !expectedResult) {
      return json(400, {
        ok: false,
        error: 'Please complete all bug report fields.'
      });
    }

    textLines.push(
      buildLine('Platform', platform),
      buildLine('Steps to Reproduce', steps),
      buildLine('Actual Result', actualResult),
      buildLine('Expected Result', expectedResult),
      buildLine('Image Attachments', attachments.length.toString())
    );

    htmlLines.push(
      buildHtmlLine('Platform', platform),
      buildHtmlLine('Steps to Reproduce', steps),
      buildHtmlLine('Actual Result', actualResult),
      buildHtmlLine('Expected Result', expectedResult),
      buildHtmlLine('Image Attachments', attachments.length.toString())
    );
  }

  const resendPayload = {
    from: fromEmail,
    to: [toEmail],
    subject,
    reply_to: email,
    text: textLines.join('\n\n'),
    html: htmlLines.join('\n'),
    attachments
  };

  const emailResponse = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(resendPayload)
  });

  if (!emailResponse.ok) {
    const responseText = await emailResponse.text();
    return json(502, {
      ok: false,
      error: `Email delivery failed: ${responseText}`
    });
  }

  return json(200, {
    ok: true,
    message:
      requestType === 'help'
        ? 'Help request sent. We will reply by email shortly.'
        : 'Bug report sent. Thank you for the detailed report.'
  });
};
