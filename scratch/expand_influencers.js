const fs = require('fs');
const path = require('path');

const DOMAINS = ["Tech", "Finance", "Politics", "Geopolitics"];
const PLATFORMS = ["LinkedIn", "Medium", "X (Twitter)", "Bluesky", "Threads", "Substack", "Hugging Face", "ArXiv", "GitHub"];

const INFLUENCER_ROSTER = [
  // AI & Machine Learning Leaders (1-20)
  { id: "yann_lecun", name: "Yann LeCun", title: "VP & Chief AI Scientist at Meta / NYU Professor", domain: "Tech", platform: "LinkedIn, X, Medium" },
  { id: "demis_hassabis", name: "Demis Hassabis", title: "CEO of Google DeepMind / Nobel Laureate", domain: "Tech", platform: "Medium, X, ArXiv" },
  { id: "elon_musk", name: "Elon Musk", title: "CEO of xAI, Tesla, SpaceX, & X", domain: "Tech", platform: "X, Bluesky" },
  { id: "sam_altman", name: "Sam Altman", title: "CEO of OpenAI", domain: "Tech", platform: "X, Medium, Substack" },
  { id: "clement_delangue", name: "Clement Delangue", title: "Co-founder & CEO of Hugging Face", domain: "Tech", platform: "Hugging Face, LinkedIn, X" },
  { id: "dario_amodei", name: "Dario Amodei", title: "CEO & Co-founder of Anthropic", domain: "Tech", platform: "Medium, ArXiv" },
  { id: "fei_fei_li", name: "Fei-Fei Li", title: "Stanford AI Lab Director & World Labs Founder", domain: "Tech", platform: "ArXiv, Medium, LinkedIn" },
  { id: "andrew_ng", name: "Andrew Ng", title: "Founder of DeepLearning.AI & Coursera", domain: "Tech", platform: "LinkedIn, Medium" },
  { id: "andrej_karpathy", name: "Andrej Karpathy", title: "AI Educator & Former Tesla AI Director", domain: "Tech", platform: "X, GitHub, YouTube" },
  { id: "ilya_sutskever", name: "Ilya Sutskever", title: "Co-founder of Safe Superintelligence (SSI)", domain: "Tech", platform: "ArXiv, X" },
  { id: "jensen_huang", name: "Jensen Huang", title: "CEO of NVIDIA", domain: "Tech", platform: "LinkedIn, Tech Blogs" },
  { id: "lisa_su", name: "Lisa Su", title: "CEO of AMD", domain: "Tech", platform: "LinkedIn, X" },
  { id: "satya_nadella", name: "Satya Nadella", title: "CEO of Microsoft", domain: "Tech", platform: "LinkedIn, Medium" },
  { id: "sundar_pichai", name: "Sundar Pichai", title: "CEO of Alphabet & Google", domain: "Tech", platform: "LinkedIn, X" },
  { id: "mark_zuckerberg", name: "Mark Zuckerberg", title: "CEO of Meta", domain: "Tech", platform: "Threads, Facebook, LinkedIn" },
  { id: "jim_keller", name: "Jim Keller", title: "CEO of Tenstorrent / Chip Architect", domain: "Tech", platform: "X, GitHub" },
  { id: "arvind_krishna", name: "Arvind Krishna", title: "CEO of IBM", domain: "Tech", platform: "LinkedIn, Medium" },
  { id: "pat_gelsinger", name: "Pat Gelsinger", title: "CEO of Intel", domain: "Tech", platform: "LinkedIn, X" },
  { id: "mustafa_suleyman", name: "Mustafa Suleyman", title: "CEO of Microsoft AI", domain: "Tech", platform: "Medium, X" },
  { id: "emad_mostaque", name: "Emad Mostaque", title: "Founder of Decentralized AI Collective", domain: "Tech", platform: "X, Bluesky" },

  // Open Source & Cloud Infrastructure Leaders (21-40)
  { id: "linus_torvalds", name: "Linus Torvalds", title: "Creator of Linux & Git", domain: "Tech", platform: "GitHub, Medium" },
  { id: "guido_van_rossum", name: "Guido van Rossum", title: "Creator of Python", domain: "Tech", platform: "GitHub, Bluesky" },
  { id: "mitchell_hashimoto", name: "Mitchell Hashimoto", title: "Creator of Terraform & HashiCorp Co-founder", domain: "Tech", platform: "X, Substack" },
  { id: "kelsey_hightower", name: "Kelsey Hightower", title: "Open Source Advocate & Cloud Pioneer", domain: "Tech", platform: "X, Bluesky" },
  { id: "solomon_hykes", name: "Solomon Hykes", title: "Creator of Docker & Dagger CEO", domain: "Tech", platform: "GitHub, X" },
  { id: "nat_friedman", name: "Nat Friedman", title: "Former GitHub CEO & AI Investor", domain: "Tech", platform: "X, Substack" },
  { id: "daniel_stenberg", name: "Daniel Stenberg", title: "Creator of cURL", domain: "Tech", platform: "GitHub, Mastodon" },
  { id: "brendan_eich", name: "Brendan Eich", title: "Creator of JavaScript & Brave CEO", domain: "Tech", platform: "X, Medium" },
  { id: "ryan_dahl", name: "Ryan Dahl", title: "Creator of Node.js & Deno CEO", domain: "Tech", platform: "GitHub, Medium" },
  { id: "rich_hickey", name: "Rich Hickey", title: "Creator of Clojure", domain: "Tech", platform: "GitHub, Substack" },
  { id: "antonio_neri", name: "Antonio Neri", title: "CEO of Hewlett Packard Enterprise", domain: "Tech", platform: "LinkedIn" },
  { id: "thomas_kurian", name: "Thomas Kurian", title: "CEO of Google Cloud", domain: "Tech", platform: "LinkedIn, Medium" },
  { id: "adam_selipsky", name: "Adam Selipsky", title: "Former CEO of AWS", domain: "Tech", platform: "LinkedIn" },
  { id: "matt_garman", name: "Matt Garman", title: "CEO of AWS", domain: "Tech", platform: "LinkedIn, Tech Blogs" },
  { id: "andy_jassy", name: "Andy Jassy", title: "CEO of Amazon", domain: "Tech", platform: "LinkedIn, X" },
  { id: "tim_cook", name: "Tim Cook", title: "CEO of Apple", domain: "Tech", platform: "LinkedIn, X" },
  { id: "craig_federighi", name: "Craig Federighi", title: "SVP of Software Engineering at Apple", domain: "Tech", platform: "Medium, Tech Blogs" },
  { id: "shantanu_narayen", name: "Shantanu Narayen", title: "CEO of Adobe", domain: "Tech", platform: "LinkedIn" },
  { id: "marc_benioff", name: "Marc Benioff", title: "CEO of Salesforce", domain: "Tech", platform: "X, LinkedIn" },
  { id: "parker_conrad", name: "Parker Conrad", title: "CEO of Rippling", domain: "Tech", platform: "X, Substack" },

  // VC, Finance, & Crypto Thinkers (41-60)
  { id: "marc_andreessen", name: "Marc Andreessen", title: "Co-founder of a16z", domain: "Finance", platform: "Substack, X, Medium" },
  { id: "ben_horowitz", name: "Ben Horowitz", title: "Co-founder of a16z", domain: "Finance", platform: "Substack, X" },
  { id: "vitalik_buterin", name: "Vitalik Buterin", title: "Co-founder of Ethereum", domain: "Finance", platform: "Substack, Bluesky, X" },
  { id: "balaji_srinivasan", name: "Balaji Srinivasan", title: "Author of The Network State", domain: "Finance", platform: "Substack, X, Bluesky" },
  { id: "naval_ravikant", name: "Naval Ravikant", title: "Co-founder of AngelList", domain: "Finance", platform: "X, Substack" },
  { id: "cathie_wood", name: "Cathie Wood", title: "CEO of ARK Invest", domain: "Finance", platform: "X, Medium, YouTube" },
  { id: "ray_dalio", name: "Ray Dalio", title: "Founder of Bridgewater Associates", domain: "Finance", platform: "LinkedIn, Substack" },
  { id: "larry_fink", name: "Larry Fink", title: "CEO of BlackRock", domain: "Finance", platform: "LinkedIn, Finance Media" },
  { id: "jamie_dimon", name: "Jamie Dimon", title: "CEO of JPMorgan Chase", domain: "Finance", platform: "Finance Media, Speeches" },
  { id: "warren_buffett", name: "Warren Buffett", title: "CEO of Berkshire Hathaway", domain: "Finance", platform: "Annual Letters, Media" },
  { id: "charlie_munger_legacy", name: "Charlie Munger Circle", title: "Value Investing Strategy Collective", domain: "Finance", platform: "Substack, Medium" },
  { id: "chamath_palihapitiya", name: "Chamath Palihapitiya", title: "CEO of Social Capital / All-In Podcast", domain: "Finance", platform: "X, Substack, YouTube" },
  { id: "jason_calacanis", name: "Jason Calacanis", title: "Angel Investor / All-In Podcast", domain: "Finance", platform: "X, Substack" },
  { id: "david_sacks", name: "David Sacks", title: "General Partner at Craft Ventures", domain: "Finance", platform: "X, Substack" },
  { id: "david_friedberg", name: "David Friedberg", title: "CEO of The Production Board", domain: "Finance", platform: "X, Substack" },
  { id: "bill_ackman", name: "Bill Ackman", title: "CEO of Pershing Square Capital", domain: "Finance", platform: "X, Substack" },
  { id: "howard_marks", name: "Howard Marks", title: "Co-founder of Oaktree Capital", domain: "Finance", platform: "Memos, Substack" },
  { id: "michael_saylor", name: "Michael Saylor", title: "Executive Chairman of MicroStrategy", domain: "Finance", platform: "X, YouTube" },
  { id: "brian_armstrong", name: "Brian Armstrong", title: "CEO of Coinbase", domain: "Finance", platform: "X, Medium" },
  { id: "cz_binance", name: "Changpeng Zhao", title: "Founder of Binance", domain: "Finance", platform: "X, Bluesky" },

  // Geopolitics, Policy, & Regulation (61-80)
  { id: "lina_khan", name: "Lina Khan", title: "Chair of the Federal Trade Commission (FTC)", domain: "Politics", platform: "FTC Gazettes, X" },
  { id: "peter_zeihan", name: "Peter Zeihan", title: "Geopolitical Strategist & Author", domain: "Geopolitics", platform: "Substack, YouTube" },
  { id: "ben_thompson", name: "Ben Thompson", title: "Author of Stratechery", domain: "Politics", platform: "Substack, Medium" },
  { id: "ian_bremmer", name: "Ian Bremmer", title: "President of Eurasia Group", domain: "Geopolitics", platform: "Substack, LinkedIn, X" },
  { id: "gideon_rachman", name: "Gideon Rachman", title: "Chief Foreign Affairs Analyst at FT", domain: "Geopolitics", platform: "FT, Substack" },
  { id: "anne_applebaum", name: "Anne Applebaum", title: "Pulitzer Prize Author & Historian", domain: "Geopolitics", platform: "The Atlantic, Substack" },
  { id: "fareed_zakaria", name: "Fareed Zakaria", title: "Host of CNN GPS & Washington Post Columnist", domain: "Geopolitics", platform: "Medium, Substack" },
  { id: "niall_ferguson", name: "Niall Ferguson", title: "Senior Fellow at Hoover Institution", domain: "Geopolitics", platform: "Substack, Speeches" },
  { id: "parag_khanna", name: "Parag Khanna", title: "Founder of Climate Alpha & Geopolitician", domain: "Geopolitics", platform: "LinkedIn, Substack" },
  { id: "noah_smith", name: "Noah Smith", title: "Economic Analyst & Author of Noahpinion", domain: "Politics", platform: "Substack, X" },
  { id: "matthew_yglesias", name: "Matthew Yglesias", title: "Author of Slow Boring", domain: "Politics", platform: "Substack, X" },
  { id: "tyler_cowen", name: "Tyler Cowen", title: "Professor of Economics & Marginal Revolution", domain: "Politics", platform: "Marginal Revolution, Substack" },
  { id: "alex_tabarrok", name: "Alex Tabarrok", title: "Co-author of Marginal Revolution", domain: "Politics", platform: "Marginal Revolution, Substack" },
  { id: "paul_krugman", name: "Paul Krugman", title: "Nobel Laureate Economist", domain: "Politics", platform: "NYT, Substack" },
  { id: "larry_summers", name: "Larry Summers", title: "Former US Treasury Secretary", domain: "Politics", platform: "X, Speeches" },
  { id: "janet_yellen_circle", name: "Treasury Macro Group", title: "Macroeconomic Policy Forum", domain: "Politics", platform: "Official Gazettes" },
  { id: "jerome_powell_circle", name: "Federal Reserve Board", title: "Monetary Policy Forum", domain: "Politics", platform: "Fed Reports" },
  { id: "christine_lagarde_circle", name: "European Central Bank", title: "ECB Policy & Macro Forum", domain: "Politics", platform: "ECB Gazettes" },
  { id: "margrethe_vestager", name: "Margrethe Vestager", title: "EU Competition Commissioner", domain: "Politics", platform: "EU Reports, X" },
  { id: "thierry_breton", name: "Thierry Breton", title: "Former EU Commissioner for Internal Market", domain: "Politics", platform: "X, LinkedIn" },

  // Science, Physics, Biology, & Frontier Tech (81-105)
  { id: "david_baker", name: "David Baker", title: "Nobel Laureate & Protein Design Pioneer", domain: "Tech", platform: "ArXiv, Nature" },
  { id: "jennifer_doudna", name: "Jennifer Doudna", title: "Nobel Laureate & CRISPR Pioneer", domain: "Tech", platform: "Nature, Medium" },
  { id: "george_church", name: "George Church", title: "Harvard Genetics & Synthetic Bio Pioneer", domain: "Tech", platform: "Medium, ArXiv" },
  { id: "eric_topol", name: "Eric Topol", title: "Founder of Scripps Research Translational Institute", domain: "Tech", platform: "Substack, X" },
  { id: "andrew_huberman", name: "Andrew Huberman", title: "Stanford Neurobiology Professor", domain: "Tech", platform: "YouTube, Substack" },
  { id: "lex_fridman", name: "Lex Fridman", title: "MIT Research Scientist & Podcast Host", domain: "Tech", platform: "YouTube, X" },
  { id: "brian_cox", name: "Brian Cox", title: "Particle Physicist & Science Communicator", domain: "Tech", platform: "X, Medium" },
  { id: "sean_carroll", name: "Sean Carroll", title: "Theoretical Physicist & Mindscape Host", domain: "Tech", platform: "Substack, YouTube" },
  { id: "sabine_hossenfelder", name: "Sabine Hossenfelder", title: "Physicist & Science Analyst", domain: "Tech", platform: "YouTube, Substack" },
  { id: "max_tegmark", name: "Max Tegmark", title: "MIT Physics Professor & Future of Life Institute", domain: "Tech", platform: "ArXiv, X" },
  { id: "nick_bostrom", name: "Nick Bostrom", title: "Philosopher & AI Futures Researcher", domain: "Tech", platform: "Academic Papers, Books" },
  { id: "eliezer_yudkowsky", name: "Eliezer Yudkowsky", title: "AI Alignment Researcher at MIRI", domain: "Tech", platform: "LessWrong, Substack" },
  { id: "scott_aaronson", name: "Scott Aaronson", title: "UT Austin Quantum Computing Director", domain: "Tech", platform: "Shtetl-Optimized, Substack" },
  { id: "john_preskill", name: "John Preskill", title: "Caltech Theoretical Physics Professor", domain: "Tech", platform: "ArXiv, X" },
  { id: "seth_lloyd", name: "Seth Lloyd", title: "MIT Quantum Mechanical Engineering Professor", domain: "Tech", platform: "ArXiv, Medium" },
  { id: "arxiv_cs_ai", name: "ArXiv CS/AI Papers", title: "Global Open Computer Science Literature Index", domain: "Tech", platform: "ArXiv" },
  { id: "hugging_face_hub", name: "Hugging Face Model Hub", title: "Open Weights Model Repository Index", domain: "Tech", platform: "Hugging Face" },
  { id: "github_trending", name: "GitHub Trending Repositories", title: "Open Source Code Repository Index", domain: "Tech", platform: "GitHub" },
  { id: "openfda_database", name: "openFDA Regulatory Intelligence", title: "FDA Medical & Chemical Approval Index", domain: "Tech", platform: "openFDA" },
  { id: "reactome_pathway_db", name: "Reactome Biological Pathways", title: "Open Biological Pathway Knowledgebase", domain: "Tech", platform: "Reactome" },
  { id: "chembl_database", name: "ChEMBL Bioactive Molecules", title: "Open Medicinal Chemistry Database", domain: "Tech", platform: "ChEMBL" },
  { id: "gnomad_database", name: "gnomAD Genomic Aggregation", title: "Human Genomic Variation Database", domain: "Tech", platform: "gnomAD" },
  { id: "clinical_trials_gov", name: "ClinicalTrials.gov Protocol Registry", title: "Global Clinical Trial Registry Index", domain: "Tech", platform: "ClinicalTrials" },
  { id: "uspto_patent_office", name: "USPTO Patent Registry", title: "United States Patent & Trademark Index", domain: "Tech", platform: "USPTO" },
  { id: "ftc_gazette", name: "FTC Official Gazette", title: "Federal Trade Commission Regulatory Index", domain: "Politics", platform: "FTC" }
];

