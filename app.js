// app.js
const express = require('express');
const axios = require('axios');
const mongoose = require('mongoose');
const session = require('express-session');
const app = express();
const port = 8000;

const TMDB_API_KEY = '1e23e1cbe808fc398defed60deb63779';
const BASE_URL = 'https://api.themoviedb.org/3';

// MongoDB connection with MongoDB Atlas
mongoose.connect('mongodb+srv://alhous15:pK92MN9g48MGXKTE@cluster0.s1eis.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0')
.then(() => {
    console.log('Connected to MongoDB Atlas');
})
.catch((err) => {
    console.error('Error connecting to MongoDB:', err);
});

// User Schema
const userSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    myMovies: [{
        movieId: Number,
        title: String,
        poster_path: String,
        vote_average: Number,
        release_date: String,
        overview: String
    }]
});

const User = mongoose.model('User', userSchema);

// Middleware setup
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

// Authentication middleware
const requireLogin = (req, res, next) => {
    if (!req.session.userEmail) {
        return res.redirect('/login');
    }
    next();
};

// Routes
app.get('/login', (req, res) => {
    if (req.session.userEmail) {
        return res.redirect('/');
    }
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { email } = req.body;
    
    try {
        let user = await User.findOne({ email });
        if (!user) {
            user = await User.create({ email });
        }
        
        req.session.userEmail = email;
        res.redirect('/');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error processing login');
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/', requireLogin, async (req, res) => {
    try {
        const response = await axios.get(`${BASE_URL}/movie/popular`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                page: 1
            }
        });

        const user = await User.findOne({ email: req.session.userEmail });
        const myMovieIds = user.myMovies.map(m => m.movieId);

        res.render('index', { 
            movies: response.data.results,
            userEmail: req.session.userEmail,
            myMovieIds
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching movies');
    }
});

app.get('/search', requireLogin, async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) {
            return res.redirect('/');
        }

        const response = await axios.get(`${BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                language: 'en-US',
                query: query,
                page: 1
            }
        });

        const user = await User.findOne({ email: req.session.userEmail });
        const myMovieIds = user.myMovies.map(m => m.movieId);

        res.render('index', { 
            movies: response.data.results,
            searchQuery: query,
            userEmail: req.session.userEmail,
            myMovieIds
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error searching movies');
    }
});

app.get('/my-movies', requireLogin, async (req, res) => {
    try {
        const user = await User.findOne({ email: req.session.userEmail });
        res.render('my-movies', { 
            movies: user.myMovies,
            userEmail: req.session.userEmail 
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error fetching my movies');
    }
});

app.post('/add-movie', requireLogin, async (req, res) => {
    try {
        const movieData = {
            movieId: parseInt(req.body.movieId),
            title: req.body.title,
            poster_path: req.body.poster_path,
            vote_average: parseFloat(req.body.vote_average),
            release_date: req.body.release_date,
            overview: req.body.overview
        };

        const user = await User.findOne({ email: req.session.userEmail });
        
        if (!user.myMovies.some(movie => movie.movieId === movieData.movieId)) {
            user.myMovies.push(movieData);
            await user.save();
        }
        
        res.redirect('back');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error adding movie to your list');
    }
});

app.post('/remove-movie', requireLogin, async (req, res) => {
    try {
        const movieId = parseInt(req.body.movieId);
        const user = await User.findOne({ email: req.session.userEmail });
        
        user.myMovies = user.myMovies.filter(movie => movie.movieId !== movieId);
        await user.save();
        
        res.redirect('back');
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error removing movie from your list');
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// 404 handler
app.use((req, res) => {
    res.status(404).send('Page not found');
});

// Start the server
app.listen(port, () => {
    console.log(`Movie app listening at http://localhost:${port}`);
});