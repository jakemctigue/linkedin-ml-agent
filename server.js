const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const events = require('events');

// Increase EventEmitter max listeners to prevent browser extension stream warnings
events.defaultMaxListeners = 50;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const INFLUENCER_DB_PATH = path.join(DATA_DIR, 'influencer_database.json');
const ANALYSIS_PATH = path.join(DATA_DIR, 'analysis_results.json');

// Helper to run Python ML script
function runMLPipeline() {
  return new Promise((resolve, reject) => {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    exec(`${pythonCmd} ml_pipeline.py`, { cwd: __dirname }, (error, stdout, stderr) => {
      if (error) {
        console.error(`ML Pipeline Error: ${error.message}`);
        return reject(error);
      }
      console.log(`ML Pipeline Output:\n${stdout}`);
      resolve(stdout);
    });
  });
}

// API Endpoints
app.get('/api/influencers', (req, res) => {
  try {
    const rawData = fs.readFileSync(INFLUENCER_DB_PATH, 'utf-8');
    res.json(JSON.parse(rawData));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read influencer database' });
  }
});

app.get('/api/analysis', (req, res) => {
  try {
    if (!fs.existsSync(ANALYSIS_PATH)) {
      return res.status(404).json({ error: 'Analysis results not yet generated.' });
    }
    const rawData = fs.readFileSync(ANALYSIS_PATH, 'utf-8');
    res.json(JSON.parse(rawData));
  } catch (err) {
    res.status(500).json({ error: 'Failed to read analysis results' });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    // Read DB
    const db = JSON.parse(fs.readFileSync(INFLUENCER_DB_PATH, 'utf-8'));
    
    // Simulate scraping fresh influencer posts or updating metadata
    const freshPosts = [
      {
        id: `p_sim_${Date.now()}_1`,
        author: "Ray Dalio",
        domain: "Finance",
        text: "Sovereign balance sheets are pivoting from fiat debt into decentralized energy reserves and nuclear compute rights as global capital realigns.",
        likes: 3100,
        reposts: 540,
        date: new Date().toISOString().split('T')[0],
        keywords: ["sovereign balance sheets", "fiat debt", "nuclear compute"]
      },
      {
        id: `p_sim_${Date.now()}_2`,
        author: "Sam Altman",
        domain: "Tech",
        text: "Direct integration of nuclear micro-fusion with autonomous AI infrastructure is the only viable path to 100GW continuous inference.",
        likes: 7200,
        reposts: 1400,
        date: new Date().toISOString().split('T')[0],
        keywords: ["micro-fusion", "autonomous AI", "continuous inference"]
      },
      {
        id: `p_sim_${Date.now()}_3`,
        author: "Peter Zeihan",
        domain: "Geopolitics",
        text: "National security mandates now compel localized power generation for defense supercomputers to bypass vulnerable maritime oil supply lines.",
        likes: 4900,
        reposts: 910,
        date: new Date().toISOString().split('T')[0],
        keywords: ["national security", "localized power", "defense supercomputers"]
      }
    ];

    // Append to corresponding influencers
    for (const fresh of freshPosts) {
      const inf = db.influencers.find(i => i.name === fresh.author);
      if (inf) {
        inf.posts.unshift({
          id: fresh.id,
          text: fresh.text,
          likes: fresh.likes,
          reposts: fresh.reposts,
          date: fresh.date,
          keywords: fresh.keywords
        });
      }
    }

    fs.writeFileSync(INFLUENCER_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

    // Execute ML Pipeline
    await runMLPipeline();

    const newAnalysis = JSON.parse(fs.readFileSync(ANALYSIS_PATH, 'utf-8'));
    res.json({
      message: 'Scraping simulation and ML re-clustering complete!',
      added_posts: freshPosts.length,
      analysis: newAnalysis
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to perform scraping and ML re-clustering' });
  }
});

app.post('/api/add-influencer', async (req, res) => {
  try {
    const { name, title, domain, postText, avatar } = req.body;
    if (!name || !domain || !postText) {
      return res.status(400).json({ error: 'Name, domain, and post text are required' });
    }

    const db = JSON.parse(fs.readFileSync(INFLUENCER_DB_PATH, 'utf-8'));
    let inf = db.influencers.find(i => i.name.toLowerCase() === name.toLowerCase());

    if (!inf) {
      inf = {
        id: name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: name,
        title: title || 'Thought Leader',
        domain: domain,
        avatar: avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
        followers: '100K+',
        posts: []
      };
      db.influencers.push(inf);
    }

    const newPostId = `p_custom_${Date.now()}`;
    inf.posts.unshift({
      id: newPostId,
      text: postText,
      likes: Math.floor(Math.random() * 1000) + 100,
      reposts: Math.floor(Math.random() * 200) + 20,
      date: new Date().toISOString().split('T')[0],
      keywords: postText.split(' ').slice(0, 5)
    });

    fs.writeFileSync(INFLUENCER_DB_PATH, JSON.stringify(db, null, 2), 'utf-8');

    await runMLPipeline();
    const updatedAnalysis = JSON.parse(fs.readFileSync(ANALYSIS_PATH, 'utf-8'));

    res.json({
      message: `Successfully added post for ${name}`,
      analysis: updatedAnalysis
    });

  } catch (err) {
    res.status(500).json({ error: 'Failed to add custom influencer post' });
  }
});

// Google Auth Verification Endpoint
app.post('/api/auth/google', (req, res) => {
  try {
    const { credential, testUser } = req.body;
    let user;
    if (testUser) {
      user = {
        name: testUser.name || 'Jake (Google Auth User)',
        email: testUser.email || 'jake@google.com',
        picture: testUser.picture || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        authMethod: 'Google OAuth 2.0'
      };
    } else if (credential) {
      const base64Url = credential.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const payload = JSON.parse(jsonPayload);

      user = {
        name: payload.name,
        email: payload.email,
        picture: payload.picture,
        authMethod: 'Google OAuth 2.0'
      };
    } else {
      return res.status(400).json({ error: 'Missing auth credential' });
    }

    res.json({
      message: 'Google Authentication Successful',
      user: user
    });
  } catch (err) {
    console.error('Google Auth Error:', err);
    res.status(500).json({ error: 'Failed to authenticate Google user' });
  }
});

// mctigue.co Enterprise Partner Authentication Endpoint
app.post('/api/auth/mctigue', (req, res) => {
  try {
    const { email, apiKey, mctigueUser } = req.body;
    
    let user;
    if (mctigueUser) {
      user = {
        name: mctigueUser.name || 'McTigue Executive Partner',
        email: mctigueUser.email || 'partner@mctigue.co',
        title: mctigueUser.title || 'Senior Strategic Advisor',
        picture: mctigueUser.picture || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        authMethod: 'mctigue.co Corporate SSO',
        tier: 'Executive Enterprise Partner'
      };
    } else if (email) {
      user = {
        name: email.split('@')[0].toUpperCase() + ' (mctigue.co)',
        email: email,
        title: 'Enterprise Portal Strategist',
        picture: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        authMethod: 'mctigue.co OAuth 2.0',
        tier: 'Executive Enterprise Partner'
      };
    } else {
      return res.status(400).json({ error: 'Please enter a valid mctigue.co enterprise email or API key.' });
    }

    res.json({
      message: 'mctigue.co Enterprise Authentication Successful',
      user: user
    });
  } catch (err) {
    console.error('mctigue.co Auth Error:', err);
    res.status(500).json({ error: 'Failed to authenticate mctigue.co user' });
  }
});

// Helper to build official platform Web Share Intent URLs for text & blog platforms
function buildShareUrls(content, title, infographicUrl) {
  const encodedTitle = encodeURIComponent(title || 'Strategic Realization');
  const encodedText = encodeURIComponent(content || '');
  const encodedShortText = encodeURIComponent((content || '').substring(0, 275));
  const encodedUrl = encodeURIComponent('http://localhost:3000');

  return {
    linkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&summary=${encodedText}`,
    x: `https://twitter.com/intent/tweet?text=${encodedShortText}`,
    bluesky: `https://bsky.app/intent/compose?text=${encodedShortText}`,
    threads: `https://www.threads.net/intent/post?text=${encodedShortText}`,
    medium: `https://medium.com/new-story`,
    substack: `https://substack.com/publish`,
    tumblr: `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodedUrl}&title=${encodedTitle}&caption=${encodedText}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    youtube: `https://studio.youtube.com/`,
    mctigue: `http://localhost:3000/`
  };
}

// Multi-Platform Publisher Endpoint
app.post('/api/publish', (req, res) => {
  try {
    const { goalId, goalTitle, platforms, content, infographicUrl, authorName } = req.body;

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'Select at least one target platform to publish.' });
    }

    const dispatchLog = [];
    const timestamp = new Date().toISOString();

    platforms.forEach(platform => {
      let format = '';
      let targetShareUrl = '';
      const pName = platform.toLowerCase();

      if (pName.includes('linkedin')) {
        format = `[LinkedIn Post] ${content.linkedIn || content.default}`;
        targetShareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent('http://localhost:3000')}&summary=${encodeURIComponent(content.linkedIn || '')}`;
      } else if (pName.includes('bluesky') || pName.includes('bsky')) {
        format = `[Bluesky Post] ${content.bluesky || content.default}`;
        targetShareUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent((content.bluesky || content.default || '').substring(0, 275))}`;
      } else if (pName.includes('threads')) {
        format = `[Threads Post] ${content.threads || content.default}`;
        targetShareUrl = `https://www.threads.net/intent/post?text=${encodeURIComponent((content.threads || content.default || '').substring(0, 275))}`;
      } else if (pName.includes('medium')) {
        format = `[Medium Article] ${content.medium || content.default}`;
        targetShareUrl = `https://medium.com/new-story`;
      } else if (pName.includes('substack')) {
        format = `[Substack Newsletter Edition] ${content.substack || content.default}`;
        targetShareUrl = `https://substack.com/publish`;
      } else if (pName.includes('tumblr')) {
        format = `[Tumblr Blog Post] ${content.tumblr || content.default}`;
        targetShareUrl = `https://www.tumblr.com/widgets/share/tool?canonicalUrl=${encodeURIComponent('http://localhost:3000')}&title=${encodeURIComponent(goalTitle)}&caption=${encodeURIComponent(content.tumblr || '')}`;
      } else if (pName === 'x' || pName.includes('twitter')) {
        format = `[X / Twitter Thread] ${content.x || content.twitter || content.default}`;
        targetShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent((content.x || content.twitter || '').substring(0, 275))}`;
      } else if (pName.includes('facebook')) {
        format = `[Facebook Post] ${content.facebook || content.default}`;
        targetShareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent('http://localhost:3000')}`;
      } else if (pName.includes('youtube')) {
        format = `[YouTube Script & Community Post] ${content.youtube || content.default}`;
        targetShareUrl = `https://studio.youtube.com/`;
      } else if (pName.includes('mctigue')) {
        format = `[mctigue.co Strategy Article] ${content.mctigue || content.default}`;
        targetShareUrl = `http://localhost:3000/`;
      } else {
        format = `[${platform}] ${content.default || 'Published content'}`;
        targetShareUrl = `http://localhost:3000/`;
      }

      dispatchLog.push({
        platform: platform,
        status: 'READY_LIVE',
        share_url: targetShareUrl,
        published_at: timestamp,
        post_id: `pub_${platform.toLowerCase().replace(/[^a-z]/g, '')}_${Date.now()}`,
        preview_snippet: format.substring(0, 120) + '...'
      });
    });

    res.json({
      message: `Multi-Platform Dispatches Generated!`,
      publisher: authorName || 'Google Authenticated User',
      goalTitle: goalTitle,
      dispatches: dispatchLog
    });

  } catch (err) {
    console.error('Multi-Platform Publish Error:', err);
    res.status(500).json({ error: 'Failed to publish to multi-platform suite' });
  }
});

app.listen(PORT, () => {
  console.log(`LinkedIn Cross-Domain ML Agent Server running on http://localhost:${PORT}`);
});
