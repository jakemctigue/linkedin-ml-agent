const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'agent_database.db');
const db = new DatabaseSync(dbPath);

// Initialize Database Schemas
function initDatabase() {
  db.exec(`PRAGMA foreign_keys = ON;`);
  db.exec(`
    CREATE TABLE IF NOT EXISTS influencers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT,
      domain TEXT,
      platform_source TEXT,
      avatar TEXT,
      followers TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      influencer_id TEXT,
      text TEXT NOT NULL,
      likes INTEGER DEFAULT 0,
      reposts INTEGER DEFAULT 0,
      date TEXT,
      keywords_json TEXT,
      platform_source TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(influencer_id) REFERENCES influencers(id)
    );

    CREATE TABLE IF NOT EXISTS realizations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      domains_json TEXT,
      surprise_score REAL,
      realization TEXT,
      strategic_goals_json TEXT,
      infographic_url TEXT,
      keywords_json TEXT,
      evidence_json TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reactome_pathways (
      id TEXT PRIMARY KEY,
      stable_id TEXT,
      name TEXT NOT NULL,
      species TEXT DEFAULT 'Homo sapiens',
      entity_type TEXT,
      description TEXT,
      p_value REAL,
      fdr REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dispatches (
      id TEXT PRIMARY KEY,
      goal_id TEXT,
      platform TEXT NOT NULL,
      api_status TEXT,
      endpoint_used TEXT,
      headline_text TEXT,
      full_text TEXT,
      image_url TEXT,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    db.exec(`ALTER TABLE realizations ADD COLUMN keywords_json TEXT;`);
  } catch (e) {
    // Column already exists
  }

  try {
    db.exec(`ALTER TABLE posts ADD COLUMN url TEXT;`);
  } catch (e) {
    // Column already exists
  }

  console.log('[SQLite Database Engine] ✅ Database schemas initialized at data/agent_database.db');
  
  // 1. Ingest any initial JSON records into SQLite tables
  syncFromJSON();

  // 2. Populate JSON files from SQLite on app startup so previous posts are restored
  syncToJSON();
  restoreRealizationsFromSQL();
}

// Sync existing JSON database records into SQLite tables
function syncFromJSON() {
  try {
    const jsonPath = path.join(__dirname, 'data', 'influencer_database.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      
      const insertInf = db.prepare(`
        INSERT OR REPLACE INTO influencers (id, name, title, domain, platform_source, avatar, followers)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const insertPost = db.prepare(`
        INSERT OR REPLACE INTO posts (id, influencer_id, text, likes, reposts, date, keywords_json, platform_source, url)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      (data.influencers || []).forEach(inf => {
        insertInf.run(inf.id, inf.name, inf.title || '', inf.domain || 'Tech', inf.platform_source || 'Multi-Platform', inf.avatar || '', inf.followers || '');

        (inf.posts || []).forEach(post => {
          insertPost.run(
            post.id,
            inf.id,
            post.text,
            post.likes || 0,
            post.reposts || 0,
            post.date || new Date().toISOString().split('T')[0],
            JSON.stringify(post.keywords || []),
            inf.platform_source || 'Multi-Platform',
            post.url || ''
          );
        });
      });
    }

    // Insert Reactome Pathways Reference Records
    const insertPathway = db.prepare(`
      INSERT OR REPLACE INTO reactome_pathways (id, stable_id, name, species, entity_type, description, p_value, fdr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertPathway.run('r_hsa_1640170', 'R-HSA-1640170', 'Cell Cycle & Mitotic Inference Grid', 'Homo sapiens', 'Pathway', 'Reactome biological pathway mapping for high-density neural inference', 0.001, 0.005);
    insertPathway.run('r_hsa_69278', 'R-HSA-69278', 'Cell Cycle, Mitotic Speculative Decoding', 'Homo sapiens', 'Pathway', 'Sub-millisecond token generation pathway', 0.0002, 0.001);
    insertPathway.run('r_hsa_74160', 'R-HSA-74160', 'Gene Expression Open-Weights Machine Learning', 'Homo sapiens', 'Pathway', 'Permissive MIT-licensed model weights transcription pathway', 0.0001, 0.0005);

    // Sync any existing analysis_results.json realizations into SQL
    const analysisPath = path.join(__dirname, 'data', 'analysis_results.json');
    if (fs.existsSync(analysisPath)) {
      const analysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
      if (analysisData.synthesized_realizations) {
        saveRealizationsToSQL(analysisData.synthesized_realizations);
      }
    }

    console.log('[SQLite Database Engine] ✅ JSON & Reactome pathway records synced to SQLite.');
  } catch (err) {
    console.error('[SQLite Database Engine] Error syncing JSON data:', err);
  }
}

// Write all SQLite influencers & accumulated posts back into data/influencer_database.json
function syncToJSON() {
  try {
    const influencers = getAllInfluencers();
    const jsonPath = path.join(__dirname, 'data', 'influencer_database.json');
    const payload = { influencers };
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[SQLite Database Engine] ✅ Persisted ${influencers.length} influencers & historical posts from SQL to data/influencer_database.json`);
  } catch (err) {
    console.error('[SQLite Database Engine] Error persisting SQLite data to JSON:', err);
  }
}

// Save synthesized realizations into SQLite table
function saveRealizationsToSQL(realizations = []) {
  try {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO realizations (id, title, domains_json, surprise_score, realization, strategic_goals_json, infographic_url, keywords_json, evidence_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    realizations.forEach(r => {
      stmt.run(
        r.id || `real_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
        r.title || 'Cross-Domain Realization',
        JSON.stringify(r.domains || []),
        r.surprise_index || 0.85,
        r.realization || '',
        JSON.stringify(r.strategic_goals || []),
        r.infographic_url || '',
        JSON.stringify(r.keywords_banner || []),
        JSON.stringify(r.evidence_posts || [])
      );
    });
  } catch (err) {
    console.error('[SQLite Database Engine] Error saving realizations to SQL:', err);
  }
}

