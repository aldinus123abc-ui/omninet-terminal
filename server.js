const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// --- Level 5 Galvan Encryption Setup ---
const algorithm = 'aes-256-cbc';
// In production, store this key in a .env file!
const secretKey = crypto.randomBytes(32); 
const iv = crypto.randomBytes(16);

const encrypt = (text) => {
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
};

const decrypt = (encryptedText) => {
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
};

// --- In-Memory Database ---
let omninetPosts = [];

// --- APIs ---

// 1. Create a Post
app.post('/api/posts', (req, res) => {
    // Now accepting 'image' from the frontend
    const { authorAlias, planetCom, content, image } = req.body; 
    
    const encryptedContent = encrypt(content);
    
    const newPost = {
        id: Date.now().toString(),
        authorAlias,
        planetCom: planetCom || 'Bellwood',
        encryptedContent: encryptedContent,
        image: image || null, // Store the image string
        votes: {},
        upvotes: 0,
        timestamp: new Date()
    };
    
    omninetPosts.unshift(newPost); 
    res.status(201).json({ message: "Visual data transmitted securely." });
});

// 2. Get All Posts (Feed)
app.get('/api/posts', (req, res) => {
    const decryptedFeed = omninetPosts.map(post => ({
        ...post,
        content: decrypt(post.encryptedContent),
        // Decrypt every comment attached to this post
        comments: (post.comments || []).map(comment => ({
            ...comment,
            text: decrypt(comment.encryptedText)
        }))
    }));
    
    res.status(200).json(decryptedFeed);
});

// 3. Upvote/Downvote (With Glitch Fix)
app.patch('/api/posts/:id/vote', (req, res) => {
    const { id } = req.params;
    const { action, voterAlias } = req.body; // Now accepting the user's alias
    
    const post = omninetPosts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: "Transmission lost." });

    // Safety catch for older posts made before we added the glitch fix
    if (!post.votes) post.votes = {}; 

    // Vote Logic
    if (post.votes[voterAlias] === action) {
        // If they click the same button again, it removes their vote (unlike)
        delete post.votes[voterAlias];
    } else {
        // Otherwise, register or change their vote
        post.votes[voterAlias] = action;
    }

    // Recalculate the total score based on the votes object
    let score = 0;
    for (const user in post.votes) {
        if (post.votes[user] === 'up') score += 1;
        if (post.votes[user] === 'down') score -= 1;
    }
    
    post.upvotes = score;
    res.status(200).json({ upvotes: post.upvotes });
});

// 4. Delete a Post (Purge Transmission)
app.delete('/api/posts/:id', (req, res) => {
    const { id } = req.params;
    
    const initialLength = omninetPosts.length;
    // Filter out the post with the matching ID
    omninetPosts = omninetPosts.filter(p => p.id !== id);
    
    if (omninetPosts.length < initialLength) {
        res.status(200).json({ message: "Transmission wiped from servers." });
    } else {
        res.status(404).json({ error: "Transmission not found." });
    }
});

const PORT = 5000;
// 5. Add a Comment
app.post('/api/posts/:id/comments', (req, res) => {
    const { id } = req.params;
    const { authorAlias, text } = req.body;
    
    const post = omninetPosts.find(p => p.id === id);
    if (!post) return res.status(404).json({ error: "Transmission lost." });

    if (!post.comments) post.comments = [];

    // Fulfill strict security requirement
    const newComment = {
        id: Date.now().toString(),
        authorAlias,
        encryptedText: encrypt(text),
        timestamp: new Date()
    };

    post.comments.push(newComment);
    res.status(201).json({ message: "Comment encrypted and attached." });
});

app.listen(PORT, () => console.log(`Omninet routing active on port ${PORT}`));