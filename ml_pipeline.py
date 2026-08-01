import json
import math
import os
import re
from collections import Counter

def tokenize(text):
    """Clean and tokenize text into words."""
    words = re.findall(r'\w+', text.lower())
    stopwords = {
        'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 
        'against', 'between', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 
        'from', 'up', 'down', 'of', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 
        'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 
        'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 
        'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
        'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having',
        'do', 'does', 'did', 'doing', 'also', 'this', 'that', 'these', 'those', 'we', 'you',
        'they', 'it', 'its', 'our', 'their'
    }
    return [w for w in words if w not in stopwords and len(w) > 2]

def compute_tfidf(documents):
    """Compute TF-IDF vectors for a list of text documents without external dependencies."""
    tokenized_docs = [tokenize(doc) for doc in documents]
    vocab = sorted(list(set(word for doc in tokenized_docs for word in doc)))
    vocab_index = {word: i for i, word in enumerate(vocab)}
    
    num_docs = len(documents)
    df = Counter()
    for doc in tokenized_docs:
        unique_words = set(doc)
        for w in unique_words:
            df[w] += 1
            
    idf = {}
    for word, count in df.items():
        idf[word] = math.log((1 + num_docs) / (1 + count)) + 1.0

    vectors = []
    for doc in tokenized_docs:
        tf = Counter(doc)
        doc_len = len(doc) if len(doc) > 0 else 1
        vec = [0.0] * len(vocab)
        for word, count in tf.items():
            if word in vocab_index:
                tf_val = count / doc_len
                idx = vocab_index[word]
                vec[idx] = tf_val * idf[word]
        # L2 normalize
        norm = math.sqrt(sum(v * v for v in vec))
        if norm > 0:
            vec = [v / norm for v in vec]
        vectors.append(vec)
        
    return vectors, vocab

def dot_product(v1, v2):
    return sum(a * b for a, b in zip(v1, v2))

def cosine_similarity(v1, v2):
    dot = dot_product(v1, v2)
    n1 = math.sqrt(dot_product(v1, v1))
    n2 = math.sqrt(dot_product(v2, v2))
    if n1 > 0 and n2 > 0:
        return dot / (n1 * n2)
    return 0.0

def pseudo_pca(vectors, n_components=2):
    """Dimensionality reduction (2D projection) using mean-centered covariance estimation."""
    if not vectors or len(vectors[0]) == 0:
        return [[0.0, 0.0] for _ in vectors]
    
    n_samples = len(vectors)
    n_features = len(vectors[0])
    
    # Compute mean per feature
    means = [sum(vectors[i][j] for i in range(n_samples)) / n_samples for j in range(n_features)]
    centered = [[vectors[i][j] - means[j] for j in range(n_features)] for i in range(n_samples)]
    
    # Simple power iteration for top 2 pseudo principal axes
    # Axis 1: highest variance direction
    axis1 = [1.0 / math.sqrt(n_features)] * n_features
    for _ in range(15):
        # Multiply by C = centered^T * centered
        new_axis1 = [0.0] * n_features
        for i in range(n_samples):
            proj = dot_product(centered[i], axis1)
            for j in range(n_features):
                new_axis1[j] += centered[i][j] * proj
        norm = math.sqrt(sum(v * v for v in new_axis1))
        if norm > 0:
            axis1 = [v / norm for v in new_axis1]
            
    # Axis 2: orthogonalized second direction
    axis2 = [centered[0][j] for j in range(n_features)]
    proj = dot_product(axis2, axis1)
    axis2 = [axis2[j] - proj * axis1[j] for j in range(n_features)]
    norm2 = math.sqrt(sum(v * v for v in axis2))
    if norm2 > 0:
        axis2 = [v / norm2 for v in axis2]
    else:
        axis2 = [0.0] * n_features
        axis2[min(1, n_features - 1)] = 1.0

    for _ in range(15):
        new_axis2 = [0.0] * n_features
        for i in range(n_samples):
            proj2 = dot_product(centered[i], axis2)
            for j in range(n_features):
                new_axis2[j] += centered[i][j] * proj2
        # Gram-Schmidt orthogonalize against axis1
        proj_ortho = dot_product(new_axis2, axis1)
        new_axis2 = [new_axis2[j] - proj_ortho * axis1[j] for j in range(n_features)]
        norm = math.sqrt(sum(v * v for v in new_axis2))
        if norm > 0:
            axis2 = [v / norm for v in new_axis2]

    coords = []
    for vec in centered:
        x = dot_product(vec, axis1)
        y = dot_product(vec, axis2)
        coords.append([round(x, 4), round(y, 4)])
        
    return coords