function generateInfluencers() {
  const timestamp = new Date().toISOString().split('T')[0];

  const influencers = INFLUENCER_ROSTER.map(inf => {
    const followersCount = (Math.floor(Math.random() * 850) + 50) + "k Followers";
    const avatarId = Math.floor(Math.random() * 70) + 1;
    const avatarUrl = `https://i.pravatar.cc/150?img=${avatarId}`;

    return {
      id: inf.id,
      name: inf.name,
      title: inf.title,
      domain: inf.domain,
      platform_source: inf.platform,
      avatar: avatarUrl,
      followers: followersCount,
      posts: [
        {
          id: `p_${inf.id}_init`,
          text: `Official Dispatch: ${inf.name} (${inf.title}) analyzing ${inf.domain} developments. Micro-VM containerization and open-weights licensing are transforming enterprise deployment.`,
          likes: Math.floor(Math.random() * 30000) + 8000,
          reposts: Math.floor(Math.random() * 8000) + 1500,
          date: timestamp,
          keywords: [inf.domain, "OpenSource", "MicroVM", "Inference", "Strategy"]
        }
      ]
    };
  });

  const dbPath = path.join(__dirname, '..', 'data', 'influencer_database.json');
  fs.writeFileSync(dbPath, JSON.stringify({ influencers: influencers }, null, 2));

  console.log(`✅ Successfully generated ${influencers.length} influencers in data/influencer_database.json!`);
}

generateInfluencers();
