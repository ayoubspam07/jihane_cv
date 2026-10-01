import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { MongoClient, ObjectId } from 'mongodb';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { MONGODB_URI, MONGODB_DB = 'job_tracker', PORT = 3001 } = process.env;

const STATUSES = ['Saved', 'Applied', 'Interview', 'Offer', 'Rejected'];

const client = MONGODB_URI ? new MongoClient(MONGODB_URI) : null;
let applications;
let cvSettings;
let connectionPromise;

function sanitizeTitle(value) {
  let title = String(value ?? '').trim().replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const brokenLinkStart = title.indexOf('](');
  const brokenLinkEnd = title.lastIndexOf(')');
  if (brokenLinkStart > 0 && brokenLinkEnd > brokenLinkStart) {
    title = `${title.slice(0, brokenLinkStart)} ${title.slice(brokenLinkEnd + 1)}`;
  }
  return title.replace(/\s+/g, ' ').trim();
}

async function connect() {
  if (!MONGODB_URI) {
    throw new Error('Missing MONGODB_URI. Set it in your environment.');
  }
  if (!connectionPromise) {
    connectionPromise = client.connect().then(() => {
      const db = client.db(MONGODB_DB);
      applications = db.collection('applications');
      cvSettings = db.collection('cv_settings');
      console.log(`Connected to MongoDB (db: ${MONGODB_DB})`);
    });
  }
  return connectionPromise;
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(async (_req, res, next) => {
  try {
    await connect();
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function serialize(doc) {
  return { ...doc, title: sanitizeTitle(doc.title), id: doc._id.toString(), _id: undefined };
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v ?? '').trim()).filter(Boolean);
}

function sanitize(body = {}) {
  const status = STATUSES.includes(body.status) ? body.status : 'Saved';
  let matchScore = null;
  if (body.matchScore !== null && body.matchScore !== undefined && body.matchScore !== '') {
    const n = Number(body.matchScore);
    if (Number.isFinite(n)) matchScore = Math.max(0, Math.min(100, Math.round(n)));
  }
  return {
    title: sanitizeTitle(body.title),
    company: String(body.company ?? '').trim(),
    url: String(body.url ?? '').trim(),
    location: String(body.location ?? '').trim(),
    contractType: String(body.contractType ?? '').trim(),
    summary: String(body.summary ?? ''),
    missions: toStringArray(body.missions),
    requirements: toStringArray(body.requirements),
    jobDescription: String(body.jobDescription ?? ''),
    missingProfile: String(body.missingProfile ?? ''),
    qualified: body.qualified === true,
    matchScore,
    assessment: String(body.assessment ?? ''),
    resumeJson: String(body.resumeJson ?? ''),
    status,
  };
}

// List all applications (newest first).
app.get('/api/applications', async (_req, res) => {
  try {
    const docs = await applications.find().sort({ createdAt: -1 }).toArray();
    res.json(docs.map(serialize));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new application.
app.post('/api/applications', async (req, res) => {
  try {
    const data = sanitize(req.body);
    if (!data.title || !data.company) {
      return res.status(400).json({ error: 'Title and company are required.' });
    }
    const now = new Date();
    const result = await applications.insertOne({ ...data, createdAt: now, updatedAt: now });
    const doc = await applications.findOne({ _id: result.insertedId });
    res.status(201).json(serialize(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update an application (e.g. change status).
app.patch('/api/applications/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    const data = sanitize(req.body);
    const _id = new ObjectId(req.params.id);
    await applications.updateOne({ _id }, { $set: { ...data, updatedAt: new Date() } });
    const doc = await applications.findOne({ _id });
    if (!doc) return res.status(404).json({ error: 'Not found.' });
    res.json(serialize(doc));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete an application.
app.delete('/api/applications/:id', async (req, res) => {
  try {
    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid id.' });
    }
    await applications.deleteOne({ _id: new ObjectId(req.params.id) });
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get saved CV customization for a given key (e.g. "cv-fr").
app.get('/api/cv-settings/:key', async (req, res) => {
  try {
    const doc = await cvSettings.findOne({ key: String(req.params.key) });
    if (!doc) return res.status(404).json({ error: 'Not found.' });
    res.json({ settings: doc.settings ?? null, overrides: doc.overrides ?? null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Save (upsert) CV customization for a given key.
app.put('/api/cv-settings/:key', async (req, res) => {
  try {
    const key = String(req.params.key);
    const settings = req.body?.settings ?? null;
    const overrides = req.body?.overrides ?? null;
    await cvSettings.updateOne(
      { key },
      { $set: { key, settings, overrides, updatedAt: new Date() } },
      { upsert: true },
    );
    res.json({ settings, overrides });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


export default app;

if (process.env.VERCEL !== '1') {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const distPath = path.join(__dirname, '../dist');

  app.use(express.static(distPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  connect()
    .then(() => {
      app.listen(PORT, () => console.log(`API running on http://localhost:${PORT}`));
    })
    .catch((err) => {
      console.error('Failed to connect to MongoDB:', err.message);
      process.exit(1);
    });
}