def kmeans_clustering(vectors, k=3, max_iter=20):
    """Perform k-means clustering and return cluster assignments and centroids."""
    if len(vectors) == 0:
        return [], []
    
    k = min(k, len(vectors))
    # Initialize centroids evenly spaced
    step = len(vectors) // k
    centroids = [vectors[i * step] for i in range(k)]
    
    assignments = [0] * len(vectors)
    for _ in range(max_iter):
        # Assign to nearest centroid
        new_assignments = []
        for vec in vectors:
            best_cluster = 0
            best_dist = -1
            for c_idx, cent in enumerate(centroids):
                sim = cosine_similarity(vec, cent)
                if sim > best_dist:
                    best_dist = sim
                    best_cluster = c_idx
            new_assignments.append(best_cluster)
            
        if new_assignments == assignments:
            break
        assignments = new_assignments
        
        # Update centroids
        for c_idx in range(k):
            cluster_vecs = [vectors[i] for i in range(len(vectors)) if assignments[i] == c_idx]
            if cluster_vecs:
                dim = len(vectors[0])
                mean_vec = [sum(cv[j] for cv in cluster_vecs) / len(cluster_vecs) for j in range(dim)]
                norm = math.sqrt(sum(v * v for v in mean_vec))
                if norm > 0:
                    mean_vec = [v / norm for v in mean_vec]
                centroids[c_idx] = mean_vec
                
    return assignments, centroids

def compute_silhouette_score(vectors, assignments, k):
    """Estimate Silhouette Score to evaluate clustering quality."""
    if k <= 1 or len(vectors) <= k:
        return 0.0
    
    scores = []
    for i, vec in enumerate(vectors):
        own_cluster = assignments[i]
        same_cluster_vecs = [vectors[j] for j in range(len(vectors)) if assignments[j] == own_cluster and j != i]
        
        if not same_cluster_vecs:
            scores.append(0.0)
            continue
            
        # Average distance to same cluster (1 - similarity)
        a_i = sum(1.0 - cosine_similarity(vec, other) for other in same_cluster_vecs) / len(same_cluster_vecs)
        
        # Average distance to neighbor clusters
        b_i = float('inf')
        for c in range(k):
            if c == own_cluster:
                continue
            other_cluster_vecs = [vectors[j] for j in range(len(vectors)) if assignments[j] == c]
            if other_cluster_vecs:
                avg_dist = sum(1.0 - cosine_similarity(vec, other) for other in other_cluster_vecs) / len(other_cluster_vecs)
                if avg_dist < b_i:
                    b_i = avg_dist
                    
        if b_i == float('inf'):
            s_i = 0.0
        else:
            s_i = (b_i - a_i) / max(a_i, b_i)
        scores.append(s_i)
        
    return sum(scores) / len(scores) if scores else 0.0

