// server.js
import 'dotenv/config';
import express from 'express';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import favoritesRoutes from './routes/favorites.js';
import genericRoutes from './routes/genericRoutes.js';
import sequelize from '../src/database/db.js';

console.clear();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const __dirtemp = path.resolve(__dirname, './temp/');
const __dircache = path.resolve(__dirname, './cache/');

try {
    await fs.mkdir(__dirtemp, { recursive: true });
    await fs.mkdir(`${__dircache}\\logos`, { recursive: true });
} catch (error) {
    console.error(`Erro ao criar diretório ${__dirtemp}`, error);
}

const app = express();
app.use(express.json());
app.use(fileUpload());

app.use(cors({
    origin: 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

(async () => {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
    } catch (error) {
        console.error('Erro na conexão com o banco:', error);
    }
})();

// Rotas da API
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api', genericRoutes);

app.use('/cache', express.static(__dircache, {
    maxAge: '30d',
    etag: true
}));

// Servir SPA
app.use(express.static(path.join(__dirname, 'static')));
/*
app.get('*', (req, res) => {
    const indexPath = path.join(__dirname, 'src', 'static', 'index.html');

    res.sendFile(indexPath, (err) => {
        //if (err) res.status(404).send('index.html not found');
    });
});
*/

// Inicia servidor
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.info(`Servidor rodando na porta ${PORT}`);
});

export default {
    __dircache,
    __dirtemp
}