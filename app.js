const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// Vercel terminates TLS at its edge and forwards over HTTP — trust its
// proxy so req.secure / secure cookies behave correctly in production.
app.set('trust proxy', 1);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/api', apiRoutes);

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.get('/', (req, res) => res.redirect('/login/'));

// Static frontend (plain HTML/CSS/JS, one folder per portal). Uploaded
// files (logos/photos/gallery) are no longer served from here — they live
// in Supabase Storage and controllers return their public URLs directly
// (see utils/storage.js); local disk storage doesn't survive on Vercel.
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', notFound);
app.use(errorHandler);

module.exports = app;