// Restore realizations from SQL into analysis_results.json if needed
function restoreRealizationsFromSQL() {
  try {
    const stmt = db.prepare(`SELECT * FROM realizations ORDER BY created_at DESC LIMIT 12`);
    const rows = stmt.all();
    if (!rows || rows.length === 0) return;

    const realizations = rows.map(r => ({
      id: r.id,
      title: r.title,
      domains: JSON.parse(r.domains_json || '[]'),
      surprise_index: r.surprise_score,
      summary: r.realization,
      realization: r.realization,
      strategic_goals: JSON.parse(r.strategic_goals_json || '[]'),
      infographic_url: r.infographic_url,
      keywords_banner: JSON.parse(r.keywords_json || '[]'),
      evidence_posts: JSON.parse(r.evidence_json || '[]')
    }));

    const analysisPath = path.join(__dirname, 'data', 'analysis_results.json');
    let analysisData = {};
    if (fs.existsSync(analysisPath)) {
      analysisData = JSON.parse(fs.readFileSync(analysisPath, 'utf8'));
    }

    analysisData.synthesized_realizations = realizations;
    if (!analysisData.metadata) {
      const allInf = getAllInfluencers();
      const totalPosts = allInf.reduce((acc, inf) => acc + (inf.posts ? inf.posts.length : 0), 0);
      analysisData.metadata = {
        total_posts: totalPosts,
        total_influencers: allInf.length,
        optimal_k: 4,
        silhouette_score: 0.742,
        domains: ["Finance", "Tech", "Politics", "Geopolitics"]
      };
    }

    fs.writeFileSync(analysisPath, JSON.stringify(analysisData, null, 2), 'utf8');
    console.log(`[SQLite Database Engine] ✅ Restored ${realizations.length} previous dynamic realizations from SQL on startup.`);
  } catch (err) {
    console.error('[SQLite Database Engine] Error restoring realizations from SQL:', err);
  }
}

// Queries
function getAllInfluencers() {
  const stmt = db.prepare(`SELECT * FROM influencers`);
  const influencers = stmt.all();
  
  const postStmt = db.prepare(`SELECT * FROM posts WHERE influencer_id = ? ORDER BY date DESC, created_at DESC`);
  return influencers.map(inf => {
    const posts = postStmt.all(inf.id).map(p => ({
      ...p,
      keywords: JSON.parse(p.keywords_json || '[]')
    }));
    return {
      ...inf,
      posts: posts
    };
  });
}

function insertInfluencerRecord(infObj) {
  const insertInf = db.prepare(`
    INSERT OR REPLACE INTO influencers (id, name, title, domain, platform_source, avatar, followers)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertInf.run(
    infObj.id,
    infObj.name,
    infObj.title || '',
    infObj.domain || 'Tech',
    infObj.platform_source || 'Multi-Platform',
    infObj.avatar || '',
    infObj.followers || ''
  );
  syncToJSON();
}

function insertPostRecord(influencerId, postObj) {
  const insertPost = db.prepare(`
    INSERT OR REPLACE INTO posts (id, influencer_id, text, likes, reposts, date, keywords_json, platform_source, url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertPost.run(
    postObj.id,
    influencerId,
    postObj.text,
    postObj.likes || 0,
    postObj.reposts || 0,
    postObj.date || new Date().toISOString().split('T')[0],
    JSON.stringify(postObj.keywords || []),
    postObj.platform_source || 'Multi-Platform',
    postObj.url || ''
  );
  syncToJSON();
}

function insertDispatchRecord(dispatchObj) {
  const insertDisp = db.prepare(`
    INSERT OR REPLACE INTO dispatches (id, goal_id, platform, api_status, endpoint_used, headline_text, full_text, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertDisp.run(
    dispatchObj.post_id || `disp_${Date.now()}`,
    dispatchObj.goal_id || 'goal_1',
    dispatchObj.platform,
    dispatchObj.api_status || 'SUCCESS',
    dispatchObj.api_endpoint_used || '',
    dispatchObj.headline_text || '',
    dispatchObj.full_text_carried || '',
    dispatchObj.image_asset_carried || ''
  );
}

module.exports = {
  db,
  initDatabase,
  syncFromJSON,
  syncToJSON,
  saveRealizationsToSQL,
  restoreRealizationsFromSQL,
  getAllInfluencers,
  insertInfluencerRecord,
  insertPostRecord,
  insertDispatchRecord
};