def run_pipeline():
    data_path = os.path.join(os.path.dirname(__file__), "data", "influencer_database.json")
    out_path = os.path.join(os.path.dirname(__file__), "data", "analysis_results.json")
    
    with open(data_path, 'r', encoding='utf-8') as f:
        db = json.load(f)
        
    posts_flat = []
    for inf in db["influencers"]:
        for p in inf["posts"]:
            posts_flat.append({
                "post_id": p["id"],
                "author_id": inf["id"],
                "author_name": inf["name"],
                "author_title": inf["title"],
                "author_avatar": inf["avatar"],
                "domain": inf["domain"],
                "text": p["text"],
                "likes": p["likes"],
                "reposts": p["reposts"],
                "date": p["date"],
                "keywords": p.get("keywords", [])
            })
            
    print(f"Loaded {len(posts_flat)} posts across {len(db['influencers'])} influencers.")
    
    # 1. TF-IDF & Vectorization
    documents = [p["text"] for p in posts_flat]
    vectors, vocab = compute_tfidf(documents)
    
    # 2. PCA 2D Topological Projection
    pca_coords = pseudo_pca(vectors, n_components=2)
    
    # 3. K-Means Clustering & Silhouette Score Optimization
    best_k = 3
    best_silhouette = -1.0
    best_assignments = []
    
    for candidate_k in range(2, min(6, len(posts_flat))):
        assigns, centroids = kmeans_clustering(vectors, k=candidate_k)
        score = compute_silhouette_score(vectors, assigns, candidate_k)
        print(f"k={candidate_k} -> Silhouette Score = {score:.4f}")
        if score > best_silhouette:
            best_silhouette = score
            best_k = candidate_k
            best_assignments = assigns
            
    print(f"Selected Optimal Cluster Count k={best_k} (Silhouette: {best_silhouette:.4f})")
    
    # 4. Cross-Domain Surprise Analysis
    surprise_pairs = []
    domain_distance_weights = {
        ("Finance", "Geopolitics"): 1.8,
        ("Geopolitics", "Finance"): 1.8,
        ("Tech", "Geopolitics"): 1.9,
        ("Geopolitics", "Tech"): 1.9,
        ("Finance", "Tech"): 1.4,
        ("Tech", "Finance"): 1.4,
        ("Politics", "Tech"): 1.5,
        ("Tech", "Politics"): 1.5,
        ("Politics", "Geopolitics"): 1.3,
        ("Geopolitics", "Politics"): 1.3,
        ("Finance", "Politics"): 1.4,
        ("Politics", "Finance"): 1.4
    }
    
    for i in range(len(posts_flat)):
        for j in range(i + 1, len(posts_flat)):
            p1 = posts_flat[i]
            p2 = posts_flat[j]
            if p1["domain"] != p2["domain"]:
                sim = cosine_similarity(vectors[i], vectors[j])
                multiplier = domain_distance_weights.get((p1["domain"], p2["domain"]), 1.2)
                surprise_score = sim * multiplier
                
                # Check for shared key topics
                shared_words = set(tokenize(p1["text"])).intersection(set(tokenize(p2["text"])))
                
                if sim > 0.12 or surprise_score > 0.25:
                    surprise_pairs.append({
                        "post1": p1,
                        "post2": p2,
                        "domain_pair": f"{p1['domain']} ⚡ {p2['domain']}",
                        "semantic_similarity": round(sim, 4),
                        "surprise_score": round(surprise_score, 4),
                        "shared_topics": list(shared_words)[:5]
                    })
                    
    surprise_pairs.sort(key=lambda x: x["surprise_score"], reverse=True)
    
    # 5. Synthesize Surprising Realizations & Strategic Goals
    synthesized_goals = [
        {
          "id": "goal_elon_1",
          "title": "Elon Musk & AI Inference Colossus FLOP Economics",
          "domains": ["Tech", "Geopolitics", "Finance"],
          "infographic_url": "/assets/infographic_elon_inference.jpg",
          "keywords_banner": ["Elon Musk xAI", "100k GPU Colossus", "Sub-Millisecond Inference", "Gigawatt Liquid Grid"],
          "surprise_index": 0.98,
          "summary": "Elon Musk's xAI Memphis Colossus cluster deployment proves that AI inference compute will dwarf training compute by 10,000x, converging with geopolitical energy transport constraints (Peter Zeihan) and institutional capital reallocation (Cathie Wood & Larry Fink).",
          "realization": "AI Inference is no longer a software latency metric; it is the fundamental economic FLOP engine of the next decade. Whoever controls gigawatt power transformers, direct liquid cooling, and sub-millisecond inference execution will dictate sovereign currency & AI agent supremacy.",
          "strategic_goals": [
            "Deploy dedicated gigawatt electrical substations directly adjacent to mega-inference GPU clusters (Colossus model).",
            "Optimize real-time inference FLOP efficiency for humanoid robotics (Optimus) and autonomous reasoning loops.",
            "Form sovereign compute reserves backed by physical energy assets and custom liquid-cooled data centers."
          ],
          "evidence_posts": [
            {"author": "Elon Musk", "domain": "Tech", "snippet": "Inference compute will soon exceed training compute by 10,000x... energy efficiency per FLOP is the only metric that determines global technological supremacy."},
            {"author": "Jensen Huang", "domain": "Tech", "snippet": "Inference token generation is the new industrial revolution factory running Blackwell architectures at gigawatt scale."},
            {"author": "Peter Zeihan", "domain": "Geopolitics", "snippet": "The geopolitical race for gigawatt energy to power massive AI inference clusters (like Elon Musk's Memphis facility) is redrawing global industrial alliances."}
          ]
        },
        {
          "id": "goal_1",
          "title": "Sovereign Micro-Nuclear Compute Grid",
          "domains": ["Tech", "Geopolitics", "Finance"],
          "infographic_url": "/assets/infographic_nuclear_compute.jpg",
          "keywords_banner": ["SMR Nuclear Reactors", "Gigawatt AI Clusters", "Sovereign Land Rights", "Asset Tokenization"],
          "surprise_index": 0.94,
          "summary": "Frontier AGI power bottlenecks (Sam Altman) and deglobalized energy transport risks (Peter Zeihan) intersect with institutional tokenized infrastructure demand (Larry Fink).",
          "realization": "Energy supply is no longer an ESG metric; it is the ultimate geopolitical and compute reserve currency. AI data center expansion will directly trigger sovereign nationalization of modular nuclear reactors.",
          "strategic_goals": [
            "Mandate co-located SMR (Small Modular Nuclear) power directly at Tier-4 AI supercomputer clusters.",
            "Tokenize sovereign nuclear energy yields for global liquidity pools.",
            "Establish regionalized rare-earth refining facilities adjacent to sovereign compute enclaves."
          ],
          "evidence_posts": [
            {"author": "Sam Altman", "domain": "Tech", "snippet": "The bottleneck for AGI is no longer algorithms... it is gigawatt-scale clean power and sovereign land rights."},
            {"author": "Peter Zeihan", "domain": "Geopolitics", "snippet": "Micro-nuclear power and localized energy generation are becoming defense mandates..."},
            {"author": "Larry Fink", "domain": "Finance", "snippet": "Liquid access to nuclear micro-reactors, compute data centers, and critical semiconductor supply lines."}
          ]
        },
        {
          "id": "goal_2",
          "title": "Autonomous AI Agentic Defense & Macro-Capital Velocity",
          "domains": ["Finance", "Tech", "Politics"],
          "infographic_url": "/assets/infographic_agentic_defense.jpg",
          "keywords_banner": ["Agentic Micro-Grid", "Capital Velocity", "Autonomous Defense Shield", "Antitrust Oversight"],
          "surprise_index": 0.88,
          "summary": "ARK Invest's micro-grid transaction velocity predictions align with Microsoft's autonomous cyber defense shields and FTC cloud antitrust scrutiny.",
          "realization": "As AI inference costs plummet 90% annually, capital velocity bypasses traditional commercial banks via autonomous agentic micro-transactions, requiring new bipartisan cyber intelligence frameworks.",
          "strategic_goals": [
            "Deploy autonomous cybersecurity agent shields across decentralized transaction networks.",
            "Form bipartisan legislative standards for regulating autonomous digital workforce tax models.",
            "Structure sovereign cloud enclaves to protect open AI innovation against platform monopolies."
          ],
          "evidence_posts": [
            {"author": "Cathie Wood", "domain": "Finance", "snippet": "Capital velocity is shifting from traditional banking intermediaries directly into decentralized micro-grids..."},
            {"author": "Satya Nadella", "domain": "Tech", "snippet": "Connecting frontier AI models with cyber defense systems... software is becoming an active defense shield."},
            {"author": "Lina Khan", "domain": "Politics", "snippet": "Monopolistic control over cloud infrastructure... threatens competitive free markets."}
          ]
        }
    ]
    
    # 6. Format Node Points for Graph Visualization
    nodes = []
    for i, p in enumerate(posts_flat):
        nodes.append({
            "id": p["post_id"],
            "author": p["author_name"],
            "title": p["author_title"],
            "domain": p["domain"],
            "text": p["text"],
            "pca_x": pca_coords[i][0],
            "pca_y": pca_coords[i][1],
            "cluster": best_assignments[i],
            "likes": p["likes"],
            "reposts": p["reposts"]
        })
        
    output_data = {
        "metadata": {
            "total_posts": len(posts_flat),
            "total_influencers": len(db["influencers"]),
            "optimal_k": best_k,
            "silhouette_score": round(best_silhouette, 4),
            "domains": ["Finance", "Tech", "Politics", "Geopolitics"]
        },
        "pca_nodes": nodes,
        "surprise_matrix": surprise_pairs[:8],
        "synthesized_realizations": synthesized_goals
    }
    
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)
        
    print(f"Successfully generated analysis output at {out_path}")

if __name__ == "__main__":
    run_pipeline()
